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
        _logger.LogInformation("[AccessController] GET /api/access/admins — CallerUserId: {UserId}", CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AccessController] GetAdmins FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var admins = await _adminService.GetAllAdminsAsync();
        _logger.LogInformation("[AccessController] GetAdmins responded 200 — CallerUserId: {UserId}", CallerUserId);
        return Ok(new { success = true, data = admins });
    }

    // -------------------------------------------------------
    // GET /api/access/admins/{userId}/tabs
    // Full tab matrix for one admin (role default + user override + effective)
    // -------------------------------------------------------
    [HttpGet("admins/{userId:int}/tabs")]
    public async Task<IActionResult> GetTabMatrix(int userId)
    {
        _logger.LogInformation("[AccessController] GET /api/access/admins/{TargetId}/tabs — CallerUserId: {UserId}", userId, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AccessController] GetTabMatrix FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        // Verify the target is an admin (not super admin / student)
        var admin = await _adminService.GetAdminByIdAsync(userId);
        if (admin == null)
        {
            _logger.LogWarning("[AccessController] GetTabMatrix — admin not found for TargetId: {TargetId}", userId);
            return NotFound(new { success = false, message = "Admin user not found" });
        }

        var matrix = await _accessService.GetAdminTabMatrixAsync(userId);
        _logger.LogInformation("[AccessController] GetTabMatrix responded 200 — TargetId: {TargetId}", userId);
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
        _logger.LogInformation("[AccessController] PUT /api/access/admins/{TargetId}/tabs/{TabId} — IsAllowed: {IsAllowed}, CallerUserId: {UserId}",
            userId, tabId, request.IsAllowed, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AccessController] SetTabOverride FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var result = await _accessService.SetTabOverrideAsync(
            userId, tabId, request.IsAllowed, CallerUserId);

        if (result == null)
        {
            _logger.LogWarning("[AccessController] SetTabOverride responded 400 — TargetId: {TargetId}, TabId: {TabId}", userId, tabId);
            return BadRequest(new { success = false, message = "Failed to update tab access" });
        }

        _logger.LogInformation("[AccessController] SetTabOverride responded 200 — TargetId: {TargetId}, TabId: {TabId}, IsAllowed: {IsAllowed}",
            userId, tabId, request.IsAllowed);
        return Ok(new { success = true, data = result });
    }

    // -------------------------------------------------------
    // DELETE /api/access/admins/{userId}/overrides
    // Reset ALL overrides for an admin → revert to role defaults
    // -------------------------------------------------------
    [HttpDelete("admins/{userId:int}/overrides")]
    public async Task<IActionResult> ResetOverrides(int userId)
    {
        _logger.LogWarning("[AccessController] DELETE /api/access/admins/{TargetId}/overrides — CallerUserId: {UserId}", userId, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AccessController] ResetOverrides FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var result = await _accessService.ResetOverridesAsync(userId, CallerUserId);

        if (result.Success)
            _logger.LogWarning("[AccessController] ResetOverrides responded 200 — TargetId: {TargetId} overrides cleared.", userId);
        else
            _logger.LogWarning("[AccessController] ResetOverrides responded 400 — TargetId: {TargetId}, Reason: {Reason}", userId, result.Message);

        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }
}
