using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    // -------------------------------------------------------
    // AuditHelper: Reflection-based dynamic changes diffing
    // -------------------------------------------------------
    public static class AuditHelper
    {
        public static string? GetChangesJson<T>(T oldEntity, T newEntity) where T : class
        {
            if (oldEntity == null || newEntity == null) return null;

            var changes = new Dictionary<string, object>();
            var properties = typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance);

            foreach (var prop in properties)
            {
                // Only compare basic value types, strings, nullable types, enum types
                // Ignore nested custom objects, relational navigation properties, arrays/lists
                var type = prop.PropertyType;
                if (type.IsClass && type != typeof(string)) continue;
                if (type.IsInterface) continue;
                if (typeof(System.Collections.IEnumerable).IsAssignableFrom(type) && type != typeof(string)) continue;

                var oldVal = prop.GetValue(oldEntity);
                var newVal = prop.GetValue(newEntity);

                if (!Equals(oldVal, newVal))
                {
                    // Match format: {"FieldName": {"old": "val", "new": "val"}}
                    changes[prop.Name] = new
                    {
                        old = oldVal?.ToString() ?? "",
                        @new = newVal?.ToString() ?? ""
                    };
                }
            }

            return changes.Count > 0 
                ? JsonSerializer.Serialize(changes) 
                : null;
        }
    }

    public interface IActivityLogService
    {
        Task LogActivityAsync(
            int actorId,
            string actorName,
            int roleId,
            string actionName,
            string moduleName,
            string description,
            string? changes = null,
            string? department = null
        );

        Task<IEnumerable<ActivityLogDto>> GetActivityLogsAsync(
            string? searchQuery,
            int? moduleId,
            int? actionId,
            DateTime? startDate,
            DateTime? endDate,
            int pageNumber,
            int pageSize
        );

        Task<(IEnumerable<ActivityLookupDto> modules, IEnumerable<ActivityLookupDto> actions)> GetActivityLookupsAsync();

        Task<dynamic?> GetActorDetailsAsync(int userId);
    }

    public class ActivityLogService : IActivityLogService
    {
        private readonly string                     _connectionString;
        private readonly ILogger<ActivityLogService> _logger;

        public ActivityLogService(IConfiguration config, ILogger<ActivityLogService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? config["DatabaseConnectionString"]
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
        }

        // -------------------------------------------------------
        // Logs an activity. Automatically resolves lookup IDs in SP.
        // -------------------------------------------------------
        public async Task LogActivityAsync(
            int actorId,
            string actorName,
            int roleId,
            string actionName,
            string moduleName,
            string description,
            string? changes = null,
            string? department = null)
        {
            _logger.LogInformation("[ActivityLog] Writing log — Actor: {Name} (ID: {ActorId}), Action: {Action}, Module: {Module}, Desc: {Desc}",
                actorName, actorId, actionName, moduleName, description);

            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                await conn.ExecuteAsync(
                    "wms.usp_InsertActivityLog",
                    new
                    {
                        ActorId      = actorId,
                        ActorName    = actorName,
                        ActorRole    = roleId,
                        ActionName   = actionName,
                        ModuleName   = moduleName,
                        Description  = description,
                        Changes      = changes,
                        Department   = department
                    },
                    commandType: CommandType.StoredProcedure
                );

                _logger.LogInformation("[ActivityLog] Successfully logged activity.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ActivityLog] Failed to log activity for ActorId {ActorId}: {Message}", actorId, ex.Message);
                // We deliberately swallow logging exceptions so that audit trail failures do not break the main application flow,
                // but we make sure to print it clearly in the server logs.
            }
        }

        // -------------------------------------------------------
        // Retrieves filtered and paginated activity logs for Admin UI
        // -------------------------------------------------------
        public async Task<IEnumerable<ActivityLogDto>> GetActivityLogsAsync(
            string? searchQuery,
            int? moduleId,
            int? actionId,
            DateTime? startDate,
            DateTime? endDate,
            int pageNumber,
            int pageSize)
        {
            _logger.LogInformation("[ActivityLog] GetActivityLogs — Query: {Q}, Module: {Mod}, Action: {Act}, DateRange: {Start} to {End}, Page: {Page}",
                searchQuery, moduleId, actionId, startDate, endDate, pageNumber);

            try
            {
                using var conn = new SqlConnection(_connectionString);
                var result = await conn.QueryAsync<ActivityLogDto>(
                    "wms.usp_GetActivityLogs",
                    new
                    {
                        SearchQuery = string.IsNullOrWhiteSpace(searchQuery) ? null : searchQuery.Trim(),
                        ModuleId    = moduleId,
                        ActionId    = actionId,
                        StartDate   = startDate,
                        EndDate     = endDate,
                        PageNumber  = pageNumber,
                        PageSize    = pageSize
                    },
                    commandType: CommandType.StoredProcedure
                );

                var list = result.ToList();
                _logger.LogInformation("[ActivityLog] GetActivityLogs returned {Count} records.", list.Count);
                return list;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ActivityLog] GetActivityLogs EXCEPTION: {Message}", ex.Message);
                return Enumerable.Empty<ActivityLogDto>();
            }
        }

        // -------------------------------------------------------
        // Retrieves lists of active modules and actions for filter dropdowns
        // -------------------------------------------------------
        public async Task<(IEnumerable<ActivityLookupDto> modules, IEnumerable<ActivityLookupDto> actions)> GetActivityLookupsAsync()
        {
            _logger.LogInformation("[ActivityLog] GetActivityLookups called.");
            try
            {
                using var conn = new SqlConnection(_connectionString);
                using var multi = await conn.QueryMultipleAsync("wms.usp_GetActivityLookups", commandType: CommandType.StoredProcedure);

                var modules = await multi.ReadAsync<ActivityLookupDto>();
                var actions = await multi.ReadAsync<ActivityLookupDto>();

                var moduleList = modules.ToList();
                var actionList = actions.ToList();

                _logger.LogInformation("[ActivityLog] GetActivityLookups retrieved {ModulesCount} modules and {ActionsCount} actions.",
                    moduleList.Count, actionList.Count);

                return (moduleList, actionList);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ActivityLog] GetActivityLookups EXCEPTION: {Message}", ex.Message);
                return (Enumerable.Empty<ActivityLookupDto>(), Enumerable.Empty<ActivityLookupDto>());
            }
        }

        // -------------------------------------------------------
        // Retrieves full name and role details for log actors
        // -------------------------------------------------------
        public async Task<dynamic?> GetActorDetailsAsync(int userId)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);
                return await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_GetAuditActorDetails",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ActivityLogService] GetActorDetailsAsync EXCEPTION for UserId {UserId}: {Message}", userId, ex.Message);
                return null;
            }
        }
    }
}
