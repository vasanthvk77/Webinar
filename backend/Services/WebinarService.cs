using System.Data;
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
        Task<(bool success, string message, string? webinarName)>        RegisterTrackingAsync(string trackingId, int userId);
        Task<(bool isFinished, int total, int pending, string? webinarName)> GetEmailQueueStatusAsync(long webinarId);
        Task<CheckEmailResultDto>                                        CheckEmailAsync(string email);
        Task<IEnumerable<CompletedWebinarDto>>                           GetCompletedWebinarsAsync(int userId, long? webinarId = null);
    }

    public class WebinarService : IWebinarService
    {
        private readonly string                  _connectionString;
        private readonly ILogger<WebinarService> _logger;

        public WebinarService(IConfiguration config, ILogger<WebinarService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
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
        // Calls: dbo.certificateEligibilityCheck
        // -------------------------------------------------------
        public async Task<IEnumerable<CompletedWebinarDto>> GetCompletedWebinarsAsync(int userId, long? webinarId = null)
        {
            _logger.LogInformation("[Webinar] GetCompletedWebinarsAsync called for UserId: {UserId}, WebinarId: {WebinarId}", userId, webinarId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<CompletedWebinarDto>(
                    "dbo.certificateEligibilityCheck",
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

                var startTime = DateTime.Parse(req.StartTime);
                var endTime   = DateTime.Parse(req.EndTime);
                if (endTime <= startTime)
                    return (false, "End time must be after start time", null);

                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<WebinarDto>(
                    "wms.usp_CreateWebinar",
                    new
                    {
                        WebinarName      = req.WebinarName.Trim(),
                        CategoryId       = req.CategoryId,
                        DurationMinutes  = req.DurationMinutes,
                        WebinarDate      = DateOnly.Parse(req.WebinarDate),
                        StartTime        = startTime,
                        EndTime          = endTime,
                        ConductorName    = req.ConductorName.Trim(),
                        ConductorPhone   = req.ConductorPhone?.Trim(),
                        ConductorEmail   = req.ConductorEmail?.Trim(),
                        ParticipantLimit = req.ParticipantLimit,
                        IsPaid           = req.IsPaid,
                        Price            = req.IsPaid ? req.Price : (double?)null,
                        CreatedBy        = createdBy,
                        ShareId          = string.IsNullOrWhiteSpace(req.ShareId) ? null : req.ShareId.Trim()
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

                var startTime = DateTime.Parse(req.StartTime);
                var endTime   = DateTime.Parse(req.EndTime);
                if (endTime <= startTime)
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
                        WebinarDate      = DateOnly.Parse(req.WebinarDate),
                        StartTime        = startTime,
                        EndTime          = endTime,
                        ConductorName    = req.ConductorName.Trim(),
                        ConductorPhone   = req.ConductorPhone?.Trim(),
                        ConductorEmail   = req.ConductorEmail?.Trim(),
                        ParticipantLimit = req.ParticipantLimit,
                        IsPaid           = req.IsPaid,
                        Price            = req.IsPaid ? req.Price : (double?)null,
                        UpdatedBy        = updatedBy
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
        // Register user for webinar via trackingId
        // -------------------------------------------------------
        public async Task<(bool success, string message, string? webinarName)> RegisterTrackingAsync(string trackingId, int userId)
        {
            _logger.LogInformation("[Webinar] RegisterTracking called — TrackingId: {TrackingId}, UserId: {UserId}", trackingId, userId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_RegisterUserForWebinar",
                    new { TrackingId = trackingId.Trim(), UserId = userId },
                    commandType: CommandType.StoredProcedure
                );

                if (result == null)
                    return (false, "Registration failed", null);

                bool success = (int)result.Success == 1;
                string message = (string)result.Message;
                string? webinarName = (string?)result.WebinarName;

                return (success, message, webinarName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Webinar] RegisterTracking EXCEPTION: {Message}", ex.Message);
                return (false, "An error occurred during webinar registration", null);
            }
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
