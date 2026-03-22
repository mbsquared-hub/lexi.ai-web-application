namespace LexiAI.Api.Configuration;

public class CosmosDbOptions
{
    public const string SectionName = "CosmosDb";
    public string Uri { get; set; } = string.Empty;
    public string PrimaryKey { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = string.Empty;
    public string ConversationsContainer { get; set; } = string.Empty;
    public string AiResponsesContainer { get; set; } = string.Empty;
}

public class AzureAiOptions
{
    public const string SectionName = "AzureAI";
    public string Endpoint { get; set; } = string.Empty;
    public string AgentId { get; set; } = string.Empty;
    public string SubscriptionId { get; set; } = string.Empty;
}
