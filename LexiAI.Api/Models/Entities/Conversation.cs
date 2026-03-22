using Newtonsoft.Json;

namespace LexiAI.Api.Models.Entities;

public class Conversation
{
    [JsonProperty("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [JsonProperty("userId")]
    public string UserId { get; set; } = string.Empty;

    [JsonProperty("agentThreadId")]
    public string AgentThreadId { get; set; } = string.Empty;

    [JsonProperty("title")]
    public string Title { get; set; } = string.Empty;

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [JsonProperty("lastMessagePreview")]
    public string? LastMessagePreview { get; set; }

    [JsonProperty("isActive")]
    public bool IsActive { get; set; } = true;

    [JsonProperty("type")]
    public string Type { get; set; } = "conversation";
}
