using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface ITabService
    {
        /// <summary>
        /// Returns the effective allowed tab routes for a user.
        /// Super Admin (1) → all admin tabs.
        /// Student     (3) → all student tabs.
        /// Admin       (2) → DB precedence: UserTabAccess → RoleTabAccess → deny.
        /// Dashboard is always prepended for admin/super-admin (not in DB).
        /// </summary>
        Task<IEnumerable<string>> GetAllowedRoutesAsync(int userId, int roleId);
    }

    public class TabService : ITabService
    {
        private readonly string            _connectionString;
        private readonly ILogger<TabService> _logger;

        public TabService(IConfiguration config, ILogger<TabService> logger)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
        }

        public async Task<IEnumerable<string>> GetAllowedRoutesAsync(int userId, int roleId)
        {
            _logger.LogInformation("[Tabs] GetAllowedRoutes called — UserId: {UserId}, RoleId: {RoleId}", userId, roleId);
            try
            {
                using var conn = new SqlConnection(_connectionString);

                var rows = await conn.QueryAsync<dynamic>(
                    "wms.usp_GetTabsForUser",
                    new { UserId = userId, RoleId = roleId },
                    commandType: CommandType.StoredProcedure
                );

                var routes = rows.Select(r => (string)r.Route).ToList();

                // Dashboard is always allowed for admin roles — it is not stored
                // in wms.Tabs so the sidebar always renders it. Return it first
                // so the frontend can use the list for canAccessTab() checks too.
                if (roleId == 1 || roleId == 2)
                {
                    routes.Insert(0, "/admin/dashboard");
                }

                _logger.LogInformation("[Tabs] GetAllowedRoutes SUCCESS — UserId: {UserId}, RoleId: {RoleId}, Routes granted: {Count} ({Routes})",
                    userId, roleId, routes.Count, string.Join(", ", routes));

                return routes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Tabs] GetAllowedRoutes EXCEPTION for UserId {UserId}, RoleId {RoleId}: {Message}", userId, roleId, ex.Message);
                return Enumerable.Empty<string>();
            }
        }
    }
}
