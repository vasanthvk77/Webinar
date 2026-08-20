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
        Task<OperationResultDto>                                      DeleteAdminAsync(int userId);
    }

    public class AdminService : IAdminService
    {
        private readonly string               _connectionString;
        private readonly ILogger<AdminService> _logger;

        public AdminService(IConfiguration config, ILogger<AdminService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
        }

        // -------------------------------------------------------
        // List all Admin users (RoleId = 2)
        // -------------------------------------------------------
        public async Task<IEnumerable<AdminUserDto>> GetAllAdminsAsync()
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var rows = await conn.QueryAsync<AdminUserDto>(
                    "wms.usp_GetAllAdmins",
                    commandType: CommandType.StoredProcedure
                );
                return rows;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetAllAdmins error");
                return Enumerable.Empty<AdminUserDto>();
            }
        }

        // -------------------------------------------------------
        // Get single admin by Id
        // -------------------------------------------------------
        public async Task<AdminUserDto?> GetAdminByIdAsync(int userId)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                return await conn.QueryFirstOrDefaultAsync<AdminUserDto>(
                    "wms.usp_GetAdminById",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetAdminById error for UserId {UserId}", userId);
                return null;
            }
        }

        // -------------------------------------------------------
        // Create new Admin — BCrypt hash in C#, SP does the INSERT
        // -------------------------------------------------------
        public async Task<(bool success, string message, AdminUserDto? user)> CreateAdminAsync(
            CreateAdminRequest request, int createdBy)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.FirstName))
                    return (false, "First name is required", null);
                if (string.IsNullOrWhiteSpace(request.Email))
                    return (false, "Email is required", null);
                if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                    return (false, "Password must be at least 6 characters", null);

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
                    return (false, "Failed to create admin", null);

                // SP returns Id=-1 on duplicate email
                if ((int)row.Id == -1)
                    return (false, (string)row.ErrorMessage, null);

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

                return (true, "Admin created successfully", dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateAdmin error");
                return (false, "An error occurred while creating admin", null);
            }
        }

        // -------------------------------------------------------
        // Update admin profile (name, email, optional role promotion)
        // -------------------------------------------------------
        public async Task<OperationResultDto> UpdateAdminAsync(
            int userId, UpdateAdminRequest request, int updatedBy)
        {
            try
            {
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

                return new OperationResultDto
                {
                    Success = row != null && Convert.ToBoolean(row.Success),
                    Message = row?.Message ?? "Update failed"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateAdmin error for UserId {UserId}", userId);
                return new OperationResultDto { Success = false, Message = "An error occurred during update" };
            }
        }

        // -------------------------------------------------------
        // Revoke or grant access (IsActive toggle)
        // -------------------------------------------------------
        public async Task<OperationResultDto> SetActiveStatusAsync(
            int userId, bool isActive, int updatedBy)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_SetAdminActiveStatus",
                    new { UserId = userId, IsActive = isActive, UpdatedBy = updatedBy },
                    commandType: CommandType.StoredProcedure
                );

                return new OperationResultDto
                {
                    Success = row != null && Convert.ToBoolean(row.Success),
                    Message = row?.Message ?? "Status update failed"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SetActiveStatus error for UserId {UserId}", userId);
                return new OperationResultDto { Success = false, Message = "An error occurred" };
            }
        }

        // -------------------------------------------------------
        // Hard-delete admin + all their tab overrides
        // -------------------------------------------------------
        public async Task<OperationResultDto> DeleteAdminAsync(int userId)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_DeleteAdminUser",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );

                return new OperationResultDto
                {
                    Success = row != null && Convert.ToBoolean(row.Success),
                    Message = row?.Message ?? "Delete failed"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DeleteAdmin error for UserId {UserId}", userId);
                return new OperationResultDto { Success = false, Message = "An error occurred during deletion" };
            }
        }
    }
}
