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
        Task<OperationResultDto>         ResetOverridesAsync(int userId, int resetBy);
    }

    public class AccessService : IAccessService
    {
        private readonly string                _connectionString;
        private readonly ILogger<AccessService> _logger;
        private readonly IActivityLogService   _activityLog;

        public AccessService(IConfiguration config, ILogger<AccessService> logger, IActivityLogService activityLog)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
            _activityLog = activityLog;
        }

        // -------------------------------------------------------
        // Full tab matrix for one admin — used by AccessControl page
        // -------------------------------------------------------
        public async Task<IEnumerable<TabMatrixDto>> GetAdminTabMatrixAsync(int userId)
        {
            _logger.LogInformation("[Access] GetAdminTabMatrix called for UserId: {UserId}", userId);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryAsync<TabMatrixDto>(
                    "wms.usp_GetAdminTabMatrix",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );
                var list = result.ToList();
                _logger.LogInformation("[Access] GetAdminTabMatrix returned {Count} tabs for UserId: {UserId}", list.Count, userId);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Access] GetAdminTabMatrix EXCEPTION for UserId {UserId}: {Message}", userId, ex.Message);
                return Enumerable.Empty<TabMatrixDto>();
            }
        }

        // -------------------------------------------------------
        // Toggle a single tab for an admin (MERGE upsert via SP)
        // -------------------------------------------------------
        public async Task<TabOverrideResultDto?> SetTabOverrideAsync(
            int userId, int tabId, bool isAllowed, int grantedBy)
        {
            _logger.LogInformation("[Access] SetTabOverride — UserId: {UserId}, TabId: {TabId}, IsAllowed: {IsAllowed}, GrantedBy: {GrantedBy}",
                userId, tabId, isAllowed, grantedBy);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryFirstOrDefaultAsync<TabOverrideResultDto>(
                    "wms.usp_UpsertUserTabAccess",
                    new { UserId = userId, TabId = tabId, IsAllowed = isAllowed, GrantedBy = grantedBy },
                    commandType: CommandType.StoredProcedure
                );

                if (result != null)
                {
                    _logger.LogInformation("[Access] SetTabOverride SUCCESS — UserId: {UserId}, TabId: {TabId}, Allowed: {IsAllowed}",
                        userId, tabId, isAllowed);

                    // Log activity
                    var actor = await _activityLog.GetActorDetailsAsync(grantedBy);
                    int actorRoleId = actor != null ? (int)actor.RoleId : 1;
                    string actorName = actor != null ? (string)actor.FullName : "System";

                    var target = await _activityLog.GetActorDetailsAsync(userId);
                    string targetEmail = target != null ? (string)target.FullName : $"User {userId}";

                    string oldValStr = (!isAllowed).ToString();
                    string newValStr = isAllowed.ToString();
                    string changes = $"{{\"IsAllowed\":{{\"old\":\"{oldValStr}\",\"new\":\"{newValStr}\"}}}}";

                    await _activityLog.LogActivityAsync(grantedBy, actorName, actorRoleId, "UPDATE", "ACCESS_CONTROL", 
                        $"Modified tab access override for user {targetEmail}: {result.TabName} set to {(isAllowed ? "Allowed" : "Denied")}", changes);
                }
                else
                {
                    _logger.LogWarning("[Access] SetTabOverride returned null — UserId: {UserId}, TabId: {TabId}", userId, tabId);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Access] SetTabOverride EXCEPTION — UserId: {UserId}, TabId: {TabId}: {Message}", userId, tabId, ex.Message);
                return null;
            }
        }

        // -------------------------------------------------------
        // Reset all overrides for an admin → fall back to role defaults
        // -------------------------------------------------------
        public async Task<OperationResultDto> ResetOverridesAsync(int userId, int resetBy)
        {
            _logger.LogWarning("[Access] ResetOverrides called for UserId: {UserId} — all custom tab overrides will be cleared.", userId);
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
                string message = row?.Message ?? "Reset failed";

                if (success)
                {
                    _logger.LogWarning("[Access] ResetOverrides SUCCESS — all tab overrides removed for UserId: {UserId}", userId);

                    // Log activity
                    var actor = await _activityLog.GetActorDetailsAsync(resetBy);
                    int actorRoleId = actor != null ? (int)actor.RoleId : 1;
                    string actorName = actor != null ? (string)actor.FullName : "System";

                    var target = await _activityLog.GetActorDetailsAsync(userId);
                    string targetEmail = target != null ? (string)target.FullName : $"User {userId}";

                    await _activityLog.LogActivityAsync(resetBy, actorName, actorRoleId, "DELETE", "ACCESS_CONTROL", 
                        $"Reset all tab access overrides to role default settings for user {targetEmail}");
                }
                else
                {
                    _logger.LogWarning("[Access] ResetOverrides failed — UserId: {UserId}, Reason: {Reason}", userId, message);
                }

                return new OperationResultDto { Success = success, Message = message };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Access] ResetOverrides EXCEPTION for UserId {UserId}: {Message}", userId, ex.Message);
                return new OperationResultDto { Success = false, Message = "An error occurred" };
            }
        }
    }
}
