using System.Data;
using System.Globalization;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface IWebinarService
    {
        Task<IEnumerable<WebinarDto>>                                    GetAllAsync();
        Task<IEnumerable<WebinarDto>>                                    GetByConditionAsync(string conditionType, int? studentId = null);
        Task<WebinarDto?>                                                GetByShareIdAsync(string shareId);
        Task<(bool success, string message, WebinarDto? webinar)>        CreateAsync(CreateWebinarRequest request, int createdBy);
        Task<(bool success, string message, WebinarDto? webinar)>        UpdateAsync(long id, UpdateWebinarRequest request, int updatedBy);
        Task<OperationResultDto>                                         DeleteAsync(long id, int deletedBy);
        Task<(bool success, string message, int count)>                  QueueBulkInvitesAsync(long webinarId);
        Task<HoldSeatResponseDto>                                        HoldSeatAsync(string trackingId, int userId);
        Task<(bool success, string message, string? webinarName)>        RegisterTrackingAsync(string trackingId, int userId, string? holdToken = null);
        Task<(bool isFinished, int total, int pending, string? webinarName)> GetEmailQueueStatusAsync(long webinarId);
        Task<CheckEmailResultDto>                                        CheckEmailAsync(string email);
        Task<IEnumerable<CompletedWebinarDto>>                           GetCompletedWebinarsAsync(int userId, long? webinarId = null);
        Task<IEnumerable<ParticipantSummaryDto>>                         GetParticipantsAsync(long? webinarId = null);
        Task<PaymentsSummaryDto>                                         GetPaymentsAsync();
        Task<StudentPaymentsSummaryDto>                                  GetStudentPaymentsAsync(int userId);
        Task<string>                                                     UploadWebinarImageAsync(IFormFile file, string? existingImageUrl = null);
    }

    public class WebinarService : IWebinarService
    {
        private readonly string                  _connectionString;
        private readonly IWebHostEnvironment     _env;
        private readonly ILogger<WebinarService> _logger;

        public WebinarService(IConfiguration config, IWebHostEnvironment env, ILogger<WebinarService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _env    = env;
            _logger = logger;
        }

        // -------------------------------------------------------
        // List all webinars
        // -------------------------------------------------------
        public async Task<IEnumerable<WebinarDto>> GetAllAsync()
        {
            _logger.LogInformation("[Webinar] GetAll called.");
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<WebinarDto>(
                    "wms.usp_GetAllWebinars",
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();
                _logger.LogInformation("[Webinar] GetAll returned {Count} records.", list.Count);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetAll EXCEPTION: {Message}", ex.Message);
                return Enumerable.Empty<WebinarDto>();
            }
        }

        // -------------------------------------------------------
        // Industry-level single SP execution by condition:
        // Condition 1: "UPCOMING"
        // Condition 2: "REGISTERED" (requires studentId)
        // -------------------------------------------------------
        public async Task<IEnumerable<WebinarDto>> GetByConditionAsync(string conditionType, int? studentId = null)
        {
            _logger.LogInformation("[Webinar] GetByConditionAsync called. Condition: {Condition}, StudentId: {StudentId}", conditionType, studentId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<WebinarDto>(
                    "wms.usp_GetWebinarsByCondition",
                    new
                    {
                        ConditionType = conditionType,
                        StudentId     = studentId
                    },
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();
                _logger.LogInformation("[Webinar] GetByConditionAsync returned {Count} records for Condition: {Condition}", list.Count, conditionType);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetByConditionAsync EXCEPTION for Condition {Condition}: {Message}", conditionType, ex.Message);
                return Enumerable.Empty<WebinarDto>();
            }
        }

        // -------------------------------------------------------
        // Certificate Eligibility & Completed Webinars Check
        // Calls: wms.certificateEligibilityCheck
        // -------------------------------------------------------
        public async Task<IEnumerable<CompletedWebinarDto>> GetCompletedWebinarsAsync(int userId, long? webinarId = null)
        {
            _logger.LogInformation("[Webinar] GetCompletedWebinarsAsync called for UserId: {UserId}, WebinarId: {WebinarId}", userId, webinarId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<CompletedWebinarDto>(
                    "wms.certificateEligibilityCheck",
                    new
                    {
                        UserId    = userId,
                        WebinarId = webinarId
                    },
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();
                _logger.LogInformation("[Webinar] GetCompletedWebinarsAsync returned {Count} records for UserId: {UserId}", list.Count, userId);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetCompletedWebinarsAsync EXCEPTION for UserId: {UserId}: {Message}", userId, ex.Message);
                return Enumerable.Empty<CompletedWebinarDto>();
            }
        }

        // -------------------------------------------------------
        // Admin View Participants (Calls: wms.sp_AdminViewParticipants)
        // -------------------------------------------------------
        public async Task<IEnumerable<ParticipantSummaryDto>> GetParticipantsAsync(long? webinarId = null)
        {
            _logger.LogInformation("[Webinar] GetParticipantsAsync called for WebinarId: {WebinarId}", webinarId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<ParticipantSummaryDto>(
                    "wms.GetParticipants",
                    new { WebinarId = webinarId },
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();
                _logger.LogInformation("[Webinar] GetParticipantsAsync returned {Count} participants for WebinarId: {WebinarId}", list.Count, webinarId);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetParticipantsAsync EXCEPTION for WebinarId: {WebinarId}: {Message}", webinarId, ex.Message);
                return Enumerable.Empty<ParticipantSummaryDto>();
            }
        }

        // -------------------------------------------------------
        // Get Webinar Payments & Revenue (Calls: wms.GetPayments)
        // -------------------------------------------------------
        public async Task<PaymentsSummaryDto> GetPaymentsAsync()
        {
            _logger.LogInformation("[Webinar] GetPaymentsAsync called");
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<WebinarPaymentDto>(
                    "wms.GetPayments",
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();

                var summary = new PaymentsSummaryDto
                {
                    TotalRevenue           = list.Sum(w => w.TotalAmount),
                    TotalRegistrations     = list.Sum(w => w.RegistrationCount),
                    TotalPaidRegistrations = list.Where(w => w.IsPaid).Sum(w => w.RegistrationCount),
                    TotalWebinars          = list.Count,
                    TotalPaidWebinars      = list.Count(w => w.IsPaid),
                    TotalFreeWebinars      = list.Count(w => !w.IsPaid),
                    Webinars               = list
                };

                _logger.LogInformation("[Webinar] GetPaymentsAsync returned {Count} records, TotalRevenue: {TotalRevenue}", list.Count, summary.TotalRevenue);
                return summary;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetPaymentsAsync EXCEPTION: {Message}", ex.Message);
                return new PaymentsSummaryDto();
            }
        }

        // -------------------------------------------------------
        // Get Student Payments & Enrolled Webinars (Calls: wms.sp_StudentPaymentDetails)
        // -------------------------------------------------------
        public async Task<StudentPaymentsSummaryDto> GetStudentPaymentsAsync(int userId)
        {
            _logger.LogInformation("[Webinar] GetStudentPaymentsAsync called for UserId: {UserId}", userId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                using var multi = await conn.QueryMultipleAsync(
                    "wms.sp_StudentPaymentDetails",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );

                var summary = await multi.ReadFirstOrDefaultAsync<StudentPaymentsSummaryDto>()
                              ?? new StudentPaymentsSummaryDto { UserId = userId };
                var list = (await multi.ReadAsync<StudentPaymentItemDto>()).ToList();
                summary.Webinars = list;

                _logger.LogInformation("[Webinar] GetStudentPaymentsAsync returned {Count} records for UserId: {UserId}, TotalPaid: {TotalPaid}",
                    list.Count, userId, summary.TotalAmountPaid);
                return summary;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetStudentPaymentsAsync EXCEPTION for UserId: {UserId}: {Message}", userId, ex.Message);
                return new StudentPaymentsSummaryDto { UserId = userId };
            }
        }

        // -------------------------------------------------------
        // Get single webinar by ShareId
        // -------------------------------------------------------
        public async Task<WebinarDto?> GetByShareIdAsync(string shareId)
        {
            _logger.LogInformation("[Webinar] GetByShareId called for {ShareId}", shareId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var webinar = await conn.QueryFirstOrDefaultAsync<WebinarDto>(
                    "wms.usp_GetWebinarByShareId",
                    new { ShareId = shareId.Trim() },
                    commandType: CommandType.StoredProcedure
                );
                return webinar;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetByShareId EXCEPTION for {ShareId}: {Message}", shareId, ex.Message);
                return null;
            }
        }

        // -------------------------------------------------------
        // Create a new webinar
        // -------------------------------------------------------
        public async Task<(bool success, string message, WebinarDto? webinar)> CreateAsync(
            CreateWebinarRequest req, int createdBy)
        {
            _logger.LogInformation("[Webinar] Create called by UserId: {CreatedBy}, Name: {Name}", createdBy, req.WebinarName);
            try
            {
                if (string.IsNullOrWhiteSpace(req.WebinarName))
                    return (false, "Webinar name is required", null);
                if (req.CategoryId <= 0)
                    return (false, "Category is required", null);
                if (req.DurationMinutes <= 0)
                    return (false, "Duration must be greater than 0", null);
                if (req.ParticipantLimit <= 0)
                    return (false, "Participant limit must be greater than 0", null);
                if (req.IsPaid && (req.Price == null || req.Price <= 0))
                    return (false, "Price must be greater than 0 for paid webinars", null);

                var startOffset = DateTimeOffset.Parse(req.StartTime, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
                var endOffset   = DateTimeOffset.Parse(req.EndTime, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);

                var startTimeUtc = startOffset.UtcDateTime;
                var endTimeUtc   = endOffset.UtcDateTime;
                if (endTimeUtc <= startTimeUtc)
                    return (false, "End time must be after start time", null);

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<WebinarDto>(
                    "wms.usp_CreateWebinar",
                    new
                    {
                        WebinarName      = req.WebinarName.Trim(),
                        CategoryId       = req.CategoryId,
                        DurationMinutes  = req.DurationMinutes,
                        WebinarDate      = DateOnly.FromDateTime(startTimeUtc),
                        StartTime        = startTimeUtc,
                        EndTime          = endTimeUtc,
                        ConductorName    = req.ConductorName.Trim(),
                        ConductorPhone   = req.ConductorPhone?.Trim(),
                        ConductorEmail   = req.ConductorEmail?.Trim(),
                        ParticipantLimit = req.ParticipantLimit,
                        IsPaid           = req.IsPaid,
                        Price            = req.IsPaid ? req.Price : (double?)null,
                        CreatedBy        = createdBy,
                        ShareId          = string.IsNullOrWhiteSpace(req.ShareId) ? null : req.ShareId.Trim(),
                        CertificateTempId = req.CertificateTempId,
                        ImageUrl         = string.IsNullOrWhiteSpace(req.ImageUrl) ? null : req.ImageUrl.Trim()
                    },
                    commandType: CommandType.StoredProcedure
                );

                _logger.LogInformation("[Webinar] Created — Id: {Id}, ShareId: {ShareId}", result?.Id, result?.ShareId);
                return (true, "Webinar created successfully", result);
            }
            catch (SqlException ex) when (ex.Message.Contains("not found") || ex.Message.Contains("after start"))
            {
                _logger.LogWarning("[Webinar] Create validation error: {Message}", ex.Message);
                return (false, ex.Message, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] Create EXCEPTION: {Message}", ex.Message);
                return (false, "An unexpected error occurred", null);
            }
        }

        // -------------------------------------------------------
        // Update an existing webinar
        // -------------------------------------------------------
        public async Task<(bool success, string message, WebinarDto? webinar)> UpdateAsync(
            long id, UpdateWebinarRequest req, int updatedBy)
        {
            _logger.LogInformation("[Webinar] Update called — Id: {Id}, UpdatedBy: {UpdatedBy}", id, updatedBy);
            try
            {
                if (string.IsNullOrWhiteSpace(req.WebinarName))
                    return (false, "Webinar name is required", null);
                if (req.CategoryId <= 0)
                    return (false, "Category is required", null);
                if (req.DurationMinutes <= 0)
                    return (false, "Duration must be greater than 0", null);
                if (req.ParticipantLimit <= 0)
                    return (false, "Participant limit must be greater than 0", null);
                if (req.IsPaid && (req.Price == null || req.Price <= 0))
                    return (false, "Price must be greater than 0 for paid webinars", null);

                var startOffset = DateTimeOffset.Parse(req.StartTime, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
                var endOffset   = DateTimeOffset.Parse(req.EndTime, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);

                var startTimeUtc = startOffset.UtcDateTime;
                var endTimeUtc   = endOffset.UtcDateTime;
                if (endTimeUtc <= startTimeUtc)
                    return (false, "End time must be after start time", null);

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<WebinarDto>(
                    "wms.usp_UpdateWebinar",
                    new
                    {
                        Id               = id,
                        WebinarName      = req.WebinarName.Trim(),
                        CategoryId       = req.CategoryId,
                        DurationMinutes  = req.DurationMinutes,
                        WebinarDate      = DateOnly.FromDateTime(startTimeUtc),
                        StartTime        = startTimeUtc,
                        EndTime          = endTimeUtc,
                        ConductorName    = req.ConductorName.Trim(),
                        ConductorPhone   = req.ConductorPhone?.Trim(),
                        ConductorEmail   = req.ConductorEmail?.Trim(),
                        ParticipantLimit = req.ParticipantLimit,
                        IsPaid           = req.IsPaid,
                        Price            = req.IsPaid ? req.Price : (double?)null,
                        UpdatedBy        = updatedBy,
                        CertificateTempId = req.CertificateTempId,
                        ImageUrl         = string.IsNullOrWhiteSpace(req.ImageUrl) ? null : req.ImageUrl.Trim()
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (result == null)
                    return (false, "Webinar not found", null);

                _logger.LogInformation("[Webinar] Updated — Id: {Id}", result.Id);
                return (true, "Webinar updated successfully", result);
            }
            catch (SqlException ex) when (ex.Message.Contains("not found") || ex.Message.Contains("after start"))
            {
                _logger.LogWarning("[Webinar] Update validation error: {Message}", ex.Message);
                return (false, ex.Message, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] Update EXCEPTION: {Message}", ex.Message);
                return (false, "An unexpected error occurred", null);
            }
        }

        // -------------------------------------------------------
        // Upload webinar thumbnail/cover image to Images/WebinarImages
        // -------------------------------------------------------
        public async Task<string> UploadWebinarImageAsync(IFormFile file, string? existingImageUrl = null)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("Uploaded file is empty.");

            if (file.Length > 10 * 1024 * 1024)
                throw new ArgumentException("Webinar image size cannot exceed 10 MB.");

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(ext))
                throw new ArgumentException("Only JPG, JPEG, PNG, and WEBP images are allowed.");

            var rootDir = Directory.GetParent(_env.ContentRootPath)?.FullName ?? _env.ContentRootPath;
            var folderPath = Path.Combine(rootDir, "Images", "WebinarImages");
            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
            }

            // If an existing image path is supplied, delete previous file if it exists in the folder
            if (!string.IsNullOrWhiteSpace(existingImageUrl))
            {
                try
                {
                    var oldFileName = Path.GetFileName(existingImageUrl.Trim());
                    if (!string.IsNullOrWhiteSpace(oldFileName))
                    {
                        var targetOldPath = Path.Combine(folderPath, oldFileName);
                        if (File.Exists(targetOldPath))
                        {
                            File.Delete(targetOldPath);
                            _logger.LogInformation("[WebinarService] Deleted previous webinar image: {Path}", targetOldPath);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[WebinarService] Could not delete old webinar image: {Message}", ex.Message);
                }
            }

            // Unique 8 characters token (e.g. image_d755afa2.png)
            var unique8 = Guid.NewGuid().ToString("N")[..8];
            var newFileName = $"image_{unique8}{ext}";
            var newFilePath = Path.Combine(folderPath, newFileName);

            using (var stream = new FileStream(newFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativeUrl = $"/Images/WebinarImages/{newFileName}";
            _logger.LogInformation("[WebinarService] Saved webinar image at {RelativeUrl}", relativeUrl);
            return relativeUrl;
        }

        // -------------------------------------------------------
        // Delete a webinar
        // -------------------------------------------------------
        public async Task<OperationResultDto> DeleteAsync(long id, int deletedBy)
        {
            _logger.LogInformation("[Webinar] Delete called — Id: {Id}, DeletedBy: {DeletedBy}", id, deletedBy);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_DeleteWebinar",
                    new { Id = id, DeletedBy = deletedBy },
                    commandType: CommandType.StoredProcedure
                );

                if (result == null)
                    return new OperationResultDto { Success = false, Message = "Webinar not found" };

                _logger.LogInformation("[Webinar] Deleted — Id: {Id}", id);
                return new OperationResultDto { Success = true, Message = "Webinar deleted successfully" };
            }
            catch (SqlException ex) when (ex.Message.Contains("not found"))
            {
                _logger.LogWarning("[Webinar] Delete validation error: {Message}", ex.Message);
                return new OperationResultDto { Success = false, Message = ex.Message };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] Delete EXCEPTION: {Message}", ex.Message);
                return new OperationResultDto { Success = false, Message = "An unexpected error occurred" };
            }
        }

        // -------------------------------------------------------
        // Queue bulk email invites for active users
        // -------------------------------------------------------
        public async Task<(bool success, string message, int count)> QueueBulkInvitesAsync(long webinarId)
        {
            _logger.LogInformation("[Webinar] QueueBulkInvites called for WebinarId: {WebinarId}", webinarId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_QueueBulkWebinarInvites",
                    new { WebinarId = webinarId },
                    commandType: CommandType.StoredProcedure
                );

                int count = result?.QueuedCount != null ? (int)result.QueuedCount : 0;
                _logger.LogInformation("[Webinar] QueueBulkInvites queued {Count} emails for WebinarId: {WebinarId}", count, webinarId);
                return (true, "Invites queued successfully", count);
            }
            catch (SqlException ex)
            {
                _logger.LogWarning("[Webinar] QueueBulkInvites SQL error: {Message}", ex.Message);
                return (false, ex.Message, 0);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] QueueBulkInvites EXCEPTION: {Message}", ex.Message);
                return (false, "An error occurred while queueing invitations", 0);
            }
        }

        // -------------------------------------------------------
        // Atomically hold seat for 5 mins (BookMyShow pattern)
        // -------------------------------------------------------
        public async Task<HoldSeatResponseDto> HoldSeatAsync(string trackingId, int userId)
        {
            _logger.LogInformation("[Webinar] HoldSeat called — TrackingId: {TrackingId}, UserId: {UserId}", trackingId, userId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_HoldWebinarSeat",
                    new
                    {
                        TrackingId  = trackingId.Trim(),
                        UserId      = userId,
                        HoldMinutes = 6 // 6 minutes in DB gives 60s grace buffer over 5-minute UI timer
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (row == null)
                {
                    return new HoldSeatResponseDto
                    {
                        Success = false,
                        Message = "Failed to reserve seat. Please try again."
                    };
                }

                return new HoldSeatResponseDto
                {
                    Success          = (int)row.Success == 1,
                    Message          = (string)row.Message,
                    HoldToken        = (string?)row.HoldToken,
                    ExpiresAt        = (DateTime?)row.ExpiresAt,
                    RemainingSeconds = (int)row.RemainingSeconds,
                    WebinarId        = (long)row.WebinarId,
                    WebinarName      = (string?)row.WebinarName,
                    RemainingSlots   = (int)row.RemainingSlots,
                    IsCapacityFull   = (int)row.IsCapacityFull == 1
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] HoldSeat EXCEPTION: {Message}", ex.Message);
                return new HoldSeatResponseDto
                {
                    Success = false,
                    Message = "An error occurred while reserving your seat."
                };
            }
        }

        // -------------------------------------------------------
        // Register user for webinar via trackingId & HoldToken
        // -------------------------------------------------------
        public async Task<(bool success, string message, string? webinarName)> RegisterTrackingAsync(string trackingId, int userId, string? holdToken = null)
        {
            _logger.LogInformation("[Webinar] RegisterTracking called — TrackingId: {TrackingId}, UserId: {UserId}, HoldToken: {HoldToken}", trackingId, userId, holdToken);
            try
            {
                // Generate 8 random characters for CustomUserId label (e.g. "UserId - 69cdf501")
                var randomCode = GenerateRandomCode(8);
                var customUserId = $"UserId - {randomCode}";

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_RegisterUserForWebinar",
                    new
                    {
                        TrackingId   = trackingId.Trim(),
                        UserId       = userId,
                        CustomUserId = customUserId,
                        HoldToken    = string.IsNullOrWhiteSpace(holdToken) ? null : holdToken.Trim()
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (result == null)
                    return (false, "Registration failed", null);

                bool success = (int)result.Success == 1;
                string message = (string)result.Message;
                string? webinarName = (string?)result.WebinarName;

                _logger.LogInformation("[Webinar] User registered result — Success: {Success}, Message: {Message}", success, message);
                return (success, message, webinarName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] RegisterTracking EXCEPTION: {Message}", ex.Message);
                return (false, "An error occurred during webinar registration", null);
            }
        }

        private static string GenerateRandomCode(int length)
        {
            const string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var result = new char[length];
            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            var bytes = new byte[length];
            rng.GetBytes(bytes);
            for (int i = 0; i < length; i++)
            {
                result[i] = chars[bytes[i] % chars.Length];
            }
            return new string(result);
        }

        // -------------------------------------------------------
        // Get email queue status for a webinar
        // -------------------------------------------------------
        public async Task<(bool isFinished, int total, int pending, string? webinarName)> GetEmailQueueStatusAsync(long webinarId)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var status = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_CheckWebinarEmailQueueFinished",
                    new { WebinarId = webinarId },
                    commandType: CommandType.StoredProcedure
                );

                if (status == null)
                    return (false, 0, 0, null);

                bool isFinished = (int)status.IsFinished == 1;
                int total = (int)status.TotalCount;
                int pending = (int)status.PendingCount;
                string? webinarName = (string?)status.WebinarName;

                return (isFinished, total, pending, webinarName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] GetEmailQueueStatus EXCEPTION for {WebinarId}: {Message}", webinarId, ex.Message);
                return (false, 0, 0, null);
            }
        }

        // -------------------------------------------------------
        // Check if an email exists in wms.Users
        // -------------------------------------------------------
        public async Task<CheckEmailResultDto> CheckEmailAsync(string email)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT TOP 1 Id, FirstName, LastName, Email FROM wms.Users WHERE Email = @Email",
                    new { Email = email.Trim().ToLower() }
                );

                if (user != null)
                {
                    return new CheckEmailResultDto
                    {
                        Exists    = true,
                        UserId    = (int)user.Id,
                        FirstName = (string)user.FirstName,
                        LastName  = (string?)user.LastName,
                        Email     = (string)user.Email
                    };
                }

                return new CheckEmailResultDto { Exists = false };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] CheckEmailAsync EXCEPTION for {Email}: {Message}", email, ex.Message);
                return new CheckEmailResultDto { Exists = false };
            }
        }
    }
}
