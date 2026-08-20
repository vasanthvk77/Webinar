using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface IAccessService
    {
        Task<IEnumerable<TabMatrixDto>>  GetAdminTabMatrixAsync(int userId);
        Task<TabOverrideResultDto?>      SetTabOverrideAsync(int userId, int tabId, bool isAllowed, int grantedBy);
        Task<OperationResultDto>         ResetOverridesAsync(int userId);
    }

    public class AccessService : IAccessService
    {
        private readonly string                _connectionString;
        private readonly ILogger<AccessService> _logger;

        public AccessService(IConfiguration config, ILogger<AccessService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
        }

        // -------------------------------------------------------
        // Full tab matrix for one admin — used by AccessControl page
        // -------------------------------------------------------
        public async Task<IEnumerable<TabMatrixDto>> GetAdminTabMatrixAsync(int userId)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                return await conn.QueryAsync<TabMatrixDto>(
                    "wms.usp_GetAdminTabMatrix",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetAdminTabMatrix error for UserId {UserId}", userId);
                return Enumerable.Empty<TabMatrixDto>();
            }
        }

        // -------------------------------------------------------
        // Toggle a single tab for an admin (MERGE upsert via SP)
        // -------------------------------------------------------
        public async Task<TabOverrideResultDto?> SetTabOverrideAsync(
            int userId, int tabId, bool isAllowed, int grantedBy)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                return await conn.QueryFirstOrDefaultAsync<TabOverrideResultDto>(
                    "wms.usp_UpsertUserTabAccess",
                    new { UserId = userId, TabId = tabId, IsAllowed = isAllowed, GrantedBy = grantedBy },
                    commandType: CommandType.StoredProcedure
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SetTabOverride error UserId {UserId} TabId {TabId}", userId, tabId);
                return null;
            }
        }

        // -------------------------------------------------------
        // Reset all overrides for an admin → fall back to role defaults
        // -------------------------------------------------------
        public async Task<OperationResultDto> ResetOverridesAsync(int userId)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_ResetUserTabOverrides",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );

                // Dapper maps SQL BIT/INT 1/0 as int on dynamic, cast safely
                bool success = row != null && Convert.ToBoolean(row.Success);
                return new OperationResultDto
                {
                    Success = success,
                    Message = row?.Message ?? "Reset failed"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ResetOverrides error for UserId {UserId}", userId);
                return new OperationResultDto { Success = false, Message = "An error occurred" };
            }
        }
    }
}
