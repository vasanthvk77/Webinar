using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

/// <summary>
/// Tab access control — Super Admin only.
/// GET  /api/access/admins/{userId}/tabs   → full tab matrix for one admin
/// PUT  /api/access/admins/{userId}/tabs/{tabId} → toggle a tab on/off
/// DELETE /api/access/admins/{userId}/overrides  → reset to role defaults
/// </summary>
[ApiController]
[Route("api/access")]
[Authorize]
public class AccessController : ControllerBase
{
    private readonly IAccessService            _accessService;
    private readonly IAdminService             _adminService;
    private readonly ILogger<AccessController> _logger;

    public AccessController(
        IAccessService accessService,
        IAdminService adminService,
        ILogger<AccessController> logger)
    {
        _accessService = accessService;
        _adminService  = adminService;
        _logger        = logger;
    }

    private int CallerRoleId =>
        int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    // -------------------------------------------------------
    // GET /api/access/admins
    // List all admin users — for the left panel of AccessControl page
    // -------------------------------------------------------
    [HttpGet("admins")]
    public async Task<IActionResult> GetAdmins()
    {
        if (CallerRoleId != 1)
            return Forbid();

        var admins = await _adminService.GetAllAdminsAsync();
        return Ok(new { success = true, data = admins });
    }

    // -------------------------------------------------------
    // GET /api/access/admins/{userId}/tabs
    // Full tab matrix for one admin (role default + user override + effective)
    // -------------------------------------------------------
    [HttpGet("admins/{userId:int}/tabs")]
    public async Task<IActionResult> GetTabMatrix(int userId)
    {
        if (CallerRoleId != 1)
            return Forbid();

        // Verify the target is an admin (not super admin / student)
        var admin = await _adminService.GetAdminByIdAsync(userId);
        if (admin == null)
            return NotFound(new { success = false, message = "Admin user not found" });

        var matrix = await _accessService.GetAdminTabMatrixAsync(userId);
        return Ok(new { success = true, data = matrix });
    }

    // -------------------------------------------------------
    // PUT /api/access/admins/{userId}/tabs/{tabId}
    // Toggle a single tab — upserts UserTabAccess row
    // -------------------------------------------------------
    [HttpPut("admins/{userId:int}/tabs/{tabId:int}")]
    public async Task<IActionResult> SetTabOverride(
        int userId, int tabId, [FromBody] SetTabOverrideRequest request)
    {
        if (CallerRoleId != 1)
            return Forbid();

        var result = await _accessService.SetTabOverrideAsync(
            userId, tabId, request.IsAllowed, CallerUserId);

        if (result == null)
            return BadRequest(new { success = false, message = "Failed to update tab access" });

        return Ok(new { success = true, data = result });
    }

    // -------------------------------------------------------
    // DELETE /api/access/admins/{userId}/overrides
    // Reset ALL overrides for an admin → revert to role defaults
    // -------------------------------------------------------
    [HttpDelete("admins/{userId:int}/overrides")]
    public async Task<IActionResult> ResetOverrides(int userId)
    {
        if (CallerRoleId != 1)
            return Forbid();

        var result = await _accessService.ResetOverridesAsync(userId);
        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }
}
