using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers
{
    [ApiController]
    public class CalendarController : ControllerBase
    {
        private readonly IGoogleCalendarService _calendarService;
        private readonly ILogger<CalendarController> _logger;

        public CalendarController(
            IGoogleCalendarService calendarService,
            ILogger<CalendarController> logger)
        {
            _calendarService = calendarService;
            _logger = logger;
        }

        private int CallerUserId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

        /// <summary>
        /// POST /api/calendar/add-event
        /// Adds a webinar event to student's Google Calendar with 4h, 2h, and 30m reminders.
        /// </summary>
        [HttpPost("api/calendar/add-event")]
        [Authorize]
        public async Task<IActionResult> AddEvent([FromBody] AddCalendarEventRequest request)
        {
            if (CallerUserId <= 0)
            {
                return Unauthorized(new { success = false, message = "Authentication required." });
            }

            if (request == null || request.WebinarId <= 0)
            {
                return BadRequest(new { success = false, message = "Valid WebinarId is required." });
            }

            _logger.LogInformation("[CalendarController] AddEvent requested by User {UserId} for Webinar {WebinarId}", CallerUserId, request.WebinarId);
            var result = await _calendarService.AddWebinarToCalendarAsync(CallerUserId, request.WebinarId, request.TimeZone);

            return Ok(result);
        }

        /// <summary>
        /// GET /api/calendar/auth-url
        /// Gets the Google Calendar consent URL.
        /// </summary>
        [HttpGet("api/calendar/auth-url")]
        [Authorize]
        public IActionResult GetAuthUrl([FromQuery] long webinarId)
        {
            if (CallerUserId <= 0)
            {
                return Unauthorized(new { success = false, message = "Authentication required." });
            }

            var url = _calendarService.GetAuthorizationUrl(CallerUserId, webinarId);
            return Ok(new { success = true, authUrl = url });
        }

        /// <summary>
        /// Handles Google OAuth redirect callback
        /// </summary>
        [HttpGet("api/calendar/callback")]
        [AllowAnonymous]
        public async Task<IActionResult> HandleGoogleCallback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
        {
            // If visited at root without OAuth code, serve standard API status
            if (string.IsNullOrWhiteSpace(code))
            {
                if (!string.IsNullOrWhiteSpace(error))
                {
                    return Content($"<h3>Google Authorization Error: {error}</h3>", "text/html");
                }
                return Ok(new { status = "WebinarApi Online", timestamp = System.DateTime.UtcNow });
            }

            _logger.LogInformation("[CalendarController] Received Google OAuth code callback");
            var (success, message, htmlRedirect) = await _calendarService.HandleCallbackAsync(code, state);

            if (success && !string.IsNullOrWhiteSpace(htmlRedirect))
            {
                return Content(htmlRedirect, "text/html");
            }

            return BadRequest(new { success, message });
        }
    }
}

