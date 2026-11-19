using System;
using System.Collections.Generic;

namespace WebinarApi.Models
{
    public class GoogleCalendarOptions
    {
        public string ClientId { get; set; } = string.Empty;
        public string ClientSecret { get; set; } = string.Empty;
        public string AuthUri { get; set; } = "https://accounts.google.com/o/oauth2/auth";
        public string TokenUri { get; set; } = "https://oauth2.googleapis.com/token";
        public string RedirectUri { get; set; } = string.Empty;
        public List<int> ReminderOffsetsInMinutes { get; set; } = new();
    }

    public class UpdateReminderOffsetsRequest
    {
        public List<int>? Offsets { get; set; }
        public int? Offset1 { get; set; }
        public int? Offset2 { get; set; }
        public int? Offset3 { get; set; }
    }

    public class AddCalendarEventRequest
    {
        public long WebinarId { get; set; }
        public string? TimeZone { get; set; }
    }

    public class AddCalendarEventResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public bool RequiresAuth { get; set; }
        public string? AuthUrl { get; set; }
        public string? EventLink { get; set; }
    }

    public class UserGoogleTokenRecord
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string AccessToken { get; set; } = string.Empty;
        public string? RefreshToken { get; set; }
        public DateTime ExpiresAt { get; set; }
        public string? Scope { get; set; }
    }
}

