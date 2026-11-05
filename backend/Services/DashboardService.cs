using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services;

public class DashboardService : IDashboardService
{
    private readonly string _connectionString;
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(IConfiguration config, ILogger<DashboardService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
            ?? config["DatabaseConnectionString"]
            ?? throw new InvalidOperationException("Connection string not found.");
        _logger = logger;
    }

    public async Task<AdminDashboardResponseDto> GetAdminDashboardDataAsync()
    {
        _logger.LogInformation("[DashboardService] GetAdminDashboardDataAsync called.");
        var response = new AdminDashboardResponseDto();

        try
        {
            using var conn = new SqlConnection(_connectionString);
            using var multi = await conn.QueryMultipleAsync(
                "wms.sp_AdminDashboard",
                commandType: CommandType.StoredProcedure
            );

            // 1. Summary KPI Metrics
            if (!multi.IsConsumed)
            {
                var summary = await multi.ReadFirstOrDefaultAsync<AdminDashboardStatsDto>();
                if (summary != null)
                {
                    response.Summary = summary;
                }
            }

            // 2. Category Breakdown
            if (!multi.IsConsumed)
            {
                var categories = await multi.ReadAsync<DashboardCategoryDto>();
                response.Categories = categories.ToList();
            }

            // 3. Recent Webinars
            if (!multi.IsConsumed)
            {
                var webinars = await multi.ReadAsync<DashboardRecentWebinarDto>();
                response.RecentWebinars = webinars.ToList();
            }

            // 4. Recent Participants
            if (!multi.IsConsumed)
            {
                var participants = await multi.ReadAsync<DashboardRecentParticipantDto>();
                response.RecentParticipants = participants.ToList();
            }

            // 5. Monthly Trends
            if (!multi.IsConsumed)
            {
                var trends = await multi.ReadAsync<DashboardMonthlyTrendDto>();
                response.MonthlyTrends = trends.ToList();
            }

            _logger.LogInformation(
                "[DashboardService] sp_AdminDashboard executed successfully. TotalWebinars: {Webinars}, TotalStudents: {Students}, TotalParticipation: {Participation}",
                response.Summary.TotalWebinars,
                response.Summary.TotalStudents,
                response.Summary.TotalParticipation
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[DashboardService] Exception executing sp_AdminDashboard: {Message}", ex.Message);
            throw;
        }

        return response;
    }
}

