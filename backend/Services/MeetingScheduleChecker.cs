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
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly string _connectionString;
    private readonly string _createMeetingApi;
    private readonly string _joinMeetingApi;
    private readonly string _sharedSecret;
    private readonly string _serverToServerUrl;
    private readonly int _intervalInMinutes;
    private readonly int _gracePeriodInMinutes;
    private readonly int _meetingEndCheckGracePeriod;
    private readonly int _adminAlertBufferMinutes;
    private readonly int _graceParticipantCount;

    public MeetingScheduleChecker(
        IConfiguration config,
        ILogger<MeetingScheduleChecker> logger,
        IHttpClientFactory httpClientFactory,
        IServiceScopeFactory scopeFactory)
    {
        _config = config;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _scopeFactory = scopeFactory;

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
        _meetingEndCheckGracePeriod = config.GetValue<int>("MeetingScheduleChecker:MeetingEndCheckGracePeriod", 30);
        _adminAlertBufferMinutes = config.GetValue<int>("MeetingScheduleChecker:AdminAlertBufferMinutesBeforeStart", 30);
        _graceParticipantCount = config.GetValue<int?>("garceParticpantCount")
                              ?? config.GetValue<int?>("graceParticipantCount")
                              ?? config.GetValue<int?>("BBB:garceParticpantCount")
                              ?? config.GetValue<int?>("BBB:GraceParticipantCount")
                              ?? 5;
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
        LogBoth($"[MeetingScheduleChecker] 🚀 Worker started. Poll Interval: {_intervalInMinutes} min(s), End Check Grace Period: {_meetingEndCheckGracePeriod} min(s).");

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

        // Check if any webinar is starting within 30 minutes without a meeting created, and alert the admin
        await CheckUnscheduledWebinarsAdminAlertAsync(conn, stoppingToken);

        // Auto-End Sweeper: Terminate webinars that have exceeded EndTime + GracePeriod
        await SweepAndEndExpiredMeetingsAsync(conn, stoppingToken);

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
                await CheckAndQueueMeetingJoinEmailsAsync(meeting, conn, stoppingToken);
                await UpdateGoogleCalendarEventsAsync(meeting.WebinarId);
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
                    await CheckAndQueueMeetingJoinEmailsAsync(meeting, conn, stoppingToken);
                    await UpdateGoogleCalendarEventsAsync(meeting.WebinarId);
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
            int bbbMaxParticipants = (meeting.TotalRegistrations > 0 ? meeting.TotalRegistrations : meeting.MaxParticipants) + _graceParticipantCount;
            LogBoth($"[MeetingScheduleChecker] 👥 MaxParticipants for '{meeting.Name}' (MeetingID: {meeting.MeetingID}): Registrations={meeting.TotalRegistrations}, Grace={_graceParticipantCount} => BBB Max={bbbMaxParticipants}");

            // Build parameters required by BBB create call
            var parameters = new List<KeyValuePair<string, string>>
            {
                new("name", meeting.Name),
                new("meetingID", meeting.MeetingID),
                new("maxParticipants", bbbMaxParticipants.ToString()),
                // Pass duration=0 to BigBlueButton so it never auto-terminates the meeting due to timer expiration
                new("duration", "0"),
                new("record", meeting.Record ? "true" : "false"),
                new("autoStartRecording", meeting.AutoStartRecording ? "true" : "false"),
                new("allowStartStopRecording", meeting.AllowStartStopRecording ? "true" : "false"),
                new("meetingExpireIfNoUserJoinedInMinutes", meeting.MeetingExpireIfNoUserJoinedInMinutes.ToString()),
                new("meetingExpireWhenLastUserLeftInMinutes", meeting.MeetingExpireWhenLastUserLeftInMinutes.ToString()),
                new("endWhenNoModerator", meeting.EndWhenNoModerator ? "true" : "false"),
                new("guestPolicy", meeting.GuestPolicy),
                new("muteOnStart", meeting.MuteOnStart ? "true" : "false"),
                new("lockSettingsDisableMic", meeting.LockSettingsDisableMic ? "true" : "false"),
                new("lockSettingsDisableCam", meeting.LockSettingsDisableCam ? "true" : "false"),
                new("lockSettingsDisablePrivateChat", meeting.LockSettingsDisablePrivateChat ? "true" : "false"),
                new("webcamsOnlyForModerator", meeting.WebcamsOnlyForModerator ? "true" : "false"),
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
                var callbackWithId = _serverToServerUrl.Contains('?')
                    ? $"{_serverToServerUrl}&meetingID={Uri.EscapeDataString(meeting.MeetingID)}"
                    : $"{_serverToServerUrl}?meetingID={Uri.EscapeDataString(meeting.MeetingID)}";

                parameters.Add(new("meetingEndedURL", callbackWithId));
                parameters.Add(new("meetingKeepEvents", "true"));
                parameters.Add(new("meta_analytics-callback-url", callbackWithId));
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

                // Register recording tracking with BBB internalMeetingID
                var internalMeetingId = xdoc.Root?.Element("internalMeetingID")?.Value?.Trim();
                LogBoth($"[MeetingScheduleChecker] 🆔 Extracted internalMeetingID from BBB XML: '{internalMeetingId}'");
                if (!string.IsNullOrWhiteSpace(internalMeetingId))
                {
                    try
                    {
                        LogBoth($"[MeetingScheduleChecker] 💾 Calling wms.usp_RegisterWebinarRecording (WebinarId: {meeting.WebinarId}, MeetingId: {meeting.Id}, RecordId: '{internalMeetingId}')...");
                        await conn.ExecuteAsync(
                            "wms.usp_RegisterWebinarRecording",
                            new
                            {
                                WebinarId = meeting.WebinarId,
                                MeetingId = meeting.Id,
                                MeetingIDString = meeting.MeetingID,
                                RecordId = internalMeetingId
                            },
                            commandType: CommandType.StoredProcedure
                        );
                        LogBoth($"[MeetingScheduleChecker] 📹 Registered recording tracking for MeetingID '{meeting.MeetingID}', RecordId: '{internalMeetingId}'.");
                    }
                    catch (Exception ex)
                    {
                        LogWarnBoth($"[MeetingScheduleChecker] ⚠️ Could not register recording tracking for '{meeting.MeetingID}': {ex.Message}");
                    }
                }

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

    private async Task CheckAndQueueMeetingJoinEmailsAsync(PendingMeetingScheduleDto meeting, SqlConnection conn, CancellationToken stoppingToken)
    {
        try
        {
            // Verify condition: IsMeetingCreated == 1 && RegisteredCount == GeneratedLinksCount && RegisteredCount > 0
            var counts = await conn.QueryFirstOrDefaultAsync<dynamic>(
                @"SELECT 
                    (SELECT COUNT(1) FROM wms.WebinarRegistrations WHERE WebinarId = @WebinarId) AS TotalReg,
                    (SELECT COUNT(1) FROM wms.AttendeeMeetingLinks WHERE MeetingId = @MeetingId) AS TotalLinks",
                new { WebinarId = meeting.WebinarId, MeetingId = meeting.Id }
            );

            int totalReg = counts?.TotalReg != null ? (int)counts.TotalReg : 0;
            int totalLinks = counts?.TotalLinks != null ? (int)counts.TotalLinks : 0;

            LogBoth($"[MeetingScheduleChecker] 📧 Evaluating Email Queue Condition for '{meeting.Name}' (MeetingID: {meeting.MeetingID}):");
            LogBoth($"[MeetingScheduleChecker]    IsMeetingCreated: {meeting.IsMeetingCreated} | Total Registrations: {totalReg} | Generated Links: {totalLinks}");

            if (totalReg > 0 && totalLinks >= totalReg)
            {
                LogBoth($"[MeetingScheduleChecker] 🎯 Condition SATISFIED: Total Registrations ({totalReg}) === Generated Links ({totalLinks})!");
                LogBoth($"[MeetingScheduleChecker] 📨 Queueing personalized meeting join link emails into wms.EmailQueue...");

                var queueResult = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.sp_QueueAttendeeMeetingJoinEmails",
                    new { MeetingId = meeting.Id, WebinarId = meeting.WebinarId },
                    commandType: CommandType.StoredProcedure
                );

                int queuedCount = queueResult?.QueuedCount != null ? (int)queueResult.QueuedCount : 0;
                if (queuedCount > 0)
                {
                    LogBoth($"[MeetingScheduleChecker] 🚀 Successfully queued {queuedCount} meeting join email(s) into wms.EmailQueue for '{meeting.Name}'. Email processor will deliver them.");
                }
                else
                {
                    LogBoth($"[MeetingScheduleChecker] ℹ️ All {totalReg} registered students already have join link emails queued in wms.EmailQueue. No new emails to queue.");
                }
            }
            else
            {
                LogBoth($"[MeetingScheduleChecker] ⏳ Join link email condition NOT met yet ({totalLinks}/{totalReg} links ready). Skipping email queueing.");
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[MeetingScheduleChecker] ❌ Exception while queueing meeting join emails for '{meeting.MeetingID}': {ex.Message}");
        }
    }

    private async Task CheckUnscheduledWebinarsAdminAlertAsync(SqlConnection conn, CancellationToken stoppingToken)
    {
        try
        {
            var queuedCount = await conn.QueryFirstOrDefaultAsync<int>(
                "wms.usp_CheckUnscheduledWebinarsAdminAlert",
                new { BufferMinutes = _adminAlertBufferMinutes },
                commandType: CommandType.StoredProcedure
            );

            if (queuedCount > 0)
            {
                LogBoth($"[MeetingScheduleChecker] ⚠️ Queued {queuedCount} unscheduled webinar alert(s) to Admin(s) in EmailQueue (Webinars starting within {_adminAlertBufferMinutes} mins).");
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[MeetingScheduleChecker] ⚠️ Error checking unscheduled webinars for admin alert: {ex.Message}");
        }
    }

    private async Task UpdateGoogleCalendarEventsAsync(long webinarId)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var calService = scope.ServiceProvider.GetRequiredService<IGoogleCalendarService>();
            await calService.UpdateCalendarEventsWithJoinLinkAsync(webinarId);
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[MeetingScheduleChecker] Non-fatal error updating Google Calendar for Webinar {webinarId}: {ex.Message}");
        }
    }

    private async Task SweepAndEndExpiredMeetingsAsync(SqlConnection conn, CancellationToken stoppingToken)
    {
        try
        {
            var expiredMeetings = (await conn.QueryAsync<dynamic>(
                "wms.usp_GetExpiredActiveMeetings",
                new { GracePeriodMinutes = _meetingEndCheckGracePeriod },
                commandType: CommandType.StoredProcedure
            )).ToList();

            if (expiredMeetings.Count == 0) return;

            LogBoth($"[MeetingScheduleChecker] 🏁 Found {expiredMeetings.Count} expired active meeting(s) to auto-terminate on BBB.");

            var baseApi = _createMeetingApi.EndsWith("/create", StringComparison.OrdinalIgnoreCase)
                ? _createMeetingApi[..^"/create".Length]
                : _createMeetingApi;

            var endMeetingApi = $"{baseApi}/end";

            foreach (var m in expiredMeetings)
            {
                if (stoppingToken.IsCancellationRequested) break;

                string meetingId = (string)m.MeetingID;
                string modPw = (string?)(m.ModeratorPW) ?? "mp";
                long webinarId = (long)m.WebinarId;

                try
                {
                    var query = $"meetingID={Uri.EscapeDataString(meetingId)}&password={Uri.EscapeDataString(modPw)}";
                    var dataToHash = "end" + query + _sharedSecret;

                    using var sha1 = SHA1.Create();
                    var checksum = Convert.ToHexString(sha1.ComputeHash(Encoding.UTF8.GetBytes(dataToHash))).ToLowerInvariant();
                    var fullUrl = $"{endMeetingApi}?{query}&checksum={checksum}";

                    var httpClient = _httpClientFactory.CreateClient("BbbClient");
                    httpClient.Timeout = TimeSpan.FromSeconds(15);

                    var response = await httpClient.GetAsync(fullUrl, stoppingToken);
                    LogBoth($"[MeetingScheduleChecker] 🛑 Sent /api/end for '{meetingId}' (Webinar {webinarId}). BBB HTTP {response.StatusCode}.");

                    // Trigger meeting ended handler to record attendance, mark IsCompleted = 1, and set recording Status = 'PROCESSING'
                    using var scope = _scopeFactory.CreateScope();
                    var meetingService = scope.ServiceProvider.GetRequiredService<IMeetingService>();
                    await meetingService.ProcessMeetingEndedAsync(meetingId, null);
                }
                catch (Exception ex)
                {
                    LogWarnBoth($"[MeetingScheduleChecker] ⚠️ Error auto-terminating expired meeting '{meetingId}': {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[MeetingScheduleChecker] ⚠️ Error in SweepAndEndExpiredMeetingsAsync: {ex.Message}");
        }
    }
}
