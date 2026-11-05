using System.ComponentModel.DataAnnotations;

namespace WebinarApi.Models;

// -------------------------------------------------------
// Request DTO for Scheduling a Meeting
// -------------------------------------------------------
public class ScheduleMeetingRequest
{
    [Required]
    public long WebinarId { get; set; }

    [Required]
    [StringLength(10, MinimumLength = 1)]
    public string MeetingID { get; set; } = string.Empty;

    [Required]
    [StringLength(250)]
    public string Name { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "MaxParticipants must be greater than 0")]
    public int MaxParticipants { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Duration must be greater than 0")]
    public int Duration { get; set; }

    public bool Record { get; set; } = false;

    public bool AutoStartRecording { get; set; } = false;

    public bool AllowStartStopRecording { get; set; } = true;

    [StringLength(1000)]
    public string? LogoutURL { get; set; }

    public int MeetingExpireIfNoUserJoinedInMinutes { get; set; } = 300;

    public int MeetingExpireWhenLastUserLeftInMinutes { get; set; } = 1;

    public bool EndWhenNoModerator { get; set; } = false;

    [StringLength(50)]
    public string GuestPolicy { get; set; } = "ALWAYS_ACCEPT";

    public bool MuteOnStart { get; set; } = true;

    [StringLength(50)]
    public string MeetingLayout { get; set; } = "UNIFIED_LAYOUT";

    [StringLength(50)]
    public string? LockSettingsPresenterPolicy { get; set; } = "default";

    [StringLength(50)]
    public string? ModeratorPW { get; set; }

    [StringLength(50)]
    public string? AttendeePW { get; set; }
}

// -------------------------------------------------------
// Response DTO for Meeting
// -------------------------------------------------------
public class MeetingDto
{
    public long Id { get; set; }
    public long WebinarId { get; set; }
    public string MeetingID { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int MaxParticipants { get; set; }
    public int Duration { get; set; }
    public bool Record { get; set; }
    public bool AutoStartRecording { get; set; }
    public bool AllowStartStopRecording { get; set; }
    public string? LogoutURL { get; set; }
    public int MeetingExpireIfNoUserJoinedInMinutes { get; set; }
    public int MeetingExpireWhenLastUserLeftInMinutes { get; set; }
    public bool EndWhenNoModerator { get; set; }
    public string GuestPolicy { get; set; } = "ALWAYS_ACCEPT";
    public bool MuteOnStart { get; set; }
    public string MeetingLayout { get; set; } = "UNIFIED_LAYOUT";
    public string? LockSettingsPresenterPolicy { get; set; }
    public string? ModeratorPW { get; set; }
    public string? AttendeePW { get; set; }
    public string? ModeratorJoinUrl { get; set; }
    public bool IsStarted { get; set; }
    public bool IsMeetingCreated { get; set; }
    public DateTime? MeetingCreatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
}

// -------------------------------------------------------
// Candidate DTO for Background Cron Meeting Schedule Checker
// -------------------------------------------------------
public class PendingMeetingScheduleDto
{
    public long Id { get; set; }
    public long WebinarId { get; set; }
    public string MeetingID { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int MaxParticipants { get; set; }
    public int Duration { get; set; }
    public bool Record { get; set; }
    public bool AutoStartRecording { get; set; }
    public bool AllowStartStopRecording { get; set; }
    public string? LogoutURL { get; set; }
    public int MeetingExpireIfNoUserJoinedInMinutes { get; set; }
    public int MeetingExpireWhenLastUserLeftInMinutes { get; set; }
    public bool EndWhenNoModerator { get; set; }
    public string GuestPolicy { get; set; } = "ALWAYS_ACCEPT";
    public bool MuteOnStart { get; set; }
    public string MeetingLayout { get; set; } = "UNIFIED_LAYOUT";
    public string? LockSettingsPresenterPolicy { get; set; }
    public string? ModeratorPW { get; set; }
    public string? AttendeePW { get; set; }
    public string? ModeratorJoinUrl { get; set; }
    public bool IsMeetingCreated { get; set; }
    public DateTime? MeetingCreatedAt { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string WebinarName { get; set; } = string.Empty;
    public string? ConductorName { get; set; }
    public int TotalRegistrations { get; set; }
    public int ExistingAttendeeLinks { get; set; }
}

// -------------------------------------------------------
// DTO for sp_GetWebinarRegistartionsMeetingParams
// -------------------------------------------------------
public class AttendeeMeetingParamDto
{
    public long MeetingDbId { get; set; }
    public string MeetingID { get; set; } = string.Empty;
    public string? AttendeePW { get; set; }
    public long WebinarRegistrationId { get; set; }
    public int UserId { get; set; }
    public string? CustomUserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? ExistingJoinLink { get; set; }
    public bool HasLink { get; set; }
}
