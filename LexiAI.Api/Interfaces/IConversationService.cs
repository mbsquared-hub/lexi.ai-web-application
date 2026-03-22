using LexiAI.Api.Models.DTOs;
using LexiAI.Api.Models.Entities;

namespace LexiAI.Api.Interfaces;

public interface IConversationService
{
    Task<Conversation> CreateConversationAsync(string userId, string? title = null);
    Task<Conversation?> GetConversationAsync(string conversationId, string userId);
    Task<IEnumerable<Conversation>> GetUserConversationsAsync(string userId);
    Task<Conversation?> UpdateConversationAsync(string conversationId, string userId, UpdateConversationRequest request);
}
