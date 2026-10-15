using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using WebinarApi.Services;

namespace WebinarApi.Controllers
{
    // -------------------------------------------------------
    // Controller: System Activity Log audit trail endpoint
    // Super Admin (RoleId = 1) access only.
    // -------------------------------------------------------
    [ApiController]
    [Route("api/activity-logs")]
    [Authorize]
    public class ActivityLogController : ControllerBase
    {
        private readonly IActivityLogService            _logService;
        private readonly ILogger<ActivityLogController> _logger;

        public ActivityLogController(IActivityLogService logService, ILogger<ActivityLogController> logger)
        {
            _logService = logService;
            _logger     = logger;
        }

        private int CallerRoleId =>
            int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

        private int CallerUserId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

        // -------------------------------------------------------
        // GET /api/activity-logs
        // Paginated & Filtered activity trail query
        // -------------------------------------------------------
        [HttpGet]
        public async Task<IActionResult> GetLogs(
            [FromQuery] string? searchQuery,
            [FromQuery] int? moduleId,
            [FromQuery] int? actionId,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 25)
        {
            _logger.LogInformation("[ActivityLogController] GET /api/activity-logs — CallerUserId: {UserId}, RoleId: {RoleId}", CallerUserId, CallerRoleId);

            if (CallerRoleId != 1)
            {
                _logger.LogWarning("[ActivityLogController] GetLogs FORBIDDEN — CallerUserId: {UserId} does not have SuperAdmin permission.", CallerUserId);
                return Forbid();
            }

            var logs = await _logService.GetActivityLogsAsync(
                searchQuery, moduleId, actionId, startDate, endDate, pageNumber, pageSize
            );

            return Ok(new { success = true, data = logs });
        }

        // -------------------------------------------------------
        // GET /api/activity-logs/lookups
        // Dropdown option sets for frontend filters
        // -------------------------------------------------------
        [HttpGet("lookups")]
        public async Task<IActionResult> GetLookups()
        {
            _logger.LogInformation("[ActivityLogController] GET /api/activity-logs/lookups — CallerUserId: {UserId}", CallerUserId);

            if (CallerRoleId != 1)
            {
                _logger.LogWarning("[ActivityLogController] GetLookups FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
                return Forbid();
            }

            var (modules, actions) = await _logService.GetActivityLookupsAsync();
            return Ok(new { success = true, data = new { modules, actions } });
        }
    }
}
