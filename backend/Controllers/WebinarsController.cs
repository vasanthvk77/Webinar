using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

[ApiController]
[Route("api/webinars")]
[Authorize]
public class WebinarsController : ControllerBase
{
    private readonly IWebinarService              _webinarService;
    private readonly ILogger<WebinarsController>  _logger;

    public WebinarsController(IWebinarService webinarService, ILogger<WebinarsController> logger)
    {
        _webinarService = webinarService;
        _logger         = logger;
    }

    private int CallerRoleId =>
        int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

    // INT — matches wms.Users.Id (INT)
    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    // -------------------------------------------------------
    // GET /api/webinars — all admins
    // -------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        _logger.LogInformation("[WebinarsController] GET /api/webinars — CallerUserId: {UserId}", CallerUserId);

        var webinars = await _webinarService.GetAllAsync();

        _logger.LogInformation("[WebinarsController] GetAll responded 200 — CallerUserId: {UserId}", CallerUserId);
        return Ok(new { success = true, data = webinars });
    }

    // -------------------------------------------------------
    // POST /api/webinars — Super Admin only
    // -------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWebinarRequest request)
    {
        _logger.LogInformation("[WebinarsController] POST /api/webinars — CallerUserId: {UserId}, Name: {Name}", CallerUserId, request.WebinarName);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[WebinarsController] Create FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var (success, message, webinar) = await _webinarService.CreateAsync(request, CallerUserId);

        if (!success)
        {
            _logger.LogWarning("[WebinarsController] Create responded 400 — {Message}", message);
            return BadRequest(new { success = false, message });
        }

        _logger.LogInformation("[WebinarsController] Create responded 200 — NewId: {Id}", webinar?.Id);
        return Ok(new { success = true, message, data = webinar });
    }

    // -------------------------------------------------------
    // PUT /api/webinars/{id} — Super Admin only
    // -------------------------------------------------------
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateWebinarRequest request)
    {
        _logger.LogInformation("[WebinarsController] PUT /api/webinars/{Id} — CallerUserId: {UserId}", id, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[WebinarsController] Update FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var (success, message, webinar) = await _webinarService.UpdateAsync(id, request, CallerUserId);

        if (!success)
        {
            _logger.LogWarning("[WebinarsController] Update responded 400 — {Message}", message);
            return BadRequest(new { success = false, message });
        }

        _logger.LogInformation("[WebinarsController] Update responded 200 — Id: {Id}", id);
        return Ok(new { success = true, message, data = webinar });
    }

    // -------------------------------------------------------
    // DELETE /api/webinars/{id} — Super Admin only
    // -------------------------------------------------------
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        _logger.LogWarning("[WebinarsController] DELETE /api/webinars/{Id} — CallerUserId: {UserId}", id, CallerUserId);

        if (CallerRoleId != 1)
        {
            _logger.LogWarning("[WebinarsController] Delete FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var result = await _webinarService.DeleteAsync(id, CallerUserId);

        if (result.Success)
            _logger.LogWarning("[WebinarsController] Delete responded 200 — Id: {Id} deleted.", id);
        else
            _logger.LogWarning("[WebinarsController] Delete responded 400 — Id: {Id}, Reason: {Reason}", id, result.Message);

        return result.Success
            ? Ok(new { success = true, result.Message })
            : BadRequest(new { success = false, result.Message });
    }
}
