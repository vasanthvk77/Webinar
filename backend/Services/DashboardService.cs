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

            // Fallback safety for TotalRevenue & TopAttendedStudent if SP wasn't updated yet
            if (response.Summary.TotalRevenue <= 0 && response.Summary.EstimatedRevenue > 0)
            {
                response.Summary.TotalRevenue = response.Summary.EstimatedRevenue;
            }

            if (string.IsNullOrWhiteSpace(response.Summary.TopAttendedStudentName))
            {
                try
                {
                    var topUser = await conn.QueryFirstOrDefaultAsync<dynamic>(@"
                        SELECT TOP 1 
                            LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) AS FullName,
                            COUNT(wc.Id) AS CompletedCount
                        FROM wms.WebinarCompleted wc
                        INNER JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId
                        INNER JOIN wms.Users u ON u.Id = wr.UserId
                        GROUP BY u.Id, u.FirstName, u.LastName
                        ORDER BY COUNT(wc.Id) DESC, LTRIM(RTRIM(ISNULL(u.FirstName, '') + ' ' + ISNULL(u.LastName, ''))) ASC;
                    ");
                    if (topUser != null)
                    {
                        response.Summary.TopAttendedStudentName = (string)topUser.FullName;
                        response.Summary.TopAttendedStudentCount = (int)topUser.CompletedCount;
                    }
                }
                catch (Exception topEx)
                {
                    _logger.LogWarning(topEx, "[DashboardService] Failed to query top attended student fallback.");
                }
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

    public async Task<StudentDashboardResponseDto> GetStudentDashboardDataAsync(int studentId)
    {
        _logger.LogInformation("[DashboardService] GetStudentDashboardDataAsync called for StudentId: {StudentId}", studentId);
        var response = new StudentDashboardResponseDto();

        try
        {
            using var conn = new SqlConnection(_connectionString);
            using var multi = await conn.QueryMultipleAsync(
                "wms.sp_StudentDashboard",
                new { StudentId = studentId },
                commandType: CommandType.StoredProcedure
            );

            // 1. Summary KPI Metrics
            if (!multi.IsConsumed)
            {
                var summary = await multi.ReadFirstOrDefaultAsync<StudentDashboardStatsDto>();
                if (summary != null)
                {
                    response.Summary = summary;
                }
            }

            // 2. Latest Registered Webinar (Spotlight)
            if (!multi.IsConsumed)
            {
                var latest = await multi.ReadFirstOrDefaultAsync<StudentLatestWebinarDto>();
                response.LatestWebinar = latest;
            }

            // 3. Each Webinar Attended Time & Session Performance
            if (!multi.IsConsumed)
            {
                var attendances = await multi.ReadAsync<StudentWebinarAttendanceDto>();
                response.WebinarAttendances = attendances.ToList();
            }

            // 4. Category Breakdown
            if (!multi.IsConsumed)
            {
                var categories = await multi.ReadAsync<StudentCategoryBreakdownDto>();
                response.CategoryBreakdowns = categories.ToList();
            }

            // 5. Recent Completed Webinars & Certificates
            if (!multi.IsConsumed)
            {
                var certs = await multi.ReadAsync<StudentRecentCertificateDto>();
                response.RecentCertificates = certs.ToList();
            }

            _logger.LogInformation(
                "[DashboardService] sp_StudentDashboard executed successfully for StudentId {StudentId}. TotalRegs: {Regs}, Completed: {Completed}, TotalDurationSecs: {Duration}",
                studentId,
                response.Summary.TotalRegistrations,
                response.Summary.CompletedWebinars,
                response.Summary.TotalAttendedDurationSeconds
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[DashboardService] Exception executing sp_StudentDashboard for StudentId {StudentId}: {Message}", studentId, ex.Message);
            throw;
        }

        return response;
    }
}

