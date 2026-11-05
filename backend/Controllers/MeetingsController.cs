using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

[ApiController]
[Route("api/meetings")]
[Authorize]
public class MeetingsController : ControllerBase
{
    private readonly IMeetingService _meetingService;
    private readonly ILogger<MeetingsController> _logger;

    public MeetingsController(IMeetingService meetingService, ILogger<MeetingsController> logger)
    {
        _meetingService = meetingService;
        _logger = logger;
    }

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    // -------------------------------------------------------
    // POST /api/meetings/schedule — Schedule meeting (Save details to DB)
    // -------------------------------------------------------
    [HttpPost("schedule")]
    public async Task<IActionResult> Schedule([FromBody] ScheduleMeetingRequest request)
    {
        _logger.LogInformation("[MeetingsController] POST /api/meetings/schedule — CallerUserId: {UserId}, WebinarId: {WebinarId}",
            CallerUserId, request.WebinarId);

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, message = "Invalid meeting data.", errors = ModelState });

        var (success, message, meeting) = await _meetingService.ScheduleMeetingAsync(request, CallerUserId);

        if (!success)
            return BadRequest(new { success = false, message });

        return Ok(new { success = true, message, data = meeting });
    }

    // -------------------------------------------------------
    // GET /api/meetings/webinar/{webinarId} — Get scheduled meeting for a webinar
    // -------------------------------------------------------
    [HttpGet("webinar/{webinarId:long}")]
    public async Task<IActionResult> GetByWebinarId(long webinarId)
    {
        _logger.LogInformation("[MeetingsController] GET /api/meetings/webinar/{WebinarId}", webinarId);

        var meeting = await _meetingService.GetMeetingByWebinarIdAsync(webinarId);
        if (meeting == null)
            return Ok(new { success = false, message = "No meeting scheduled for this webinar.", data = (object?)null });

        return Ok(new { success = true, data = meeting });
    }

    // -------------------------------------------------------
    // POST /api/meetings/regenerate-moderator-link/{webinarId} — Regenerate moderator link
    // -------------------------------------------------------
    [HttpPost("regenerate-moderator-link/{webinarId}")]
    public async Task<IActionResult> RegenerateModeratorLink(long webinarId)
    {
        _logger.LogInformation("[MeetingsController] POST /api/meetings/regenerate-moderator-link/{WebinarId} — CallerUserId: {UserId}",
            webinarId, CallerUserId);

        var (success, message, moderatorJoinUrl) = await _meetingService.RegenerateModeratorLinkAsync(webinarId);
        if (!success)
            return BadRequest(new { success = false, message });

        return Ok(new { success = true, message, moderatorJoinUrl });
    }

    // -------------------------------------------------------
    // POST / GET /api/meetings/ended — Server-to-server callback from BigBlueButton
    // Receives meeting ended ping or analytics payload
    // -------------------------------------------------------
    [AllowAnonymous]
    [HttpGet("ended")]
    [HttpPost("ended")]
    public async Task<IActionResult> MeetingEndedCallback([FromQuery] string? meetingID, [FromQuery] string? meetingId)
    {
        string? targetMeetingId = !string.IsNullOrWhiteSpace(meetingID) ? meetingID : meetingId;
        string? rawBody = null;

        if (Request.ContentLength > 0 || Request.Body.CanRead)
        {
            try
            {
                using var reader = new StreamReader(Request.Body);
                rawBody = await reader.ReadToEndAsync();
            }
            catch { }
        }

        _logger.LogInformation("[MeetingsController] Callback /api/meetings/ended received. TargetMeetingId: '{TargetMeetingId}', BodyLength: {BodyLen}",
            targetMeetingId, rawBody?.Length ?? 0);

        var (success, message, recordedCount) = await _meetingService.ProcessMeetingEndedAsync(targetMeetingId, rawBody);

        return Ok(new
        {
            success,
            message,
            meetingId = targetMeetingId,
            recordedCount
        });
    }
}
