using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services;

// -------------------------------------------------------
// MeetingScheduleChecker: Periodic Background Worker
// Runs every X minutes (default 2 mins)
// Checks scheduled meetings, computes trigger time, and
// creates them on BigBlueButton when trigger time is reached.
// -------------------------------------------------------
public class MeetingScheduleChecker : BackgroundService
{
    private readonly IConfiguration _config;
    private readonly ILogger<MeetingScheduleChecker> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _connectionString;
    private readonly string _createMeetingApi;
    private readonly string _joinMeetingApi;
    private readonly string _sharedSecret;
    private readonly string _serverToServerUrl;
    private readonly int _intervalInMinutes;
    private readonly int _gracePeriodInMinutes;

    public MeetingScheduleChecker(
        IConfiguration config,
        ILogger<MeetingScheduleChecker> logger,
        IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _logger = logger;
        _httpClientFactory = httpClientFactory;

        _connectionString = config.GetConnectionString("DefaultConnection")
                          ?? throw new InvalidOperationException("Connection string not configured.");

        _createMeetingApi = (config["BBB:CreateMeetingApi"]
                          ?? "https://bbb.test/bigbluebutton/api/create").Trim();

        _joinMeetingApi = (config["BBB:JoinMeetingApi"]
                        ?? "https://bbb.test/bigbluebutton/api/join").Trim();

        _sharedSecret = config["BBB:SharedSecret"] ?? string.Empty;
        _serverToServerUrl = (config["BBB:ServerToServerUrl"] ?? config["BBB:EndedURL"] ?? string.Empty).Trim();

        _intervalInMinutes = config.GetValue<int>("MeetingScheduleChecker:IntervalInMinutes", 2);
        _gracePeriodInMinutes = config.GetValue<int>("MeetingScheduleChecker:GracePeriodInMinutes", 5);
    }

