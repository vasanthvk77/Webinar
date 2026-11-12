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

    /// <summary>
    /// Student Dashboard — Personalized metrics, latest registered webinar,
    /// attendance duration per webinar, and certificate counts for the logged-in student.
    /// </summary>
    [HttpGet("/api/student/dashboard")]
    public async Task<IActionResult> GetStudentDashboardData()
    {
        _logger.LogInformation("[DashboardController] GET /api/student/dashboard — CallerUserId: {UserId}, CallerRoleId: {RoleId}", CallerUserId, CallerRoleId);

        if (CallerUserId <= 0)
        {
            _logger.LogWarning("[DashboardController] GetStudentDashboardData UNAUTHORIZED — Invalid CallerUserId");
            return Unauthorized(new { success = false, message = "User identity not found in token." });
        }

        try
        {
            var data = await _dashboardService.GetStudentDashboardDataAsync(CallerUserId);
            return Ok(new { success = true, data });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[DashboardController] GetStudentDashboardData EXCEPTION for StudentId {StudentId}: {Message}", CallerUserId, ex.Message);
            return StatusCode(500, new { success = false, message = "Failed to load student dashboard metrics." });
        }
    }
}

