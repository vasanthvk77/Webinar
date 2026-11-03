using System.Data;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface ICertificateTemplateService
    {
        Task<IEnumerable<CertificateTemplateDto>> GetAllAsync();
        Task<CertificateTemplateDto?> GetByIdAsync(int id);
        Task<(bool success, string message, int id)> SaveAsync(SaveCertificateTemplateRequest request, int userId);
        Task<(bool success, string message)> DeleteAsync(int id);
        Task<UploadImageResultDto> UploadImageAsync(IFormFile file, string? previousUrl = null);
        bool DeleteImage(string fileUrlOrName);
        string GetImagesDirectory();
    }

    public class CertificateTemplateService : ICertificateTemplateService
    {
        private readonly string _connectionString;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<CertificateTemplateService> _logger;

        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".png", ".jpg", ".jpeg", ".webp"
        };

        public CertificateTemplateService(
            IConfiguration config,
            IWebHostEnvironment env,
            ILogger<CertificateTemplateService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _env = env;
            _logger = logger;
        }

        public string GetImagesDirectory()
        {
            var candidates = new[]
            {
                Path.Combine(_env.ContentRootPath, "Images"),
                Path.Combine(_env.ContentRootPath, "..", "Images"),
                Path.Combine(Directory.GetCurrentDirectory(), "Images"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "Images"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "Images")
            };

            var found = candidates.FirstOrDefault(Directory.Exists);
            if (found != null) return Path.GetFullPath(found);

            var fallback = Path.Combine(_env.ContentRootPath, "..", "Images");
            if (!Directory.Exists(fallback))
            {
                Directory.CreateDirectory(fallback);
            }
            return Path.GetFullPath(fallback);
        }

        public bool DeleteImage(string fileUrlOrName)
        {
            if (string.IsNullOrWhiteSpace(fileUrlOrName)) return false;
            try
            {
                var fileName = Path.GetFileName(fileUrlOrName).Trim();
                if (string.IsNullOrWhiteSpace(fileName)) return false;

                // Protect default seed template from deletion
                if (string.Equals(fileName, "CertificateTemplate1.png", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(fileName, "CertificateTemplate1", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                var dir = GetImagesDirectory();
                var filePath = Path.Combine(dir, fileName);
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                    _logger.LogInformation("[CertificateTemplateService] Deleted previous image: {FileName}", fileName);
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[CertificateTemplateService] Could not delete image {File}: {Message}", fileUrlOrName, ex.Message);
            }
            return false;
        }

        public async Task<IEnumerable<CertificateTemplateDto>> GetAllAsync()
        {
            _logger.LogInformation("[CertificateTemplateService] GetAllAsync called.");
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<CertificateTemplateDto>(
                    "wms.usp_GetCertificateTemplates",
                    commandType: CommandType.StoredProcedure
                );
                return rows.ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CertificateTemplateService] GetAllAsync error: {Message}", ex.Message);
                return Enumerable.Empty<CertificateTemplateDto>();
            }
        }

        public async Task<CertificateTemplateDto?> GetByIdAsync(int id)
        {
            _logger.LogInformation("[CertificateTemplateService] GetByIdAsync called for Id: {Id}", id);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<CertificateTemplateDto>(
                    "wms.usp_GetCertificateTemplateById",
                    new { Id = id },
                    commandType: CommandType.StoredProcedure
                );
                return row;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CertificateTemplateService] GetByIdAsync error: {Message}", ex.Message);
                return null;
            }
        }

        public async Task<(bool success, string message, int id)> SaveAsync(SaveCertificateTemplateRequest request, int userId)
        {
            _logger.LogInformation("[CertificateTemplateService] SaveAsync called for Id: {Id}, Name: {Name}", request.Id, request.CertificateName);
            try
            {
                if (string.IsNullOrWhiteSpace(request.CertificateName))
                    return (false, "Certificate name is required.", 0);

                if (string.IsNullOrWhiteSpace(request.TemplateImageUrl))
                    return (false, "Template background image is required.", 0);

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_UpsertCertificateTemplate",
                    new
                    {
                        Id = request.Id,
                        CertificateName = request.CertificateName.Trim(),
                        TemplateImageUrl = request.TemplateImageUrl.Trim(),
                        LogoCount = request.LogoCount,
                        LogoConfiguration = request.LogoConfiguration,
                        UserId = userId
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (result != null)
                {
                    int templateId = (int)(result.TemplateId ?? request.Id);
                    string msg = result.Message ?? "Saved successfully.";
                    return (true, msg, templateId);
                }

                return (false, "Failed to save certificate template.", 0);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CertificateTemplateService] SaveAsync error: {Message}", ex.Message);
                return (false, ex.Message, 0);
            }
        }

        public async Task<(bool success, string message)> DeleteAsync(int id)
        {
            _logger.LogInformation("[CertificateTemplateService] DeleteAsync called for Id: {Id}", id);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_DeleteCertificateTemplate",
                    new { Id = id },
                    commandType: CommandType.StoredProcedure
                );

                return (true, "Certificate template deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CertificateTemplateService] DeleteAsync error: {Message}", ex.Message);
                return (false, ex.Message);
            }
        }

        public async Task<UploadImageResultDto> UploadImageAsync(IFormFile file, string? previousUrl = null)
        {
            if (file == null || file.Length == 0)
            {
                return new UploadImageResultDto { Success = false, Message = "No file was provided." };
            }

            // 10 MB limit
            const long maxBytes = 10 * 1024 * 1024;
            if (file.Length > maxBytes)
            {
                return new UploadImageResultDto { Success = false, Message = "File size exceeds the 10 MB limit." };
            }

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
            {
                return new UploadImageResultDto
                {
                    Success = false,
                    Message = $"Invalid file format ({ext}). Allowed: PNG, JPG, JPEG, WEBP."
                };
            }

            // Validate Magic Bytes for security
            using (var stream = file.OpenReadStream())
            {
                var header = new byte[8];
                int bytesRead = await stream.ReadAsync(header, 0, header.Length);

                bool isValidImage = false;
                if (bytesRead >= 4)
                {
                    // PNG: 89 50 4E 47
                    if (header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47)
                        isValidImage = true;
                    // JPEG: FF D8
                    else if (header[0] == 0xFF && header[1] == 0xD8)
                        isValidImage = true;
                    // WEBP / RIFF: 52 49 46 46
                    else if (header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46)
                        isValidImage = true;
                }

                if (!isValidImage)
                {
                    return new UploadImageResultDto
                    {
                        Success = false,
                        Message = "File content does not match a valid image format."
                    };
                }
            }

            try
            {
                var dir = GetImagesDirectory();
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                // Sanitize original name and append unique chars suffix
                var originalName = Path.GetFileNameWithoutExtension(file.FileName);
                var cleanName = Regex.Replace(originalName, @"[^a-zA-Z0-9_-]", "_").Trim('_');
                if (string.IsNullOrWhiteSpace(cleanName)) cleanName = "image";

                var uniqueSuffix = Guid.NewGuid().ToString("N")[..8];
                var safeFileName = $"{cleanName}_{uniqueSuffix}{ext}";
                var destinationPath = Path.Combine(dir, safeFileName);

                using (var output = new FileStream(destinationPath, FileMode.Create))
                {
                    await file.CopyToAsync(output);
                }

                // If replacing an existing image, delete the old image file immediately
                if (!string.IsNullOrWhiteSpace(previousUrl))
                {
                    DeleteImage(previousUrl);
                }

                _logger.LogInformation("[CertificateTemplateService] File uploaded successfully: {SafeFileName}", safeFileName);

                var relativeUrl = $"/api/certificates/images/{safeFileName}";

                return new UploadImageResultDto
                {
                    Success = true,
                    Message = "Image uploaded successfully.",
                    FileName = safeFileName,
                    Url = relativeUrl,
                    OriginalName = file.FileName,
                    FileSizeBytes = file.Length
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CertificateTemplateService] Upload error: {Message}", ex.Message);
                return new UploadImageResultDto { Success = false, Message = $"Failed to save file: {ex.Message}" };
            }
        }
    }
}
