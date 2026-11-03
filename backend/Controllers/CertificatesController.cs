using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

[ApiController]
[Route("api/certificates")]
[Authorize]
public class CertificatesController : ControllerBase
{
    private readonly CertificateService _certificateService;
    private readonly ILogger<CertificatesController> _logger;

    public CertificatesController(CertificateService certificateService, ILogger<CertificatesController> logger)
    {
        _certificateService = certificateService;
        _logger = logger;
    }

    private int CallerRoleId =>
        int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    // -------------------------------------------------------
    // GET /api/certificates/templates — List all certificate templates from Images folder
    // Requires valid JWT
    // -------------------------------------------------------
    [HttpGet("templates")]
    public IActionResult GetTemplates()
    {
        _logger.LogInformation("[CertificatesController] GetTemplates called by UserId: {UserId}", CallerUserId);
        var templates = _certificateService.GetAvailableTemplates();
        return Ok(new { success = true, data = templates });
    }

    // -------------------------------------------------------
    // GET /api/certificates/templates/{templateId}/preview — Template image preview
    // Requires valid JWT
    // -------------------------------------------------------
    [HttpGet("templates/{templateId}/preview")]
    public IActionResult GetTemplatePreview(string templateId)
    {
        _logger.LogInformation("[CertificatesController] GetTemplatePreview called for TemplateId: {TemplateId} by UserId: {UserId}", templateId, CallerUserId);
        var (bytes, contentType) = _certificateService.GetTemplateImage(templateId);
        if (bytes == null)
            return NotFound(new { success = false, message = "Template preview not found." });

        return File(bytes, contentType);
    }

    // -------------------------------------------------------
    // GET /api/certificates/images/{fileName} — Serve uploaded template / logo image from Images folder
    // Accessible anonymously so <img> tags in React can display assets directly
    // -------------------------------------------------------
    [AllowAnonymous]
    [HttpGet("images/{fileName}")]
    public IActionResult GetUploadedImage(string fileName)
    {
        var safeFileName = Path.GetFileName(fileName);
        var dir = _certificateService.GetImagesDirectory();
        var filePath = Path.Combine(dir, safeFileName);

        if (!System.IO.File.Exists(filePath))
            return NotFound(new { success = false, message = "Image not found." });

        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        var contentType = ext switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return PhysicalFile(filePath, contentType);
    }

    // -------------------------------------------------------
    // GET /api/certificates/templates/{templateId}/download — Download template as PDF using QuestPDF
    // Requires valid JWT (No role check)
    // -------------------------------------------------------
    [HttpGet("templates/{templateId}/download")]
    public IActionResult DownloadTemplatePdf(
        string templateId,
        [FromQuery] string? participantName = null,
        [FromQuery] string? webinarName = null,
        [FromQuery] string? date = null,
        [FromQuery] string? certificateId = null)
    {
        _logger.LogInformation("[CertificatesController] DownloadTemplatePdf called for TemplateId: {TemplateId} by UserId: {UserId}", templateId, CallerUserId);

        CertificateRequest? req = null;
        if (!string.IsNullOrWhiteSpace(participantName) || !string.IsNullOrWhiteSpace(webinarName))
        {
            req = new CertificateRequest(
                participantName,
                webinarName,
                DateTime.TryParse(date, out var parsedDate) ? parsedDate : DateTime.UtcNow,
                certificateId ?? "PDX-WB-" + DateTime.UtcNow.Year + "-0001"
            );
        }

        var pdfBytes = _certificateService.GenerateCertificatePdf(templateId, req);
        if (pdfBytes == null)
            return NotFound(new { success = false, message = "Certificate template not found." });

        string fileName = $"{templateId}-Certificate.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    // -------------------------------------------------------
    // POST /api/certificates/templates/{templateId}/generate — Generate customized PDF via QuestPDF
    // Super Admin & Admin only (RoleId = 1 or 2)
    // -------------------------------------------------------
    [HttpPost("templates/{templateId}/generate")]
    public IActionResult GenerateCustomPdf(string templateId, [FromBody] CertificateRequest request)
    {
        _logger.LogInformation("[CertificatesController] GenerateCustomPdf called for TemplateId: {TemplateId} by UserId: {UserId}, RoleId: {RoleId}",
            templateId, CallerUserId, CallerRoleId);

        if (CallerRoleId != 1 && CallerRoleId != 2)
        {
            _logger.LogWarning("[CertificatesController] GenerateCustomPdf FORBIDDEN — CallerUserId: {UserId}, RoleId: {RoleId}",
                CallerUserId, CallerRoleId);
            return Forbid();
        }

        var pdfBytes = _certificateService.GenerateCertificatePdf(templateId, request);
        if (pdfBytes == null)
            return NotFound(new { success = false, message = "Certificate template not found." });

        string fileName = $"{templateId}-Certificate.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }
}
