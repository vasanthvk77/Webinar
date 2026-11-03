using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers
{
    [ApiController]
    [Route("api/certificate-templates")]
    [Authorize]
    public class CertificateTemplatesController : ControllerBase
    {
        private readonly ICertificateTemplateService _templateService;
        private readonly ILogger<CertificateTemplatesController> _logger;

        public CertificateTemplatesController(
            ICertificateTemplateService templateService,
            ILogger<CertificateTemplatesController> logger)
        {
            _templateService = templateService;
            _logger = logger;
        }

        private int CallerRoleId =>
            int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

        private int CallerUserId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

        private bool IsAdmin => CallerRoleId == 1 || CallerRoleId == 2;

        // -------------------------------------------------------
        // GET /api/certificate-templates — Get all active templates (Admin only)
        // -------------------------------------------------------
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            _logger.LogInformation("[CertificateTemplatesController] GET /api/certificate-templates — CallerUserId: {UserId}", CallerUserId);

            if (!IsAdmin)
            {
                _logger.LogWarning("[CertificateTemplatesController] GetAll FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
                return Forbid();
            }

            var templates = await _templateService.GetAllAsync();
            return Ok(new { success = true, data = templates });
        }

        // -------------------------------------------------------
        // GET /api/certificate-templates/{id} — Get single template by ID
        // -------------------------------------------------------
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            _logger.LogInformation("[CertificateTemplatesController] GET /api/certificate-templates/{Id} — CallerUserId: {UserId}", id, CallerUserId);

            if (!IsAdmin)
            {
                _logger.LogWarning("[CertificateTemplatesController] GetById FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
                return Forbid();
            }

            var template = await _templateService.GetByIdAsync(id);
            if (template == null)
            {
                return NotFound(new { success = false, message = "Certificate template not found." });
            }

            return Ok(new { success = true, data = template });
        }

        // -------------------------------------------------------
        // POST /api/certificate-templates — Create a new template
        // -------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SaveCertificateTemplateRequest request)
        {
            _logger.LogInformation("[CertificateTemplatesController] POST /api/certificate-templates — CallerUserId: {UserId}, Name: {Name}",
                CallerUserId, request.CertificateName);

            if (!IsAdmin)
            {
                _logger.LogWarning("[CertificateTemplatesController] Create FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
                return Forbid();
            }

            request.Id = 0; // ensure insert
            var (success, message, id) = await _templateService.SaveAsync(request, CallerUserId);

            if (!success)
            {
                return BadRequest(new { success = false, message });
            }

            return Ok(new { success = true, message, id });
        }

        // -------------------------------------------------------
        // PUT /api/certificate-templates/{id} — Update an existing template
        // -------------------------------------------------------
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] SaveCertificateTemplateRequest request)
        {
            _logger.LogInformation("[CertificateTemplatesController] PUT /api/certificate-templates/{Id} — CallerUserId: {UserId}",
                id, CallerUserId);

            if (!IsAdmin)
            {
                _logger.LogWarning("[CertificateTemplatesController] Update FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
                return Forbid();
            }

            request.Id = id;
            var (success, message, updatedId) = await _templateService.SaveAsync(request, CallerUserId);

            if (!success)
            {
                return BadRequest(new { success = false, message });
            }

            return Ok(new { success = true, message, id = updatedId });
        }

        // -------------------------------------------------------
        // DELETE /api/certificate-templates/{id} — Soft-delete a template
        // -------------------------------------------------------
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            _logger.LogInformation("[CertificateTemplatesController] DELETE /api/certificate-templates/{Id} — CallerUserId: {UserId}",
                id, CallerUserId);

            if (!IsAdmin)
            {
                _logger.LogWarning("[CertificateTemplatesController] Delete FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
                return Forbid();
            }

            var (success, message) = await _templateService.DeleteAsync(id);

            if (!success)
            {
                return BadRequest(new { success = false, message });
            }

            return Ok(new { success = true, message });
        }

        // -------------------------------------------------------
        // POST /api/certificate-templates/upload-image — Upload template bg or logo image
        // -------------------------------------------------------
        [HttpPost("upload-image")]
        [RequestSizeLimit(15 * 1024 * 1024)] // 15 MB
        public async Task<IActionResult> UploadImage([FromForm] IFormFile? file, [FromForm] string? previousUrl = null)
        {
            _logger.LogInformation("[CertificateTemplatesController] UploadImage called by CallerUserId: {UserId}, previousUrl: {PreviousUrl}",
                CallerUserId, previousUrl);

            if (!IsAdmin)
            {
                _logger.LogWarning("[CertificateTemplatesController] UploadImage FORBIDDEN — CallerUserId: {UserId}", CallerUserId);
                return Forbid();
            }

            if (file == null)
            {
                return BadRequest(new { success = false, message = "Please select a file to upload." });
            }

            var result = await _templateService.UploadImageAsync(file, previousUrl);

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(new
            {
                success = true,
                message = result.Message,
                fileName = result.FileName,
                url = result.Url,
                originalName = result.OriginalName,
                fileSizeBytes = result.FileSizeBytes
            });
        }

        // -------------------------------------------------------
        // DELETE /api/certificate-templates/images — Delete an image from Images folder
        // -------------------------------------------------------
        [HttpDelete("images")]
        public IActionResult DeleteImage([FromQuery] string fileName)
        {
            _logger.LogInformation("[CertificateTemplatesController] DeleteImage called for {FileName} by CallerUserId: {UserId}",
                fileName, CallerUserId);

            if (!IsAdmin)
            {
                return Forbid();
            }

            var deleted = _templateService.DeleteImage(fileName);
            return Ok(new { success = deleted, message = deleted ? "Image deleted successfully." : "Image not found or protected." });
        }
    }
}
