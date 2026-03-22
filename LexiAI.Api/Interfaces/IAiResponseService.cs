using LexiAI.Api.Models.DTOs;
using LexiAI.Api.Models.Entities;

namespace LexiAI.Api.Interfaces;

public interface IAiResponseService
{
    Task<ChatResponse> SendMessageAsync(string userId, SendMessageRequest request);
    Task<AiResponse> SaveAiResponseAsync(AiResponse aiResponse);
    Task<IEnumerable<AiResponse>> GetUserAiResponsesAsync(string conversationId);
}
