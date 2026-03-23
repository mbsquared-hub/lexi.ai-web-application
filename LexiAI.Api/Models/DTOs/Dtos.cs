namespace LexiAI.Api.Models.DTOs;

public record CreateConversationRequest(string? Title);

public record UpdateConversationRequest(
    string? Title,
    string? LastMessagePreview,
    bool? IsActive);

public record ConversationDto(
    string Id,
    string UserId,
    string AgentThreadId,
    string Title,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string? LastMessagePreview,
    bool IsActive);

// ← Updated: added Images field
public record SendMessageRequest(
    string ConversationId,
    string Message,
    List<string>? Images = null);

public record ChatResponse(
    string ConversationId,
    string UserMessage,
    string AiReply,
    DateTime Timestamp);

public record AiResponseDto(
    string Id,
    string ConversationId,
    string UserId,
    string UserMessage,
    string AiMessage,
    DateTime CreatedAt,
    int? TokensUsed);