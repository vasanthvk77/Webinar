using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

/// <summary>
/// Admin user management — Super Admin only.
/// All endpoints require a valid JWT with RoleId = 1 (Super Admin).
/// </summary>
[ApiController]
[Route("api/admin/accounts")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly IAdminService            _adminService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(IAdminService adminService, ILogger<AdminController> logger)
    {
        _adminService = adminService;
        _logger       = logger;
    }

    // -------------------------------------------------------
    // Helper: read the caller's RoleId from the JWT claim
    // -------------------------------------------------------
    private int CallerRoleId =>
        int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    // -------------------------------------------------------
    // GET /api/admin/accounts
    // Returns list of all Admin users (RoleId=2)
    // -------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        _logger.LogInformation("[AdminController] GET /api/admin/accounts — CallerUserId: {UserId}, CallerRoleId: {RoleId}", CallerUserId, CallerRoleId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AdminController] GetAll FORBIDDEN — CallerUserId: {UserId} does not have SuperAdmin role.", CallerUserId);
            return Forbid();
        }

        var admins = await _adminService.GetAllAdminsAsync();
        _logger.LogInformation("[AdminController] GetAll responded 200 — CallerUserId: {UserId}", CallerUserId);
        return Ok(new { success = true, data = admins });
    }

    // -------------------------------------------------------
    // POST /api/admin/accounts
    // Create a new Admin user
    // -------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAdminRequest request)
    {
        _logger.LogInformation("[AdminController] POST /api/admin/accounts — CallerUserId: {UserId}, NewEmail: {Email}", CallerUserId, request.Email);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AdminController] Create FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            _logger.LogWarning("[AdminController] Create request rejected — missing email or password.");
            return BadRequest(new { success = false, message = "Email and password are required" });
        }

        var (success, message, user) = await _adminService.CreateAdminAsync(request, CallerUserId);

        if (!success)
        {
            _logger.LogWarning("[AdminController] Create responded 400 — {Message}", message);
            return BadRequest(new { success = false, message });
        }

        _logger.LogInformation("[AdminController] Create responded 200 — NewUserId: {UserId}, Email: {Email}", user?.Id, user?.Email);
        return Ok(new { success = true, message, data = user });
    }

    // -------------------------------------------------------
    // PUT /api/admin/accounts/{id}
    // Update admin name / email
    // -------------------------------------------------------
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAdminRequest request)
    {
        _logger.LogInformation("[AdminController] PUT /api/admin/accounts/{TargetId} — CallerUserId: {UserId}", id, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AdminController] Update FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.Email))
        {
            _logger.LogWarning("[AdminController] Update request rejected — missing first name or email for TargetId: {TargetId}", id);
            return BadRequest(new { success = false, message = "First name and email are required" });
        }

        var result = await _adminService.UpdateAdminAsync(id, request, CallerUserId);

        if (result.Success)
            _logger.LogInformation("[AdminController] Update responded 200 — TargetId: {TargetId}", id);
        else
            _logger.LogWarning("[AdminController] Update responded 400 — TargetId: {TargetId}, Reason: {Reason}", id, result.Message);

        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }

    // -------------------------------------------------------
    // PUT /api/admin/accounts/{id}/status
    // Revoke (isActive:false) or grant (isActive:true) access
    // -------------------------------------------------------
    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] SetActiveStatusRequest request)
    {
        _logger.LogInformation("[AdminController] PUT /api/admin/accounts/{TargetId}/status — IsActive: {IsActive}, CallerUserId: {UserId}",
            id, request.IsActive, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AdminController] SetStatus FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var result = await _adminService.SetActiveStatusAsync(id, request.IsActive, CallerUserId);

        if (result.Success)
            _logger.LogInformation("[AdminController] SetStatus responded 200 — TargetId: {TargetId}, IsActive: {IsActive}", id, request.IsActive);
        else
            _logger.LogWarning("[AdminController] SetStatus responded 400 — TargetId: {TargetId}, Reason: {Reason}", id, result.Message);

        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }

    // -------------------------------------------------------
    // DELETE /api/admin/accounts/{id}
    // Hard-delete admin + their tab overrides
    // -------------------------------------------------------
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        _logger.LogWarning("[AdminController] DELETE /api/admin/accounts/{TargetId} — CallerUserId: {UserId}", id, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[AdminController] Delete FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var result = await _adminService.DeleteAdminAsync(id, CallerUserId);

        if (result.Success)
            _logger.LogWarning("[AdminController] Delete responded 200 — TargetId: {TargetId} permanently deleted.", id);
        else
            _logger.LogWarning("[AdminController] Delete responded 400 — TargetId: {TargetId}, Reason: {Reason}", id, result.Message);

        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }
}
