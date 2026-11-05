using WebinarApi.Models;

namespace WebinarApi.Services;

public interface IDashboardService
{
    Task<AdminDashboardResponseDto> GetAdminDashboardDataAsync();
}