    private void LogBoth(string message)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss} INF] {message}");
        _logger.LogInformation("{Message}", message);
    }

    private void LogWarnBoth(string message)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss} WRN] {message}");
        _logger.LogWarning("{Message}", message);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogBoth($"[MeetingScheduleChecker] 🚀 Worker started. Poll Interval: {_intervalInMinutes} min(s), Grace Period: {_gracePeriodInMinutes} min(s).");

        // Small initial wait to allow database initialization to complete
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessScheduledMeetingsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                LogWarnBoth($"[MeetingScheduleChecker] ⚠️ Error during execution cycle: {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromMinutes(_intervalInMinutes), stoppingToken);
        }
    }

    private async Task ProcessScheduledMeetingsAsync(CancellationToken stoppingToken)
    {
        LogBoth($"[MeetingScheduleChecker] ⏱️ {_intervalInMinutes}-Minute cycle started: Checking database for pending scheduled meetings...");

        using var conn = new SqlConnection(_connectionString);

        // Fast query driven by filtered index IX_Meetings_PendingCreation
        var candidates = (await conn.QueryAsync<PendingMeetingScheduleDto>(
            "wms.CheckMeetingSchedule",
            commandType: CommandType.StoredProcedure
        )).ToList();

        if (candidates.Count == 0)
        {
            LogBoth("[MeetingScheduleChecker] ℹ️ Checked database: No pending meetings waiting to be created.");
            return;
        }

        LogBoth($"[MeetingScheduleChecker] 📋 Got data: Found {candidates.Count} pending meeting(s) to evaluate.");

        var nowUtc = DateTime.UtcNow;

        foreach (var meeting in candidates)
        {
            if (stoppingToken.IsCancellationRequested) break;

            // Scenario 1: Meeting session is ALREADY created on BBB (IsMeetingCreated == true)
            // Immediately synchronize any missing attendee links without waiting for trigger time!
            if (meeting.IsMeetingCreated)
            {
                LogBoth($"[MeetingScheduleChecker] ⚡ Meeting '{meeting.Name}' (MeetingID: {meeting.MeetingID}) is ALREADY created on BBB. Checking attendee links immediately...");
                await SyncAttendeeLinksAsync(meeting, conn, stoppingToken);
                continue;
            }

            // Scenario 2: Meeting session is NOT created yet (IsMeetingCreated == false)
            // Evaluate trigger time to decide whether to call BBB /api/create
            LogBoth($"[MeetingScheduleChecker] 🔍 Computing calculation for Meeting '{meeting.Name}' (MeetingID: {meeting.MeetingID}, WebinarID: {meeting.WebinarId})...");
            LogBoth($"[MeetingScheduleChecker]    Formula: StartTime UTC ({meeting.StartTime:yyyy-MM-dd HH:mm:ss}) + GracePeriod ({_gracePeriodInMinutes}m) - ExpireNoUserJoined ({meeting.MeetingExpireIfNoUserJoinedInMinutes}m)");

            // Math: WebinarStartTime + GracePeriod - MeetingExpireIfNoUserJoinedInMinutes (All in UTC)
            var triggerTimeUtc = meeting.StartTime.AddMinutes(_gracePeriodInMinutes - meeting.MeetingExpireIfNoUserJoinedInMinutes);

            LogBoth($"[MeetingScheduleChecker] 🧮 Calculation completed: Create Trigger Time (UTC) = {triggerTimeUtc:yyyy-MM-dd HH:mm:ss} | Current Time (UTC) = {nowUtc:yyyy-MM-dd HH:mm:ss} (Local: {DateTime.Now:hh:mm:ss tt})");

            if (nowUtc >= triggerTimeUtc && nowUtc <= meeting.EndTime)
            {
                LogBoth($"[MeetingScheduleChecker] 🚀 Create time REACHED/CROSSED! (Now UTC: {nowUtc:yyyy-MM-dd HH:mm:ss} >= Trigger UTC: {triggerTimeUtc:yyyy-MM-dd HH:mm:ss}). Creating BBB meeting session now for '{meeting.Name}' (MeetingID: {meeting.MeetingID})...");
                var created = await CallBbbCreateMeetingAsync(meeting, conn, stoppingToken);
                if (created)
                {
                    meeting.IsMeetingCreated = true;
                    // Immediately generate attendee links after BBB create success
                    await SyncAttendeeLinksAsync(meeting, conn, stoppingToken);
                }
            }
            else if (nowUtc < triggerTimeUtc)
            {
                var remaining = triggerTimeUtc - nowUtc;
                var remainingStr = (int)remaining.TotalHours > 0
                    ? $"{(int)remaining.TotalHours}h {remaining.Minutes}m {remaining.Seconds}s"
                    : $"{remaining.Minutes}m {remaining.Seconds}s";

                LogBoth($"[MeetingScheduleChecker] ⏳ Create time NOT reached yet. Remaining: {remainingStr} still left before this meeting should be created.");
            }
            else // nowUtc > meeting.EndTime
            {
                LogWarnBoth($"[MeetingScheduleChecker] ⚠️ Skipped MeetingID '{meeting.MeetingID}' because webinar already ended at {meeting.EndTime:yyyy-MM-dd HH:mm:ss} UTC.");
            }
        }
    }

    private async Task<bool> CallBbbCreateMeetingAsync(PendingMeetingScheduleDto meeting, SqlConnection conn, CancellationToken stoppingToken)
    {
        try
        {
            // Build parameters required by BBB create call
            var parameters = new List<KeyValuePair<string, string>>
            {
                new("name", meeting.Name),
                new("meetingID", meeting.MeetingID),
                new("maxParticipants", meeting.MaxParticipants.ToString()),
                new("duration", meeting.Duration.ToString()),
                new("record", meeting.Record ? "true" : "false"),
                new("autoStartRecording", meeting.AutoStartRecording ? "true" : "false"),
                new("allowStartStopRecording", meeting.AllowStartStopRecording ? "true" : "false"),
                new("meetingExpireIfNoUserJoinedInMinutes", meeting.MeetingExpireIfNoUserJoinedInMinutes.ToString()),
                new("meetingExpireWhenLastUserLeftInMinutes", meeting.MeetingExpireWhenLastUserLeftInMinutes.ToString()),
                new("endWhenNoModerator", meeting.EndWhenNoModerator ? "true" : "false"),
                new("guestPolicy", meeting.GuestPolicy),
                new("muteOnStart", meeting.MuteOnStart ? "true" : "false"),
                new("meetingLayout", meeting.MeetingLayout),
                new("meta_webinarId", meeting.WebinarId.ToString())
            };

            if (!string.IsNullOrWhiteSpace(meeting.LogoutURL))
            {
                parameters.Add(new("logoutURL", meeting.LogoutURL.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(meeting.LockSettingsPresenterPolicy))
            {
                parameters.Add(new("lockSettingsPresenterPolicy", meeting.LockSettingsPresenterPolicy.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(meeting.ModeratorPW))
            {
                parameters.Add(new("moderatorPW", meeting.ModeratorPW.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(meeting.AttendeePW))
            {
                parameters.Add(new("attendeePW", meeting.AttendeePW.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(_serverToServerUrl) && !_serverToServerUrl.Equals("nothing now yet", StringComparison.OrdinalIgnoreCase))
            {
                parameters.Add(new("meetingEndedURL", _serverToServerUrl));
                parameters.Add(new("meetingKeepEvents", "true"));
                parameters.Add(new("meta_analytics-callback-url", _serverToServerUrl));
            }

            // Encode query string
            var queryString = string.Join("&", parameters.Select(p =>
                $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

            // Calculate SHA-1 checksum: SHA1("create" + queryString + sharedSecret)
            var dataToHash = "create" + queryString + _sharedSecret;
            using var sha1 = SHA1.Create();
            var hashBytes = sha1.ComputeHash(Encoding.UTF8.GetBytes(dataToHash));
            var checksum = Convert.ToHexString(hashBytes).ToLowerInvariant();

            var fullUrl = $"{_createMeetingApi}?{queryString}&checksum={checksum}";

            LogBoth($"[MeetingScheduleChecker] 🌐 Calling BigBlueButton Create API for MeetingID '{meeting.MeetingID}'...");

            var httpClient = _httpClientFactory.CreateClient("BbbClient");
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            var response = await httpClient.GetAsync(fullUrl, stoppingToken);
            var responseXml = await response.Content.ReadAsStringAsync(stoppingToken);

            var xdoc = XDocument.Parse(responseXml);
            var returncode = xdoc.Root?.Element("returncode")?.Value;

            if (string.Equals(returncode, "SUCCESS", StringComparison.OrdinalIgnoreCase))
            {
                var meetingCreatedAt = DateTime.UtcNow;

                // Extract or fallback to moderator password
                var moderatorPw = !string.IsNullOrWhiteSpace(meeting.ModeratorPW)
                    ? meeting.ModeratorPW
                    : xdoc.Root?.Element("moderatorPW")?.Value ?? "mp";

                // Generate Moderator Join URL
                var adminFullName = string.IsNullOrWhiteSpace(meeting.ConductorName) ? "Admin Moderator" : meeting.ConductorName;
                var joinParams = new List<KeyValuePair<string, string>>
                {
                    new("fullName", adminFullName),
                    new("meetingID", meeting.MeetingID),
                    new("password", moderatorPw),
                    new("redirect", "true")
                };

                var joinQuery = string.Join("&", joinParams.Select(p =>
                    $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

                var joinDataToHash = "join" + joinQuery + _sharedSecret;
                using var sha1Join = SHA1.Create();
                var joinHashBytes = sha1Join.ComputeHash(Encoding.UTF8.GetBytes(joinDataToHash));
                var joinChecksum = Convert.ToHexString(joinHashBytes).ToLowerInvariant();

                var moderatorJoinUrl = $"{_joinMeetingApi}?{joinQuery}&checksum={joinChecksum}";

                // Update database: IsMeetingCreated = 1, MeetingCreatedAt = timestamp, ModeratorJoinUrl
                await conn.ExecuteAsync(
                    "wms.usp_MarkMeetingCreated",
                    new { Id = meeting.Id, MeetingCreatedAt = meetingCreatedAt, ModeratorJoinUrl = moderatorJoinUrl },
                    commandType: CommandType.StoredProcedure
                );

                LogBoth($"[MeetingScheduleChecker] ✅ Meeting '{meeting.Name}' (MeetingID: {meeting.MeetingID}) CREATED SUCCESSFULLY on BBB!");
                LogBoth($"[MeetingScheduleChecker] 🔗 Generated Moderator Join URL: {moderatorJoinUrl}");
                LogBoth($"[MeetingScheduleChecker] 💾 Database updated: IsMeetingCreated = 1, MeetingCreatedAt = {meetingCreatedAt:yyyy-MM-dd HH:mm:ss} UTC.");
                return true;
            }
            else
            {
                var messageKey = xdoc.Root?.Element("messageKey")?.Value;
                var message = xdoc.Root?.Element("message")?.Value;

                LogWarnBoth($"[MeetingScheduleChecker] ❌ BigBlueButton create FAILED for '{meeting.MeetingID}'. Code: {messageKey}, Message: {message}. Will retry on next cycle.");
                return false;
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[MeetingScheduleChecker] ❌ Exception while creating BBB meeting '{meeting.MeetingID}': {ex.Message}");
            return false;
        }
    }

    private async Task SyncAttendeeLinksAsync(PendingMeetingScheduleDto meeting, SqlConnection conn, CancellationToken stoppingToken)
    {
        try
        {
            LogBoth($"[MeetingScheduleChecker] 👥 Checking attendee links for '{meeting.Name}' (MeetingID: {meeting.MeetingID})...");
            LogBoth($"[MeetingScheduleChecker]    Total Registrations: {meeting.TotalRegistrations} | Existing Attendee Links: {meeting.ExistingAttendeeLinks}");

            if (meeting.TotalRegistrations > 0 && meeting.ExistingAttendeeLinks >= meeting.TotalRegistrations)
            {
                LogBoth($"[MeetingScheduleChecker] ✅ All {meeting.ExistingAttendeeLinks} attendee link(s) already generated for '{meeting.Name}'. Skipping.");
                return;
            }

            // Fetch registration & meeting credentials
            var attendees = (await conn.QueryAsync<AttendeeMeetingParamDto>(
                "wms.sp_GetWebinarRegistartionsMeetingParams",
                new { WebinarId = meeting.WebinarId },
                commandType: CommandType.StoredProcedure
            )).ToList();

            if (attendees.Count == 0)
            {
                LogBoth($"[MeetingScheduleChecker] ℹ️ No registered students found for WebinarId {meeting.WebinarId}.");
                return;
            }

            var missingAttendees = attendees.Where(a => !a.HasLink || string.IsNullOrWhiteSpace(a.ExistingJoinLink)).ToList();
            if (missingAttendees.Count == 0)
            {
                LogBoth($"[MeetingScheduleChecker] ✅ All {attendees.Count} attendee link(s) already verified in table. Skipping.");
                return;
            }

            LogBoth($"[MeetingScheduleChecker] ⚡ Generating {missingAttendees.Count} attendee join link(s) for '{meeting.Name}'...");

            var attendeePw = !string.IsNullOrWhiteSpace(meeting.AttendeePW)
                ? meeting.AttendeePW
                : (!string.IsNullOrWhiteSpace(attendees[0].AttendeePW) ? attendees[0].AttendeePW : "ap");

            int generatedCount = 0;
            foreach (var student in missingAttendees)
            {
                if (stoppingToken.IsCancellationRequested) break;

                var studentName = !string.IsNullOrWhiteSpace(student.FullName)
                    ? student.FullName
                    : (!string.IsNullOrWhiteSpace(student.Email) ? student.Email : $"Student-{student.UserId}");

                var joinParams = new List<KeyValuePair<string, string>>
                {
                    new("fullName", studentName),
                    new("meetingID", meeting.MeetingID),
                    new("password", attendeePw),
                    new("redirect", "true")
                };

                if (!string.IsNullOrWhiteSpace(student.CustomUserId))
                {
                    joinParams.Add(new("userID", student.CustomUserId.Trim()));
                }

                var joinQuery = string.Join("&", joinParams.Select(p =>
                    $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

                var joinDataToHash = "join" + joinQuery + _sharedSecret;
                using var sha1Join = SHA1.Create();
                var joinHashBytes = sha1Join.ComputeHash(Encoding.UTF8.GetBytes(joinDataToHash));
                var joinChecksum = Convert.ToHexString(joinHashBytes).ToLowerInvariant();

                var attendeeJoinUrl = $"{_joinMeetingApi}?{joinQuery}&checksum={joinChecksum}";

                // Save to wms.AttendeeMeetingLinks via stored procedure
                await conn.ExecuteAsync(
                    "wms.sp_StoreAttendeeLink",
                    new
                    {
                        MeetingId = meeting.Id,
                        WebinarRegistrationId = student.WebinarRegistrationId,
                        JoinLink = attendeeJoinUrl,
                        IsCreatedLink = true
                    },
                    commandType: CommandType.StoredProcedure
                );

                generatedCount++;
            }

            LogBoth($"[MeetingScheduleChecker] 💾 Successfully saved {generatedCount} attendee link(s) into AttendeeMeetingLinks for '{meeting.Name}'.");
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[MeetingScheduleChecker] ❌ Exception while synchronizing attendee links for '{meeting.MeetingID}': {ex.Message}");
        }
    }
}
