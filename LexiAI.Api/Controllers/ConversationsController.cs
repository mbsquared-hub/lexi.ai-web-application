using LexiAI.Api.Extensions;
using LexiAI.Api.Interfaces;
using LexiAI.Api.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LexiAI.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly IConversationService _conversationService;
    private readonly ILogger<ConversationsController> _logger;

    public ConversationsController(
        IConversationService conversationService,
        ILogger<ConversationsController> logger)
    {
        _conversationService = conversationService;
        _logger = logger;
    }

    /// POST /api/conversations
    [HttpPost]
    public async Task<ActionResult<ConversationDto>> CreateConversation(
        [FromBody] CreateConversationRequest request)
    {
        var userId = User.GetUserId();
        var conversation = await _conversationService
            .CreateConversationAsync(userId, request.Title);

        return CreatedAtAction(
            nameof(GetConversation),
            new { conversationId = conversation.Id },
            new ConversationDto(
                conversation.Id,
                conversation.UserId,
                conversation.AgentThreadId,
                conversation.Title,
                conversation.CreatedAt,
                conversation.UpdatedAt,
                conversation.LastMessagePreview,
                conversation.IsActive));
    }

    /// GET /api/conversations
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations()
    {
        var userId = User.GetUserId();
        var conversations = await _conversationService
            .GetUserConversationsAsync(userId);

        return Ok(conversations.Select(c => new ConversationDto(
            c.Id,
            c.UserId,
            c.AgentThreadId,
            c.Title,
            c.CreatedAt,
            c.UpdatedAt,
            c.LastMessagePreview,
            c.IsActive)));
    }

    /// GET /api/conversations/{conversationId}
    [HttpGet("{conversationId}")]
    public async Task<ActionResult<ConversationDto>> GetConversation(
        string conversationId)
    {
        var userId = User.GetUserId();
        var conversation = await _conversationService
            .GetConversationAsync(conversationId, userId);

        if (conversation is null)
            return NotFound();

        return Ok(new ConversationDto(
            conversation.Id,
            conversation.UserId,
            conversation.AgentThreadId,
            conversation.Title,
            conversation.CreatedAt,
            conversation.UpdatedAt,
            conversation.LastMessagePreview,
            conversation.IsActive));
    }

    /// PATCH /api/conversations/{conversationId}
    [HttpPatch("{conversationId}")]
    public async Task<ActionResult<ConversationDto>> UpdateConversation(
        string conversationId,
        [FromBody] UpdateConversationRequest request)
    {
        var userId = User.GetUserId();
        var conversation = await _conversationService
            .UpdateConversationAsync(conversationId, userId, request);

        if (conversation is null)
            return NotFound();

        return Ok(new ConversationDto(
            conversation.Id,
            conversation.UserId,
            conversation.AgentThreadId,
            conversation.Title,
            conversation.CreatedAt,
            conversation.UpdatedAt,
            conversation.LastMessagePreview,
            conversation.IsActive));
    }
}
