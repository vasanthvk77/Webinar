using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface IAdminService
    {
        Task<IEnumerable<AdminUserDto>>                               GetAllAdminsAsync();
        Task<AdminUserDto?>                                           GetAdminByIdAsync(int userId);
        Task<(bool success, string message, AdminUserDto? user)>     CreateAdminAsync(CreateAdminRequest request, int createdBy);
        Task<OperationResultDto>                                      UpdateAdminAsync(int userId, UpdateAdminRequest request, int updatedBy);
        Task<OperationResultDto>                                      SetActiveStatusAsync(int userId, bool isActive, int updatedBy);
        Task<OperationResultDto>                                      DeleteAdminAsync(int userId, int deletedBy);
    }

    public class AdminService : IAdminService
    {
        private readonly string               _connectionString;
        private readonly ILogger<AdminService> _logger;
        private readonly IActivityLogService  _activityLog;

        public AdminService(IConfiguration config, ILogger<AdminService> logger, IActivityLogService activityLog)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
            _activityLog = activityLog;
        }

        // -------------------------------------------------------
        // List all Admin users (RoleId = 2)
        // -------------------------------------------------------
        public async Task<IEnumerable<AdminUserDto>> GetAllAdminsAsync()
        {
            _logger.LogInformation("[Admin] GetAllAdmins called.");
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<AdminUserDto>(
                    "wms.usp_GetAllAdmins",
                    commandType: CommandType.StoredProcedure
                );
                var list = rows.ToList();
                _logger.LogInformation("[Admin] GetAllAdmins returned {Count} records.", list.Count);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Admin] GetAllAdmins EXCEPTION: {Message}", ex.Message);
                return Enumerable.Empty<AdminUserDto>();
            }
        }

        // -------------------------------------------------------
        // Get single admin by Id
        // -------------------------------------------------------
        public async Task<AdminUserDto?> GetAdminByIdAsync(int userId)
        {
            _logger.LogInformation("[Admin] GetAdminById called for UserId: {UserId}", userId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<AdminUserDto>(
                    "wms.usp_GetAdminById",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );
                if (result == null)
                    _logger.LogWarning("[Admin] GetAdminById — no admin found for UserId: {UserId}", userId);
                else
                    _logger.LogInformation("[Admin] GetAdminById found: {Email} (UserId: {UserId})", result.Email, userId);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Admin] GetAdminById EXCEPTION for UserId {UserId}: {Message}", userId, ex.Message);
                return null;
            }
        }

        // -------------------------------------------------------
        // Create new Admin — BCrypt hash in C#, SP does the INSERT
        // -------------------------------------------------------
        public async Task<(bool success, string message, AdminUserDto? user)> CreateAdminAsync(
            CreateAdminRequest request, int createdBy)
        {
            _logger.LogInformation("[Admin] CreateAdmin called by UserId: {CreatedBy} for email: {Email}", createdBy, request.Email);
            try
            {
                if (string.IsNullOrWhiteSpace(request.FirstName))
                {
                    _logger.LogWarning("[Admin] CreateAdmin failed — first name is empty.");
                    return (false, "First name is required", null);
                }
                if (string.IsNullOrWhiteSpace(request.Email))
                {
                    _logger.LogWarning("[Admin] CreateAdmin failed — email is empty.");
                    return (false, "Email is required", null);
                }
                if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                {
                    _logger.LogWarning("[Admin] CreateAdmin failed for {Email} — password too short.", request.Email);
                    return (false, "Password must be at least 6 characters", null);
                }

                var hash = BCrypt.Net.BCrypt.HashPassword(request.Password);

                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_CreateAdminUser",
                    new
                    {
                        FirstName    = request.FirstName.Trim(),
                        LastName     = request.LastName?.Trim() ?? "",
                        Email        = request.Email.Trim().ToLower(),
                        PasswordHash = hash,
                        RoleId       = request.RoleId,   // 2=Admin, 1=SuperAdmin
                        CreatedBy    = createdBy
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (row == null)
                {
                    _logger.LogError("[Admin] CreateAdmin DB insert returned null for {Email}.", request.Email);
                    return (false, "Failed to create admin", null);
                }

                // SP returns Id=-1 on duplicate email
                if ((int)row.Id == -1)
                {
                    string errMsg = (string)row.ErrorMessage;
                    _logger.LogWarning("[Admin] CreateAdmin failed — duplicate email: {Email}. SP message: {Msg}", request.Email, errMsg);
                    return (false, errMsg, null);
                }

                var dto = new AdminUserDto
                {
                    Id            = (int)row.Id,
                    FirstName     = (string)row.FirstName,
                    LastName      = (string?)row.LastName,
                    Email         = (string)row.Email,
                    IsActive      = Convert.ToBoolean(row.IsActive),
                    EmailVerified = Convert.ToBoolean(row.EmailVerified),
                    RoleName      = (string)row.RoleName,
                    CreatedAt     = (DateTime)row.CreatedAt,
                    UpdatedAt     = (DateTime?)row.UpdatedAt
                };

                _logger.LogInformation("[Admin] CreateAdmin SUCCESS — NewUserId: {UserId}, Email: {Email}, Role: {Role}, CreatedBy: {CreatedBy}",
                    dto.Id, dto.Email, dto.RoleName, createdBy);

                var actor = await _activityLog.GetActorDetailsAsync(createdBy);
                int actorRoleId = actor != null ? (int)actor.RoleId : 1;
                string actorName = actor != null ? (string)actor.FullName : "System";
                await _activityLog.LogActivityAsync(createdBy, actorName, actorRoleId, "CREATE", "ADMINS", $"Created Admin account: {dto.Email}");

                return (true, "Admin created successfully", dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Admin] CreateAdmin EXCEPTION for {Email}: {Message}", request.Email, ex.Message);
                return (false, "An error occurred while creating admin", null);
            }
        }

        // -------------------------------------------------------
        // Update admin profile (name, email, optional role promotion)
        // -------------------------------------------------------
        public async Task<OperationResultDto> UpdateAdminAsync(
            int userId, UpdateAdminRequest request, int updatedBy)
        {
            _logger.LogInformation("[Admin] UpdateAdmin called for UserId: {UserId} by UserId: {UpdatedBy}", userId, updatedBy);
            try
            {
                var oldAdmin = await GetAdminByIdAsync(userId);

                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_UpdateAdminUser",
                    new
                    {
                        UserId    = userId,
                        FirstName = request.FirstName.Trim(),
                        LastName  = request.LastName?.Trim() ?? "",
                        Email     = request.Email.Trim().ToLower(),
                        UpdatedBy = updatedBy,
                        NewRoleId = request.RoleId   // null = keep current role
                    },
                    commandType: CommandType.StoredProcedure
                );

                bool success = row != null && Convert.ToBoolean(row.Success);
                string message = row?.Message ?? "Update failed";

                if (success)
                {
                    _logger.LogInformation("[Admin] UpdateAdmin SUCCESS — UserId: {UserId}, UpdatedBy: {UpdatedBy}", userId, updatedBy);
                    var newAdmin = await GetAdminByIdAsync(userId);
                    string? changes = AuditHelper.GetChangesJson(oldAdmin!, newAdmin!);

                    var actor = await _activityLog.GetActorDetailsAsync(updatedBy);
                    int actorRoleId = actor != null ? (int)actor.RoleId : 1;
                    string actorName = actor != null ? (string)actor.FullName : "System";
                    await _activityLog.LogActivityAsync(updatedBy, actorName, actorRoleId, "UPDATE", "ADMINS", $"Updated Admin account: {newAdmin?.Email}", changes);
                }
                else
                {
                    _logger.LogWarning("[Admin] UpdateAdmin failed — UserId: {UserId}, Reason: {Reason}", userId, message);
                }

                return new OperationResultDto { Success = success, Message = message };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Admin] UpdateAdmin EXCEPTION for UserId {UserId}: {Message}", userId, ex.Message);
                return new OperationResultDto { Success = false, Message = "An error occurred during update" };
            }
        }

        // -------------------------------------------------------
        // Revoke or grant access (IsActive toggle)
        // -------------------------------------------------------
        public async Task<OperationResultDto> SetActiveStatusAsync(
            int userId, bool isActive, int updatedBy)
        {
            _logger.LogInformation("[Admin] SetActiveStatus called — UserId: {UserId}, IsActive: {IsActive}, UpdatedBy: {UpdatedBy}",
                userId, isActive, updatedBy);
            try
            {
                var oldAdmin = await GetAdminByIdAsync(userId);

                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_SetAdminActiveStatus",
                    new { UserId = userId, IsActive = isActive, UpdatedBy = updatedBy },
                    commandType: CommandType.StoredProcedure
                );

                bool success = row != null && Convert.ToBoolean(row.Success);
                string message = row?.Message ?? "Status update failed";

                if (success)
                {
                    _logger.LogInformation("[Admin] SetActiveStatus SUCCESS — UserId: {UserId} set to IsActive={IsActive} by {UpdatedBy}",
                        userId, isActive, updatedBy);
                    var newAdmin = await GetAdminByIdAsync(userId);
                    string? changes = AuditHelper.GetChangesJson(oldAdmin!, newAdmin!);

                    var actor = await _activityLog.GetActorDetailsAsync(updatedBy);
                    int actorRoleId = actor != null ? (int)actor.RoleId : 1;
                    string actorName = actor != null ? (string)actor.FullName : "System";
                    string statusText = isActive ? "Activated" : "Deactivated";
                    await _activityLog.LogActivityAsync(updatedBy, actorName, actorRoleId, "UPDATE", "ADMINS", $"{statusText} Admin account: {newAdmin?.Email}", changes);
                }
                else
                {
                    _logger.LogWarning("[Admin] SetActiveStatus failed — UserId: {UserId}, Reason: {Reason}", userId, message);
                }

                return new OperationResultDto { Success = success, Message = message };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Admin] SetActiveStatus EXCEPTION for UserId {UserId}: {Message}", userId, ex.Message);
                return new OperationResultDto { Success = false, Message = "An error occurred" };
            }
        }

        // -------------------------------------------------------
        // Hard-delete admin + all their tab overrides
        // -------------------------------------------------------
        public async Task<OperationResultDto> DeleteAdminAsync(int userId, int deletedBy)
        {
            _logger.LogWarning("[Admin] DeleteAdmin called for UserId: {UserId}", userId);
            try
            {
                var targetAdmin = await GetAdminByIdAsync(userId);

                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_DeleteAdminUser",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );

                bool success = row != null && Convert.ToBoolean(row.Success);
                string message = row?.Message ?? "Delete failed";

                if (success)
                {
                    _logger.LogWarning("[Admin] DeleteAdmin SUCCESS — UserId: {UserId} permanently deleted.", userId);
                    var actor = await _activityLog.GetActorDetailsAsync(deletedBy);
                    int actorRoleId = actor != null ? (int)actor.RoleId : 1;
                    string actorName = actor != null ? (string)actor.FullName : "System";
                    await _activityLog.LogActivityAsync(deletedBy, actorName, actorRoleId, "DELETE", "ADMINS", $"Deleted Admin account: {targetAdmin?.Email}");
                }
                else
                {
                    _logger.LogWarning("[Admin] DeleteAdmin failed — UserId: {UserId}, Reason: {Reason}", userId, message);
                }

                return new OperationResultDto { Success = success, Message = message };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Admin] DeleteAdmin EXCEPTION for UserId {UserId}: {Message}", userId, ex.Message);
                return new OperationResultDto { Success = false, Message = "An error occurred during deletion" };
            }
        }
    }
}
