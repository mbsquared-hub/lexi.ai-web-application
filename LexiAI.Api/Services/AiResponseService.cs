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

    // Build message content
    private static object BuildMessageContent(string message, List<string>? images)
    {
        // No images — send as plain string
        if (images == null || images.Count == 0)
            return string.IsNullOrWhiteSpace(message) ? "Please describe this." : message;

        var contentParts = new List<object>();

        // only add text block if there's actual text
        if (!string.IsNullOrWhiteSpace(message))
        {
            contentParts.Add(new
            {
                type = "text",
                text = message
            });
        }

        foreach (var image in images)
        {
            contentParts.Add(new
            {
                type = "image_url",
                image_url = new
                {
                    url = image,
                    detail = "auto"
                }
            });
        }

        return contentParts;
    }

    // Post message — tries with images, falls back to text-only
    private async Task<HttpResponseMessage> PostMessageToThreadAsync(
        HttpClient client,
        string threadId,
        string message,
        List<string>? images)
    {
        if (images != null && images.Count > 0)
        {
            var payloadWithImages = JsonSerializer.Serialize(new
            {
                role = "user",
                content = BuildMessageContent(message, images)
            });

            var responseWithImages = await client.PostAsync(
                $"{BaseUrl}/openai/threads/{threadId}/messages?api-version={ApiVersion}",
                new StringContent(payloadWithImages, Encoding.UTF8, "application/json"));

            if (responseWithImages.IsSuccessStatusCode)
            {
                _logger.LogInformation("Message sent with {Count} image(s)", images.Count);
                return responseWithImages;
            }

            var errorBody = await responseWithImages.Content.ReadAsStringAsync();
            _logger.LogWarning(
                "Image message failed ({Status}), retrying text-only. Error: {Error}",
                responseWithImages.StatusCode, errorBody);

            responseWithImages.Dispose();
        }

        // Fallback — text only
        var textOnlyPayload = JsonSerializer.Serialize(new
        {
            role = "user",
            content = string.IsNullOrWhiteSpace(message)
                ? "Please describe this."
                : message
        });

        _logger.LogInformation("Sending text-only message (image stripped)");
        return await client.PostAsync(
            $"{BaseUrl}/openai/threads/{threadId}/messages?api-version={ApiVersion}",
            new StringContent(textOnlyPayload, Encoding.UTF8, "application/json"));
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
            "Sending message to thread {ThreadId} with {ImageCount} image(s)",
            conversation.AgentThreadId,
            request.Images?.Count ?? 0);

        using var client = await CreateAuthenticatedClientAsync();
        var threadId = conversation.AgentThreadId;

        // Add user message (with image fallback)
        var messageResponse = await PostMessageToThreadAsync(
            client, threadId, request.Message, request.Images);

        var messageBody = await messageResponse.Content.ReadAsStringAsync();
        _logger.LogInformation("Add message response {Status}: {Body}",
            messageResponse.StatusCode, messageBody);

        if (!messageResponse.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Failed to add message even without images. Status: {Status}, Body: {Body}",
                messageResponse.StatusCode, messageBody);
            throw new InvalidOperationException(
                $"Failed to add message to thread: {messageBody}");
        }

        // Create a run
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

        if (!runResponse.IsSuccessStatusCode)
        {
            _logger.LogError("Failed to create run. Status: {Status}, Body: {Body}",
                runResponse.StatusCode, runBody);
            throw new InvalidOperationException(
                $"Failed to create agent run: {runBody}");
        }

        using var runDoc = JsonDocument.Parse(runBody);
        var runId = runDoc.RootElement.GetProperty("id").GetString()!;
        var runStatus = runDoc.RootElement.GetProperty("status").GetString()!;

        // Poll until complete
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

        // Get messages
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

        // Save to Cosmos DB
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
        
        // Update conversation preview
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