namespace WebinarApi.Models;

public class AdminDashboardStatsDto
{
    // Webinars
    public int TotalWebinars { get; set; }
    public int UpcomingWebinars { get; set; }
    public int CompletedWebinars { get; set; }
    public int PaidWebinars { get; set; }
    public int FreeWebinars { get; set; }
    public int ActiveMeetings { get; set; }

    // Users
    public int TotalStudents { get; set; }
    public int ActiveStudents { get; set; }
    public int TotalAdmins { get; set; }
    public int TotalSuperAdmins { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }

    // Certificates
    public int TotalCertificates { get; set; }
    public int ActiveCertificates { get; set; }

    // Participation
    public int TotalParticipation { get; set; }
    public int TotalAttended { get; set; }
    public int TotalCertificatesIssued { get; set; }
    public int AvgAttendedDurationSeconds { get; set; }

    // General
    public int TotalRegistrations { get; set; }
    public int TotalCategories { get; set; }
    public double EstimatedRevenue { get; set; }
}

public class DashboardCategoryDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int WebinarCount { get; set; }
    public int RegistrationCount { get; set; }
}

public class DashboardRecentWebinarDto
{
    public long Id { get; set; }
    public string WebinarName { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public DateTime WebinarDate { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int DurationMinutes { get; set; }
    public string ConductorName { get; set; } = string.Empty;
    public int ParticipantLimit { get; set; }
    public bool IsPaid { get; set; }
    public double? Price { get; set; }
    public bool IsMeetingCreated { get; set; }
    public bool IsCompleted { get; set; }
    public string? ModeratorJoinUrl { get; set; }
    public int RegistrationCount { get; set; }
    public int AttendedCount { get; set; }
    public int CompletedCount { get; set; }
}

public class DashboardRecentParticipantDto
{
    public int CompletionId { get; set; }
    public string WebinarName { get; set; } = string.Empty;
    public string ParticipantName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int AttendedDuration { get; set; }
    public bool IsAttended { get; set; }
    public bool IsCertificateEligible { get; set; }
    public string? CertificateCode { get; set; }
    public DateTime CompletedAt { get; set; }
}

public class DashboardMonthlyTrendDto
{
    public string MonthKey { get; set; } = string.Empty;
    public string MonthLabel { get; set; } = string.Empty;
    public int RegistrationCount { get; set; }
}

public class AdminDashboardResponseDto
{
    public AdminDashboardStatsDto Summary { get; set; } = new();
    public List<DashboardCategoryDto> Categories { get; set; } = new();
    public List<DashboardRecentWebinarDto> RecentWebinars { get; set; } = new();
    public List<DashboardRecentParticipantDto> RecentParticipants { get; set; } = new();
    public List<DashboardMonthlyTrendDto> MonthlyTrends { get; set; } = new();
}

