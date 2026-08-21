using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

/// <summary>
/// Returns the list of allowed tab routes for the currently authenticated user.
/// Called once after login to populate AuthContext.allowedTabs on the frontend.
///
/// GET /api/tabs
///   → reads UserId + RoleId from the JWT claims
///   → calls wms.usp_GetTabsForUser
///   → returns { success, routes: ["/admin/webinars", ...] }
/// </summary>
[ApiController]
[Route("api/tabs")]
[Authorize]
public class TabsController : ControllerBase
{
    private readonly ITabService            _tabService;
    private readonly ILogger<TabsController> _logger;

    public TabsController(ITabService tabService, ILogger<TabsController> logger)
    {
        _tabService = tabService;
        _logger     = logger;
    }

    /// <summary>
    /// GET /api/tabs
    /// Returns the caller's effective allowed routes.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyTabs()
    {
        // Read claims embedded in the JWT
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
            !int.TryParse(User.FindFirstValue("RoleId"), out var roleId))
        {
            _logger.LogWarning("[TabsController] GET /api/tabs — invalid or missing JWT claims.");
            return Unauthorized(new { success = false, message = "Invalid token claims" });
        }

        _logger.LogInformation("[TabsController] GET /api/tabs — UserId: {UserId}, RoleId: {RoleId}", userId, roleId);

        var routes = await _tabService.GetAllowedRoutesAsync(userId, roleId);

        _logger.LogInformation("[TabsController] GET /api/tabs responded 200 — UserId: {UserId}, {Count} routes returned.", userId, routes.Count());
        return Ok(new { success = true, routes });
    }
}
