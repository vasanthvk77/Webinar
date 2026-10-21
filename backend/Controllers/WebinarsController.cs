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
    private readonly CertificateService           _certificateService;
    private readonly ILogger<WebinarsController>  _logger;

    public WebinarsController(IWebinarService webinarService, CertificateService certificateService, ILogger<WebinarsController> logger)
    {
        _webinarService     = webinarService;
        _certificateService = certificateService;
        _logger             = logger;
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
    // GET /api/webinars/upcoming — Condition 1: Upcoming Webinars
    // Returns all webinars with registration status for CallerUserId
    // -------------------------------------------------------
    [HttpGet("upcoming")]
    public async Task<IActionResult> GetUpcoming()
    {
        _logger.LogInformation("[WebinarsController] GET /api/webinars/upcoming — CallerUserId: {UserId}", CallerUserId);

        var webinars = await _webinarService.GetByConditionAsync("UPCOMING", CallerUserId > 0 ? CallerUserId : null);

        return Ok(new { success = true, data = webinars });
    }

    // -------------------------------------------------------
    // GET /api/webinars/registered — Condition 2: Registered Webinars
    // Z+++ Security: Strictly uses authenticated CallerUserId
    // -------------------------------------------------------
    [HttpGet("registered")]
    public async Task<IActionResult> GetRegistered()
    {
        _logger.LogInformation("[WebinarsController] GET /api/webinars/registered — CallerUserId: {UserId}", CallerUserId);

        if (CallerUserId <= 0)
        {
            _logger.LogWarning("[WebinarsController] GetRegistered UNAUTHORIZED — missing or invalid claim");
            return Unauthorized(new { success = false, message = "Authentication required." });
        }

        var webinars = await _webinarService.GetByConditionAsync("REGISTERED", CallerUserId);

        return Ok(new { success = true, data = webinars });
    }

    // -------------------------------------------------------
    // GET /api/webinars/completed — Condition 1 & 2: Completed Webinars
    // Returns completed webinars and certificate eligibility flag
    // -------------------------------------------------------
    [HttpGet("completed")]
    public async Task<IActionResult> GetCompleted()
    {
        _logger.LogInformation("[WebinarsController] GET /api/webinars/completed — CallerUserId: {UserId}", CallerUserId);

        if (CallerUserId <= 0)
            return Unauthorized(new { success = false, message = "Authentication required." });

        var completedWebinars = await _webinarService.GetCompletedWebinarsAsync(CallerUserId);
        return Ok(new { success = true, data = completedWebinars });
    }

    // -------------------------------------------------------
    // GET /api/webinars/{id}/certificate/download — Condition 3: Certificate Download
    // Strict Verification: Checks if student is eligible for certificate before streaming PDF
    // -------------------------------------------------------
    [HttpGet("{id:long}/certificate/download")]
    public async Task<IActionResult> DownloadCertificate(long id)
    {
        _logger.LogInformation("[WebinarsController] DownloadCertificate called for WebinarId: {WebinarId}, UserId: {UserId}", id, CallerUserId);

        if (CallerUserId <= 0)
            return Unauthorized(new { success = false, message = "Authentication required." });

        var results = await _webinarService.GetCompletedWebinarsAsync(CallerUserId, id);
        var item = results.FirstOrDefault();

        if (item == null)
            return NotFound(new { success = false, message = "Webinar completion record not found for this user." });

        if (!item.CanDownloadCertificate)
            return Forbid();

        string templateId = "CertificateTemplate1";
        var req = new CertificateRequest(
            item.ParticipantName,
            item.WebinarName,
            item.WebinarDate,
            !string.IsNullOrWhiteSpace(item.CertificateCode) ? item.CertificateCode : item.CertificateId
        );

        var pdfBytes = _certificateService.GenerateCertificatePdf(templateId, req);
        if (pdfBytes == null)
            return NotFound(new { success = false, message = "Certificate template not found." });

        string safeName = string.Join("_", item.WebinarName.Split(Path.GetInvalidFileNameChars()));
        string fileName = $"{safeName}-Certificate.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    // -------------------------------------------------------
    // GET /api/webinars/public/{shareId} — Public tracking info
    // -------------------------------------------------------
    [HttpGet("public/{shareId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicByShareId(string shareId)
    {
        _logger.LogInformation("[WebinarsController] GET /api/webinars/public/{ShareId}", shareId);

        var webinar = await _webinarService.GetByShareIdAsync(shareId);
        if (webinar == null)
            return NotFound(new { success = false, message = "Webinar not found" });

        return Ok(new { success = true, data = webinar });
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
            ? Ok(new { success = true, message = result.Message })
            : BadRequest(new { success = false, message = result.Message });
    }

    // -------------------------------------------------------
    // POST /api/webinars/{id}/bulk-invite — Super Admin / Admin
    // -------------------------------------------------------
    [HttpPost("{id:long}/bulk-invite")]
    public async Task<IActionResult> BulkInvite(long id)
    {
        _logger.LogInformation("[WebinarsController] BulkInvite called for WebinarId: {Id} by UserId: {UserId}", id, CallerUserId);

        if (CallerRoleId != 1 && CallerRoleId != 2)
        {
            _logger.LogWarning("[WebinarsController] BulkInvite FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
            return Forbid();
        }

        var (success, message, count) = await _webinarService.QueueBulkInvitesAsync(id);

        if (!success)
            return BadRequest(new { success = false, message });

        return Ok(new { success = true, count, message = $"Invites queued successfully for {count} users." });
    }

    // -------------------------------------------------------
    // POST /api/webinars/register-tracking — Authenticated user registers for a webinar
    // -------------------------------------------------------
    [HttpPost("register-tracking")]
    public async Task<IActionResult> RegisterTracking([FromBody] RegisterTrackingRequest request)
    {
        int targetUserId = CallerUserId > 0 ? CallerUserId : (request.UserId ?? 0);
        if (targetUserId <= 0)
            return Unauthorized(new { success = false, message = "User authentication required" });

        if (string.IsNullOrWhiteSpace(request.TrackingId))
            return BadRequest(new { success = false, message = "Tracking ID is required" });

        var (success, message, webinarName) = await _webinarService.RegisterTrackingAsync(request.TrackingId, targetUserId);

        if (!success)
            return BadRequest(new { success = false, message, webinarName });

        return Ok(new { success = true, message, webinarName });
    }

    // -------------------------------------------------------
    // GET /api/webinars/{id}/email-status — Check status of bulk email queue
    // -------------------------------------------------------
    [HttpGet("{id:long}/email-status")]
    public async Task<IActionResult> GetEmailStatus(long id)
    {
        var (isFinished, total, pending, name) = await _webinarService.GetEmailQueueStatusAsync(id);
        return Ok(new { success = true, isFinished, total, pending, webinarName = name });
    }

    // -------------------------------------------------------
    // POST /api/webinars/check-email — Public check if user exists
    // -------------------------------------------------------
    [HttpPost("check-email")]
    [AllowAnonymous]
    public async Task<IActionResult> CheckEmail([FromBody] CheckEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { success = false, message = "Email is required" });

        var result = await _webinarService.CheckEmailAsync(request.Email);
        return Ok(new { success = true, data = result });
    }
}
