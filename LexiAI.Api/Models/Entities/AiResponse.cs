using Newtonsoft.Json;

namespace LexiAI.Api.Models.Entities;

public class AiResponse
{
    [JsonProperty("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [JsonProperty("conversationId")]
    public string ConversationId { get; set; } = string.Empty;

    [JsonProperty("userId")]
    public string UserId { get; set; } = string.Empty;

    [JsonProperty("userMessage")]
    public string UserMessage { get; set; } = string.Empty;

    [JsonProperty("aiMessage")]
    public string AiMessage { get; set; } = string.Empty;

    [JsonProperty("agentRunId")]
    public string? AgentRunId { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonProperty("tokensUsed")]
    public int? TokensUsed { get; set; }

    [JsonProperty("type")]
    public string Type { get; set; } = "aiResponse";
}
