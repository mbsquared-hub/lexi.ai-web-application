using Azure.Core;
using Azure.Identity;
using LexiAI.Api.Configuration;
using LexiAI.Api.Interfaces;
using LexiAI.Api.Models.DTOs;
using LexiAI.Api.Models.Entities;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace LexiAI.Api.Services;

public class AiResponseService : IAiResponseService
{
    private readonly Container _aiResponsesContainer;
    private readonly IConversationService _conversationService;
    private readonly AzureAiOptions _aiOptions;
    private readonly ILogger<AiResponseService> _logger;
    private readonly TokenCredential _credential;

    private const string BaseUrl = "https://lexi-ai-project-resource.services.ai.azure.com";
    private const string ApiVersion = "2024-05-01-preview";

    public AiResponseService(
        CosmosClient cosmosClient,
        IConversationService conversationService,
        IOptions<CosmosDbOptions> cosmosOptions,
        IOptions<AzureAiOptions> aiOptions,
        ILogger<AiResponseService> logger)
    {
        var opts = cosmosOptions.Value;
        _aiResponsesContainer = cosmosClient
            .GetDatabase(opts.DatabaseName)
            .GetContainer(opts.AiResponsesContainer);

        _conversationService = conversationService;
        _aiOptions = aiOptions.Value;
        _credential = new DefaultAzureCredential();
        _logger = logger;
    }

    private async Task<HttpClient> CreateAuthenticatedClientAsync()
    {
        var tokenRequestContext = new TokenRequestContext(
            new[] { "https://cognitiveservices.azure.com/.default" });
        var token = await _credential.GetTokenAsync(
            tokenRequestContext, CancellationToken.None);

        var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.Token);
        return client;
    }

    public async Task<ChatResponse> SendMessageAsync(
        string userId, SendMessageRequest request)
    {
        var conversation = await _conversationService
            .GetConversationAsync(request.ConversationId, userId);

        if (conversation is null)
            throw new KeyNotFoundException(
                $"Conversation {request.ConversationId} not found.");

        _logger.LogInformation(
            "Sending message to thread {ThreadId}",
            conversation.AgentThreadId);

        using var client = await CreateAuthenticatedClientAsync();
        var threadId = conversation.AgentThreadId;

        // Step 2: Add user message to the thread
        var messagePayload = JsonSerializer.Serialize(new
        {
            role = "user",
            content = request.Message
        });

        var messageResponse = await client.PostAsync(
            $"{BaseUrl}/openai/threads/{threadId}/messages?api-version={ApiVersion}",
            new StringContent(messagePayload, Encoding.UTF8, "application/json"));

        var messageBody = await messageResponse.Content.ReadAsStringAsync();
        _logger.LogInformation("Add message response {Status}: {Body}",
            messageResponse.StatusCode, messageBody);
        messageResponse.EnsureSuccessStatusCode();

        // Step 3: Create a run
        var runPayload = JsonSerializer.Serialize(new
        {
            assistant_id = _aiOptions.AgentId
        });

        var runResponse = await client.PostAsync(
            $"{BaseUrl}/openai/threads/{threadId}/runs?api-version={ApiVersion}",
            new StringContent(runPayload, Encoding.UTF8, "application/json"));

        var runBody = await runResponse.Content.ReadAsStringAsync();
        _logger.LogInformation("Create run response {Status}: {Body}",
            runResponse.StatusCode, runBody);
        runResponse.EnsureSuccessStatusCode();

        using var runDoc = JsonDocument.Parse(runBody);
        var runId = runDoc.RootElement.GetProperty("id").GetString()!;
        var runStatus = runDoc.RootElement.GetProperty("status").GetString()!;

        // Step 4: Poll until complete
        while (runStatus == "queued" || runStatus == "in_progress")
        {
            await Task.Delay(500);

            var pollResponse = await client.GetAsync(
                $"{BaseUrl}/openai/threads/{threadId}/runs/{runId}?api-version={ApiVersion}");
            var pollBody = await pollResponse.Content.ReadAsStringAsync();

            using var pollDoc = JsonDocument.Parse(pollBody);
            runStatus = pollDoc.RootElement.GetProperty("status").GetString()!;
            _logger.LogInformation("Run status: {Status}", runStatus);
        }

        if (runStatus != "completed")
        {
            _logger.LogError("Agent run failed with status {Status}", runStatus);
            throw new InvalidOperationException(
                $"Agent run did not complete. Status: {runStatus}");
        }

        // Step 5: Get messages
        var messagesResponse = await client.GetAsync(
            $"{BaseUrl}/openai/threads/{threadId}/messages?api-version={ApiVersion}");
        var messagesBody = await messagesResponse.Content.ReadAsStringAsync();
        messagesResponse.EnsureSuccessStatusCode();

        using var messagesDoc = JsonDocument.Parse(messagesBody);
        var messagesData = messagesDoc.RootElement.GetProperty("data");

        string aiReply = "I couldn't generate a response.";
        foreach (var msg in messagesData.EnumerateArray())
        {
            if (msg.GetProperty("role").GetString() == "assistant")
            {
                var content = msg.GetProperty("content");
                foreach (var item in content.EnumerateArray())
                {
                    if (item.GetProperty("type").GetString() == "text")
                    {
                        aiReply = item.GetProperty("text")
                            .GetProperty("value").GetString()!;
                        break;
                    }
                }
                break;
            }
        }

        // Step 6: Save to Cosmos DB
        var aiResponse = new AiResponse
        {
            ConversationId = request.ConversationId,
            UserId = userId,
            UserMessage = request.Message,
            AiMessage = aiReply,
            AgentRunId = runId,
            CreatedAt = DateTime.UtcNow
        };

        await SaveAiResponseAsync(aiResponse);

        // Step 7: Update conversation preview
        await _conversationService.UpdateConversationAsync(
            request.ConversationId,
            userId,
            new UpdateConversationRequest(
                Title: null,
                LastMessagePreview: aiReply.Length > 100
                    ? aiReply[..100] + "..."
                    : aiReply,
                IsActive: null
            )
        );

        return new ChatResponse(
            ConversationId: request.ConversationId,
            UserMessage: request.Message,
            AiReply: aiReply,
            Timestamp: DateTime.UtcNow
        );
    }

    public async Task<AiResponse> SaveAiResponseAsync(AiResponse aiResponse)
    {
        var response = await _aiResponsesContainer.CreateItemAsync(
            aiResponse,
            new PartitionKey(aiResponse.UserId)
        );
        return response.Resource;
    }

    public async Task<IEnumerable<AiResponse>> GetUserAiResponsesAsync(
        string conversationId)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.conversationId = @conversationId " +
            "AND c.type = 'aiResponse' " +
            "ORDER BY c.createdAt ASC"
        ).WithParameter("@conversationId", conversationId);

        var results = new List<AiResponse>();
        using var iterator = _aiResponsesContainer
            .GetItemQueryIterator<AiResponse>(query);

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync();
            results.AddRange(page);
        }

        return results;
    }
}
