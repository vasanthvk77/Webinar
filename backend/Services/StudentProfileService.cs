using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services;

public class StudentProfileService : IStudentProfileService
{
    private readonly string _connectionString;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<StudentProfileService> _logger;

    public StudentProfileService(
        IConfiguration config,
        IWebHostEnvironment env,
        ILogger<StudentProfileService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
            ?? config["DatabaseConnectionString"]
            ?? throw new InvalidOperationException("Connection string not found.");
        _env = env;
        _logger = logger;
    }

    public async Task<StudentProfileDto?> GetProfileAsync(int userId)
    {
        _logger.LogInformation("[StudentProfileService] Fetching profile for UserId: {UserId}", userId);
        try
        {
            using var conn = new SqlConnection(_connectionString);
            var profile = await conn.QueryFirstOrDefaultAsync<StudentProfileDto>(
                "wms.sp_GetStudentProfile",
                new { UserId = userId },
                commandType: CommandType.StoredProcedure
            );

            return profile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[StudentProfileService] Error in GetProfileAsync for UserId: {UserId}", userId);
            throw;
        }
    }

    public async Task<StudentProfileDto?> UpdateProfileAsync(int userId, UpdateStudentProfileRequest request)
    {
        _logger.LogInformation("[StudentProfileService] Updating profile for UserId: {UserId}", userId);
        try
        {
            using var conn = new SqlConnection(_connectionString);
            var updated = await conn.QueryFirstOrDefaultAsync<StudentProfileDto>(
                "wms.sp_UpdateStudentProfile",
                new
                {
                    UserId = userId,
                    FirstName = request.FirstName?.Trim(),
                    LastName = string.IsNullOrWhiteSpace(request.LastName) ? null : request.LastName.Trim(),
                    MobileNumber = string.IsNullOrWhiteSpace(request.MobileNumber) ? null : request.MobileNumber.Trim(),
                    CountryCode = string.IsNullOrWhiteSpace(request.CountryCode) ? null : request.CountryCode.Trim(),
                    Gender = request.Gender,
                    ProfileUrl = string.IsNullOrWhiteSpace(request.ProfileUrl) ? null : request.ProfileUrl.Trim(),
                    Year = string.IsNullOrWhiteSpace(request.Year) ? null : request.Year.Trim(),
                    Department = string.IsNullOrWhiteSpace(request.Department) ? null : request.Department.Trim()
                },
                commandType: CommandType.StoredProcedure
            );

            return updated;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[StudentProfileService] Error in UpdateProfileAsync for UserId: {UserId}", userId);
            throw;
        }
    }

    public async Task<string> UploadProfileImageAsync(int userId, IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("Uploaded file is empty.");
        }

        // Limit file size to 5MB
        if (file.Length > 5 * 1024 * 1024)
        {
            throw new ArgumentException("Profile photo size cannot exceed 5 MB.");
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
        {
            throw new ArgumentException("Only JPG, JPEG, PNG, and WEBP images are allowed.");
        }

        // 1. Root -> Images -> StudentProfileImages
        var rootDir = Directory.GetParent(_env.ContentRootPath)?.FullName ?? _env.ContentRootPath;
        var folderPath = Path.Combine(rootDir, "Images", "StudentProfileImages");
        if (!Directory.Exists(folderPath))
        {
            Directory.CreateDirectory(folderPath);
        }

        using (var conn = new SqlConnection(_connectionString))
        {
            // 2. Fetch and delete existing previous profile image file if exists
            var existingProfileUrl = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT ProfileUrl FROM wms.Users WHERE Id = @UserId",
                new { UserId = userId }
            );

            if (!string.IsNullOrWhiteSpace(existingProfileUrl))
            {
                try
                {
                    var oldFileName = Path.GetFileName(existingProfileUrl.Trim());
                    if (!string.IsNullOrWhiteSpace(oldFileName))
                    {
                        var targetOldPath = Path.Combine(folderPath, oldFileName);
                        if (File.Exists(targetOldPath))
                        {
                            File.Delete(targetOldPath);
                            _logger.LogInformation("[StudentProfileService] Deleted previous avatar file: {Path}", targetOldPath);
                        }

                        // Also clean from legacy backend folder if previously placed there
                        var legacyOldPath = Path.Combine(_env.ContentRootPath, "StudentProfileImages", oldFileName);
                        if (File.Exists(legacyOldPath))
                        {
                            File.Delete(legacyOldPath);
                            _logger.LogInformation("[StudentProfileService] Deleted legacy avatar file: {Path}", legacyOldPath);
                        }
                    }
                }
                catch (Exception deleteEx)
                {
                    _logger.LogWarning(deleteEx, "[StudentProfileService] Could not delete old avatar: {Message}", deleteEx.Message);
                }
            }

            // 3. Generate 8 unique characters (e.g. 7f8a9b1c)
            var unique8 = Guid.NewGuid().ToString("N")[..8];
            var newFileName = $"profile_{unique8}{ext}";
            var newFilePath = Path.Combine(folderPath, newFileName);

            using (var stream = new FileStream(newFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativeUrl = $"/Images/StudentProfileImages/{newFileName}";
            _logger.LogInformation("[StudentProfileService] Saved avatar for UserId {UserId} at {RelativeUrl}", userId, relativeUrl);

            // 4. Update database ProfileUrl with new image path
            await conn.ExecuteAsync(
                "UPDATE wms.Users SET ProfileUrl = @Url, UpdatedAt = GETUTCDATE() WHERE Id = @UserId",
                new { Url = relativeUrl, UserId = userId }
            );

            return relativeUrl;
        }
    }
}

