using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

/// <summary>
/// Admin Dashboard — Super Admin & Admin only (RoleId = 1 or 2).
/// Calls wms.sp_AdminDashboard to aggregate high-level analytics,
/// category breakdowns, recent webinars, and participant completions.
/// </summary>
[ApiController]
[Route("api/admin/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(IDashboardService dashboardService, ILogger<DashboardController> logger)
    {
        _dashboardService = dashboardService;
        _logger = logger;
    }

    private int CallerRoleId =>
        int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    [HttpGet]
    public async Task<IActionResult> GetDashboardData()
    {
        _logger.LogInformation("[DashboardController] GET /api/admin/dashboard — CallerUserId: {UserId}, CallerRoleId: {RoleId}", CallerUserId, CallerRoleId);

        if (CallerRoleId != 1 && CallerRoleId != 2)
        {
            _logger.LogWarning("[DashboardController] GetDashboardData FORBIDDEN — CallerUserId: {UserId} is neither SuperAdmin nor Admin", CallerUserId);
            return Forbid();
        }

        try
        {
            var data = await _dashboardService.GetAdminDashboardDataAsync();
            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[DashboardController] GetDashboardData EXCEPTION: {Message}", ex.Message);
            return StatusCode(500, new { success = false, message = "Failed to load dashboard metrics." });
        }
    }
}

