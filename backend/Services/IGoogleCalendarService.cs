using System.Threading.Tasks;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface IGoogleCalendarService
    {
        string GetAuthorizationUrl(int userId, long webinarId);
        Task<(bool success, string message, string? htmlRedirect)> HandleCallbackAsync(string code, string? state);
        Task<AddCalendarEventResponse> AddWebinarToCalendarAsync(int userId, long webinarId, string? timezone = null);
        Task UpdateCalendarEventsWithJoinLinkAsync(long webinarId);
    }
}

