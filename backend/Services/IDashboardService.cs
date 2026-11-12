using WebinarApi.Models;

namespace WebinarApi.Services;

public interface IDashboardService
{
    Task<AdminDashboardResponseDto> GetAdminDashboardDataAsync();
    Task<StudentDashboardResponseDto> GetStudentDashboardDataAsync(int studentId);
}

