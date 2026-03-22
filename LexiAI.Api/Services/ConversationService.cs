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

public class ConversationService : IConversationService
{
    private readonly Container _conversationsContainer;
    private readonly ILogger<ConversationService> _logger;
    private readonly TokenCredential _credential;

    private const string BaseUrl = "https://lexi-ai-project-resource.services.ai.azure.com";
    private const string ApiVersion = "2024-05-01-preview";

    public ConversationService(
        CosmosClient cosmosClient,
        IOptions<CosmosDbOptions> cosmosOptions,
        IOptions<AzureAiOptions> azureAiOptions,
        ILogger<ConversationService> logger)
    {
        var opts = cosmosOptions.Value;
        _conversationsContainer = cosmosClient
            .GetDatabase(opts.DatabaseName)
            .GetContainer(opts.ConversationsContainer);

        _credential = new DefaultAzureCredential();
        _logger = logger;
    }

    private async Task<string> CreateThreadDirectAsync()
    {
        var tokenRequestContext = new TokenRequestContext(
            new[] { "https://cognitiveservices.azure.com/.default" });
        var token = await _credential.GetTokenAsync(
            tokenRequestContext, CancellationToken.None);

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.Token);

        var url = $"{BaseUrl}/openai/threads?api-version={ApiVersion}";
        _logger.LogInformation("Calling: {Url}", url);

        var response = await client.PostAsync(url,
            new StringContent("{}", Encoding.UTF8, "application/json"));

        var body = await response.Content.ReadAsStringAsync();
        _logger.LogInformation("Response {Status}: {Body}",
            response.StatusCode, body);

        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("id").GetString()!;
    }

    public async Task<Conversation> CreateConversationAsync(
        string userId, string? title = null)
    {
        _logger.LogInformation(
            "Creating new agent thread for user {UserId}", userId);

        var threadId = await CreateThreadDirectAsync();
        _logger.LogInformation("Thread created: {ThreadId}", threadId);

        var conversation = new Conversation
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            AgentThreadId = threadId,
            Title = title ?? "New Conversation",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _conversationsContainer.CreateItemAsync(
            conversation,
            new PartitionKey(userId)
        );

        _logger.LogInformation(
            "Created conversation {ConversationId} with thread {ThreadId}",
            conversation.Id, conversation.AgentThreadId);

        return conversation;
    }

    public async Task<Conversation?> GetConversationAsync(
        string conversationId, string userId)
    {
        try
        {
            var response = await _conversationsContainer.ReadItemAsync<Conversation>(
                conversationId,
                new PartitionKey(userId)
            );
            return response.Resource;
        }
        catch (CosmosException ex)
            when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning(
                "Conversation {ConversationId} not found for user {UserId}",
                conversationId, userId);
            return null;
        }
    }

    public async Task<IEnumerable<Conversation>> GetUserConversationsAsync(
        string userId)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.userId = @userId " +
            "AND c.type = 'conversation' " +
            "ORDER BY c.updatedAt DESC"
        ).WithParameter("@userId", userId);

        var results = new List<Conversation>();
        using var iterator = _conversationsContainer
            .GetItemQueryIterator<Conversation>(query);

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync();
            results.AddRange(page);
        }

        return results;
    }

    public async Task<Conversation?> UpdateConversationAsync(
        string conversationId,
        string userId,
        UpdateConversationRequest request)
    {
        var existing = await GetConversationAsync(conversationId, userId);
        if (existing is null) return null;

        if (request.Title is not null)
            existing.Title = request.Title;

        if (request.LastMessagePreview is not null)
            existing.LastMessagePreview = request.LastMessagePreview;

        if (request.IsActive.HasValue)
            existing.IsActive = request.IsActive.Value;

        existing.UpdatedAt = DateTime.UtcNow;

        var response = await _conversationsContainer.ReplaceItemAsync(
            existing,
            conversationId,
            new PartitionKey(userId)
        );

        return response.Resource;
    }
}
