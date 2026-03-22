using LexiAI.Api.Extensions;
using LexiAI.Api.Interfaces;
using LexiAI.Api.Models.DTOs;
using LexiAI.Api.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LexiAI.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IAiResponseService _aiResponseService;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        IAiResponseService aiResponseService,
        ILogger<ChatController> logger)
    {
        _aiResponseService = aiResponseService;
        _logger = logger;
    }

    /// POST /api/chat/send
    [HttpPost("send")]
    public async Task<ActionResult<ChatResponse>> SendMessage(
        [FromBody] SendMessageRequest request)
    {
        var userId = User.GetUserId();

        try
        {
            var response = await _aiResponseService
                .SendMessageAsync(userId, request);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex,
                "Agent run failed for conversation {ConversationId}",
                request.ConversationId);
            return StatusCode(502, new {
                message = "AI agent failed to respond. Please try again."
            });
        }
    }

    /// GET /api/chat/history/{conversationId}
    [HttpGet("history/{conversationId}")]
    public async Task<ActionResult<IEnumerable<AiResponseDto>>>
        GetChatHistory(string conversationId)
    {
        var userId = User.GetUserId();
        var responses = await _aiResponseService
            .GetUserAiResponsesAsync(conversationId);

        return Ok(responses.Select(r => new AiResponseDto(
            r.Id,
            r.ConversationId,
            r.UserId,
            r.UserMessage,
            r.AiMessage,
            r.CreatedAt,
            r.TokensUsed
        )));
    }
}
