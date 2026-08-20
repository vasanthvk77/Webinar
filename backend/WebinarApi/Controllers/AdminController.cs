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
        if (CallerRoleId != 1)
            return Forbid();

        var admins = await _adminService.GetAllAdminsAsync();
        return Ok(new { success = true, data = admins });
    }

    // -------------------------------------------------------
    // POST /api/admin/accounts
    // Create a new Admin user
    // -------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAdminRequest request)
    {
        if (CallerRoleId != 1)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { success = false, message = "Email and password are required" });

        var (success, message, user) = await _adminService.CreateAdminAsync(request, CallerUserId);

        if (!success)
            return BadRequest(new { success = false, message });

        return Ok(new { success = true, message, data = user });
    }

    // -------------------------------------------------------
    // PUT /api/admin/accounts/{id}
    // Update admin name / email
    // -------------------------------------------------------
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAdminRequest request)
    {
        if (CallerRoleId != 1)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { success = false, message = "First name and email are required" });

        var result = await _adminService.UpdateAdminAsync(id, request, CallerUserId);
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
        if (CallerRoleId != 1)
            return Forbid();

        var result = await _adminService.SetActiveStatusAsync(id, request.IsActive, CallerUserId);
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
        if (CallerRoleId != 1)
            return Forbid();

        var result = await _adminService.DeleteAdminAsync(id);
        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }
}
