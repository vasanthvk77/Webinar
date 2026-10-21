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

    // -------------------------------------------------------
    // GET /api/certificates/templates — List all certificate templates from Images folder
    // -------------------------------------------------------
    [HttpGet("templates")]
    public IActionResult GetTemplates()
    {
        _logger.LogInformation("[CertificatesController] GetTemplates called");
        var templates = _certificateService.GetAvailableTemplates();
        return Ok(new { success = true, data = templates });
    }

    // -------------------------------------------------------
    // GET /api/certificates/templates/{templateId}/preview — Template image preview
    // -------------------------------------------------------
    [HttpGet("templates/{templateId}/preview")]
    [AllowAnonymous]
    public IActionResult GetTemplatePreview(string templateId)
    {
        var (bytes, contentType) = _certificateService.GetTemplateImage(templateId);
        if (bytes == null)
            return NotFound(new { success = false, message = "Template preview not found." });

        return File(bytes, contentType);
    }

    // -------------------------------------------------------
    // GET /api/certificates/templates/{templateId}/download — Download template as PDF using QuestPDF
    // -------------------------------------------------------
    [HttpGet("templates/{templateId}/download")]
    public IActionResult DownloadTemplatePdf(
        string templateId,
        [FromQuery] string? participantName = null,
        [FromQuery] string? webinarName = null,
        [FromQuery] string? date = null,
        [FromQuery] string? certificateId = null)
    {
        _logger.LogInformation("[CertificatesController] DownloadTemplatePdf called for TemplateId: {TemplateId}", templateId);

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
    // -------------------------------------------------------
    [HttpPost("templates/{templateId}/generate")]
    public IActionResult GenerateCustomPdf(string templateId, [FromBody] CertificateRequest request)
    {
        _logger.LogInformation("[CertificatesController] GenerateCustomPdf called for TemplateId: {TemplateId}", templateId);

        var pdfBytes = _certificateService.GenerateCertificatePdf(templateId, request);
        if (pdfBytes == null)
            return NotFound(new { success = false, message = "Certificate template not found." });

        string fileName = $"{templateId}-Certificate.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }
}
