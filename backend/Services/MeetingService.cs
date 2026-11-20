using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services;

public interface IMeetingService
{
    Task<(bool success, string message, MeetingDto? meeting)> ScheduleMeetingAsync(ScheduleMeetingRequest request, int userId);
    Task<MeetingDto?> GetMeetingByWebinarIdAsync(long webinarId);
    Task<(bool success, string message, string? moderatorJoinUrl)> RegenerateModeratorLinkAsync(long webinarId);
    Task<(bool success, string message, int recordedCount)> ProcessMeetingEndedAsync(string? meetingId, string? rawPayload);
}

public class MeetingService : IMeetingService
{
    private readonly string _connectionString;
    private readonly ILogger<MeetingService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IGoogleCalendarService _googleCalendarService;
    private readonly string _sharedSecret;
    private readonly string _createMeetingApi;
    private readonly string _joinMeetingApi;
    private readonly string _serverToServerUrl;
    private readonly int _gracePeriodInMinutes;
    private readonly int _graceParticipantCount;

    public MeetingService(
        IConfiguration config,
        IHttpClientFactory httpClientFactory,
        ILogger<MeetingService> logger,
        IGoogleCalendarService googleCalendarService)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
                         ?? throw new InvalidOperationException("Connection string not configured.");
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _googleCalendarService = googleCalendarService;
        _sharedSecret = config["BBB:SharedSecret"]?.Trim() ?? string.Empty;
        _createMeetingApi = config["BBB:CreateMeetingApi"]?.Trim() ?? string.Empty;
        _joinMeetingApi = config["BBB:JoinMeetingApi"]?.Trim() ?? string.Empty;
        _serverToServerUrl = (config["BBB:ServerToServerUrl"] ?? config["BBB:EndedURL"] ?? string.Empty).Trim();
        _gracePeriodInMinutes = config.GetValue<int>("MeetingScheduleChecker:GracePeriodInMinutes", 5);
        _graceParticipantCount = config.GetValue<int?>("garceParticpantCount")
                              ?? config.GetValue<int?>("graceParticipantCount")
                              ?? config.GetValue<int?>("BBB:garceParticpantCount")
                              ?? config.GetValue<int?>("BBB:GraceParticipantCount")
                              ?? 5;
    }

    public async Task<(bool success, string message, MeetingDto? meeting)> ScheduleMeetingAsync(ScheduleMeetingRequest request, int userId)
    {
        _logger.LogInformation("[MeetingService] ScheduleMeeting called for WebinarId: {WebinarId}, MeetingID: {MeetingID}, UserId: {UserId}",
            request.WebinarId, request.MeetingID, userId);
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss} SCHEDULE] 🎯 ScheduleMeeting called for WebinarId: {request.WebinarId}, MeetingID: '{request.MeetingID}', UserId: {userId}");

        try
        {
            if (request.WebinarId <= 0)
                return (false, "Valid Webinar ID is required.", null);

            if (string.IsNullOrWhiteSpace(request.MeetingID) || request.MeetingID.Trim().Length > 10)
                return (false, "MeetingID is required and must not exceed 10 characters.", null);

            if (string.IsNullOrWhiteSpace(request.Name))
                return (false, "Meeting name is required.", null);

            if (request.MaxParticipants <= 0)
                return (false, "MaxParticipants must be greater than 0.", null);

            if (request.Duration <= 0)
                return (false, "Duration must be greater than 0.", null);

            using var conn = new SqlConnection(_connectionString);

            // Fetch Webinar details for UTC timing calculation
            var webinar = await conn.QueryFirstOrDefaultAsync<WebinarScheduleInfo>(
                "SELECT Id, WebinarName, StartTime, EndTime, ConductorName, CreatedBy FROM wms.Webinars WHERE Id = @WebinarId",
                new { WebinarId = request.WebinarId }
            );

            if (webinar == null)
                return (false, "Webinar record not found.", null);

            // Industry-standard UTC calculation: StartTime UTC + GracePeriod - ScheduleTime (Now UTC)
            var startTimeUtc = DateTime.SpecifyKind(webinar.StartTime, DateTimeKind.Utc);
            var nowUtc = DateTime.UtcNow;
            var deadlineUtc = startTimeUtc.AddMinutes(_gracePeriodInMinutes);
            var diffMinutes = (int)Math.Ceiling((deadlineUtc - nowUtc).TotalMinutes);

            // Apply safety floor: Minimum 10 minutes
            int calculatedExpiryMinutes = Math.Max(diffMinutes, 10);

            _logger.LogInformation("[MeetingService] Schedule timing calculation: Webinar Start UTC = {Start:yyyy-MM-dd HH:mm:ss}, Grace = {Grace}m, Now UTC = {Now:yyyy-MM-dd HH:mm:ss}, Calculated Expiry = {Expiry}m",
                startTimeUtc, _gracePeriodInMinutes, nowUtc, calculatedExpiryMinutes);

            // Fetch current registration count for this webinar
            var registrationCount = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM wms.WebinarRegistrations WHERE WebinarId = @WebinarId",
                new { WebinarId = request.WebinarId }
            );

            // Calculate MaxParticipants: Registration Count + Grace Count
            int calculatedMaxParticipants = (registrationCount > 0 ? registrationCount : request.MaxParticipants) + _graceParticipantCount;

            _logger.LogInformation("[MeetingService] MaxParticipants for WebinarId {WebinarId}: Registrations={RegCount}, Request={ReqMax}, Grace={Grace} => Final={FinalMax}",
                request.WebinarId, registrationCount, request.MaxParticipants, _graceParticipantCount, calculatedMaxParticipants);
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} SCHEDULE] 👥 MaxParticipants calculated: Registrations={registrationCount}, Grace={_graceParticipantCount} => Final={calculatedMaxParticipants}");

            var parameters = new DynamicParameters();
            parameters.Add("@WebinarId", request.WebinarId);
            parameters.Add("@MeetingID", request.MeetingID.Trim());
            parameters.Add("@Name", request.Name.Trim());
            parameters.Add("@MaxParticipants", calculatedMaxParticipants);
            parameters.Add("@Duration", request.Duration);
            parameters.Add("@Record", request.Record);
            parameters.Add("@AutoStartRecording", request.AutoStartRecording);
            parameters.Add("@AllowStartStopRecording", request.AllowStartStopRecording);
            parameters.Add("@LogoutURL", string.IsNullOrWhiteSpace(request.LogoutURL) ? null : request.LogoutURL.Trim());
            parameters.Add("@MeetingExpireIfNoUserJoinedInMinutes", calculatedExpiryMinutes);
            parameters.Add("@MeetingExpireWhenLastUserLeftInMinutes", request.MeetingExpireWhenLastUserLeftInMinutes);
            parameters.Add("@EndWhenNoModerator", request.EndWhenNoModerator);
            parameters.Add("@GuestPolicy", string.IsNullOrWhiteSpace(request.GuestPolicy) ? "ALWAYS_ACCEPT" : request.GuestPolicy.Trim());
            parameters.Add("@MuteOnStart", request.MuteOnStart);
            parameters.Add("@MeetingLayout", string.IsNullOrWhiteSpace(request.MeetingLayout) ? "UNIFIED_LAYOUT" : request.MeetingLayout.Trim());
            parameters.Add("@LockSettingsPresenterPolicy", string.IsNullOrWhiteSpace(request.LockSettingsPresenterPolicy) ? "default" : request.LockSettingsPresenterPolicy.Trim());
            parameters.Add("@LockSettingsDisableMic", request.LockSettingsDisableMic);
            parameters.Add("@LockSettingsDisableCam", request.LockSettingsDisableCam);
            parameters.Add("@LockSettingsDisablePrivateChat", request.LockSettingsDisablePrivateChat);
            parameters.Add("@WebcamsOnlyForModerator", request.WebcamsOnlyForModerator);
            parameters.Add("@ModeratorPW", string.IsNullOrWhiteSpace(request.ModeratorPW) ? null : request.ModeratorPW.Trim());
            parameters.Add("@AttendeePW", string.IsNullOrWhiteSpace(request.AttendeePW) ? null : request.AttendeePW.Trim());
            parameters.Add("@UserId", userId);

            var savedMeeting = await conn.QueryFirstOrDefaultAsync<MeetingDto>(
                "wms.usp_ScheduleMeeting",
                parameters,
                commandType: CommandType.StoredProcedure
            );

            if (savedMeeting == null)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss} SCHEDULE] ❌ wms.usp_ScheduleMeeting returned NULL!");
                return (false, "Failed to schedule meeting.", null);
            }

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} SCHEDULE] 💾 wms.usp_ScheduleMeeting success! Meeting DbId: {savedMeeting.Id}, WebinarId: {savedMeeting.WebinarId}. Calling BBB...");

            // Immediately create the BigBlueButton meeting session upon schedule
            var conductorName = (string?)webinar.ConductorName;
            var (createdOnBbb, moderatorJoinUrl) = await CallBbbCreateMeetingInternalAsync(
                savedMeeting.Id,
                savedMeeting.WebinarId,
                savedMeeting.MeetingID,
                savedMeeting.Name,
                savedMeeting.MaxParticipants,
                savedMeeting.Duration,
                savedMeeting.Record,
                savedMeeting.AutoStartRecording,
                savedMeeting.AllowStartStopRecording,
                calculatedExpiryMinutes,
                savedMeeting.MeetingExpireWhenLastUserLeftInMinutes,
                savedMeeting.EndWhenNoModerator,
                savedMeeting.GuestPolicy,
                savedMeeting.MuteOnStart,
                savedMeeting.LockSettingsDisableMic,
                savedMeeting.LockSettingsDisableCam,
                savedMeeting.LockSettingsDisablePrivateChat,
                savedMeeting.WebcamsOnlyForModerator,
                savedMeeting.MeetingLayout,
                savedMeeting.LogoutURL,
                savedMeeting.LockSettingsPresenterPolicy,
                savedMeeting.ModeratorPW,
                savedMeeting.AttendeePW,
                conductorName,
                conn
            );

            if (createdOnBbb && !string.IsNullOrWhiteSpace(moderatorJoinUrl))
            {
                savedMeeting.IsMeetingCreated = true;
                savedMeeting.ModeratorJoinUrl = moderatorJoinUrl;
                savedMeeting.MeetingCreatedAt = DateTime.UtcNow;
            }

            _logger.LogInformation("[MeetingService] Meeting scheduled and BBB session processed (Created: {Created}) for Webinar: {WebinarId}",
                createdOnBbb, request.WebinarId);

            return (true, "Meeting scheduled and created successfully.", savedMeeting);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "[MeetingService] SQL Exception in ScheduleMeetingAsync: {Message}", ex.Message);
            return (false, ex.Message, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MeetingService] Exception in ScheduleMeetingAsync: {Message}", ex.Message);
            return (false, "An unexpected error occurred while scheduling the meeting.", null);
        }
    }

    public async Task<MeetingDto?> GetMeetingByWebinarIdAsync(long webinarId)
    {
        _logger.LogInformation("[MeetingService] GetMeetingByWebinarId called for WebinarId: {WebinarId}", webinarId);
        try
        {
            using var conn = new SqlConnection(_connectionString);
            var meeting = await conn.QueryFirstOrDefaultAsync<MeetingDto>(
                "wms.usp_GetMeetingByWebinarId",
                new { WebinarId = webinarId },
                commandType: CommandType.StoredProcedure
            );
            return meeting;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MeetingService] Exception in GetMeetingByWebinarIdAsync: {Message}", ex.Message);
            return null;
        }
    }

    public async Task<(bool success, string message, string? moderatorJoinUrl)> RegenerateModeratorLinkAsync(long webinarId)
    {
        _logger.LogInformation("[MeetingService] RegenerateModeratorLink called for WebinarId: {WebinarId}", webinarId);

        try
        {
            if (webinarId <= 0)
                return (false, "Valid Webinar ID is required.", null);

            using var conn = new SqlConnection(_connectionString);

            var meeting = await conn.QueryFirstOrDefaultAsync<PendingMeetingScheduleDto>(
                "wms.sp_ModeratorLinkRegenerate",
                new { WebinarId = webinarId },
                commandType: CommandType.StoredProcedure
            );

            if (meeting == null)
            {
                return (false, "No scheduled meeting configuration found for this webinar.", null);
            }

            int effectiveMaxParticipants = (meeting.TotalRegistrations > 0 ? meeting.TotalRegistrations : meeting.MaxParticipants) + _graceParticipantCount;

            var (success, newModeratorJoinUrl) = await CallBbbCreateMeetingInternalAsync(
                meeting.Id,
                meeting.WebinarId,
                meeting.MeetingID,
                meeting.Name,
                effectiveMaxParticipants,
                meeting.Duration,
                meeting.Record,
                meeting.AutoStartRecording,
                meeting.AllowStartStopRecording,
                meeting.MeetingExpireIfNoUserJoinedInMinutes,
                meeting.MeetingExpireWhenLastUserLeftInMinutes,
                meeting.EndWhenNoModerator,
                meeting.GuestPolicy,
                meeting.MuteOnStart,
                meeting.LockSettingsDisableMic,
                meeting.LockSettingsDisableCam,
                meeting.LockSettingsDisablePrivateChat,
                meeting.WebcamsOnlyForModerator,
                meeting.MeetingLayout,
                meeting.LogoutURL,
                meeting.LockSettingsPresenterPolicy,
                meeting.ModeratorPW,
                meeting.AttendeePW,
                meeting.ConductorName,
                conn
            );

            if (!success || string.IsNullOrWhiteSpace(newModeratorJoinUrl))
            {
                return (false, "Failed to regenerate moderator link on BigBlueButton.", null);
            }

            _logger.LogInformation("[MeetingService] Successfully regenerated moderator link for WebinarId: {WebinarId}, MeetingID: {MeetingID}",
                webinarId, meeting.MeetingID);

            return (true, "Moderator link regenerated successfully.", newModeratorJoinUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MeetingService] Exception in RegenerateModeratorLinkAsync: {Message}", ex.Message);
            return (false, "An error occurred while regenerating the moderator link: " + ex.Message, null);
        }
    }

    private async Task<(bool success, string? moderatorJoinUrl)> CallBbbCreateMeetingInternalAsync(
        long meetingId,
        long webinarId,
        string meetingID,
        string name,
        int maxParticipants,
        int duration,
        bool record,
        bool autoStartRecording,
        bool allowStartStopRecording,
        int expireIfNoUserJoined,
        int expireWhenLastUserLeft,
        bool endWhenNoModerator,
        string guestPolicy,
        bool muteOnStart,
        bool lockSettingsDisableMic,
        bool lockSettingsDisableCam,
        bool lockSettingsDisablePrivateChat,
        bool webcamsOnlyForModerator,
        string meetingLayout,
        string? logoutURL,
        string? lockSettingsPresenterPolicy,
        string? moderatorPW,
        string? attendeePW,
        string? conductorName,
        SqlConnection conn)
    {
        try
        {
            var parameters = new List<KeyValuePair<string, string>>
            {
                new("name", name.Trim()),
                new("meetingID", meetingID.Trim()),
                new("maxParticipants", maxParticipants.ToString()),
                // Pass duration=0 to BigBlueButton so it never auto-terminates the meeting due to timer expiration
                new("duration", "0"),
                new("record", record ? "true" : "false"),
                new("autoStartRecording", autoStartRecording ? "true" : "false"),
                new("allowStartStopRecording", allowStartStopRecording ? "true" : "false"),
                new("meetingExpireIfNoUserJoinedInMinutes", expireIfNoUserJoined.ToString()),
                new("meetingExpireWhenLastUserLeftInMinutes", expireWhenLastUserLeft.ToString()),
                new("endWhenNoModerator", endWhenNoModerator ? "true" : "false"),
                new("guestPolicy", string.IsNullOrWhiteSpace(guestPolicy) ? "ALWAYS_ACCEPT" : guestPolicy.Trim()),
                new("muteOnStart", muteOnStart ? "true" : "false"),
                new("lockSettingsDisableMic", lockSettingsDisableMic ? "true" : "false"),
                new("lockSettingsDisableCam", lockSettingsDisableCam ? "true" : "false"),
                new("lockSettingsDisablePrivateChat", lockSettingsDisablePrivateChat ? "true" : "false"),
                new("webcamsOnlyForModerator", webcamsOnlyForModerator ? "true" : "false"),
                new("meetingLayout", string.IsNullOrWhiteSpace(meetingLayout) ? "UNIFIED_LAYOUT" : meetingLayout.Trim()),
                new("meta_webinarId", webinarId.ToString())
            };

            if (!string.IsNullOrWhiteSpace(logoutURL))
                parameters.Add(new("logoutURL", logoutURL.Trim()));

            if (!string.IsNullOrWhiteSpace(lockSettingsPresenterPolicy))
                parameters.Add(new("lockSettingsPresenterPolicy", lockSettingsPresenterPolicy.Trim()));

            if (!string.IsNullOrWhiteSpace(moderatorPW))
                parameters.Add(new("moderatorPW", moderatorPW.Trim()));

            if (!string.IsNullOrWhiteSpace(attendeePW))
                parameters.Add(new("attendeePW", attendeePW.Trim()));

            if (!string.IsNullOrWhiteSpace(_serverToServerUrl) && !_serverToServerUrl.Equals("nothing now yet", StringComparison.OrdinalIgnoreCase))
            {
                var callbackWithId = _serverToServerUrl.Contains('?')
                    ? $"{_serverToServerUrl}&meetingID={Uri.EscapeDataString(meetingID)}"
                    : $"{_serverToServerUrl}?meetingID={Uri.EscapeDataString(meetingID)}";

                parameters.Add(new("meetingEndedURL", callbackWithId));
                parameters.Add(new("meetingKeepEvents", "true"));
                parameters.Add(new("meta_analytics-callback-url", callbackWithId));
            }

            var queryString = string.Join("&", parameters.Select(p =>
                $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

            var dataToHash = "create" + queryString + _sharedSecret;
            using var sha1 = SHA1.Create();
            var checksum = Convert.ToHexString(sha1.ComputeHash(Encoding.UTF8.GetBytes(dataToHash))).ToLowerInvariant();
            var createUrl = $"{_createMeetingApi}?{queryString}&checksum={checksum}";

            var httpClient = _httpClientFactory.CreateClient("BbbClient");
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] 🌐 Calling BigBlueButton /api/create for MeetingID '{meetingID}' (WebinarId: {webinarId})...");
            var createResponse = await httpClient.GetAsync(createUrl);
            var responseXml = await createResponse.Content.ReadAsStringAsync();

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] 📥 BBB Create Response XML:\n{responseXml}");

            var xdoc = XDocument.Parse(responseXml);
            var returncode = xdoc.Root?.Element("returncode")?.Value;

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] 🔎 Parsed returncode: '{returncode}'");

            if (!string.Equals(returncode, "SUCCESS", StringComparison.OrdinalIgnoreCase))
            {
                var messageKey = xdoc.Root?.Element("messageKey")?.Value;
                var message = xdoc.Root?.Element("message")?.Value ?? "Failed to create/verify meeting on BigBlueButton.";
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] ❌ BBB Create Failed! Code: {messageKey}, Message: {message}");
                _logger.LogWarning("[MeetingService] BBB create failed for MeetingID '{MeetingID}': {Code} - {Msg}",
                    meetingID, messageKey, message);
                return (false, null);
            }

            var actualModeratorPw = !string.IsNullOrWhiteSpace(moderatorPW)
                ? moderatorPW
                : xdoc.Root?.Element("moderatorPW")?.Value ?? "mp";

            var adminFullName = string.IsNullOrWhiteSpace(conductorName) ? "Admin Moderator" : conductorName;
            var joinParams = new List<KeyValuePair<string, string>>
            {
                new("fullName", adminFullName),
                new("meetingID", meetingID),
                new("password", actualModeratorPw),
                new("redirect", "true")
            };

            var joinQuery = string.Join("&", joinParams.Select(p =>
                $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

            var joinDataToHash = "join" + joinQuery + _sharedSecret;
            using var sha1Join = SHA1.Create();
            var joinChecksum = Convert.ToHexString(sha1Join.ComputeHash(Encoding.UTF8.GetBytes(joinDataToHash))).ToLowerInvariant();
            var newModeratorJoinUrl = $"{_joinMeetingApi}?{joinQuery}&checksum={joinChecksum}";

            var nowUtc = DateTime.UtcNow;
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] 💾 Updating wms.Meetings (IsMeetingCreated = 1, MeetingCreatedAt = {nowUtc:yyyy-MM-dd HH:mm:ss} UTC)...");
            await conn.ExecuteAsync(
                "wms.usp_MarkMeetingCreated",
                new { Id = meetingId, MeetingCreatedAt = nowUtc, ModeratorJoinUrl = newModeratorJoinUrl },
                commandType: CommandType.StoredProcedure
            );

            // Synchronize attendee links for this webinar
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] 👥 Synchronizing attendee links for Webinar {webinarId}...");
            await SyncAttendeeLinksInternalAsync(meetingId, webinarId, meetingID, attendeePW, conn);

            // Queue personalized meeting join emails
            try
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] 📨 Queueing meeting join emails...");
                await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.sp_QueueAttendeeMeetingJoinEmails",
                    new { MeetingId = meetingId, WebinarId = webinarId },
                    commandType: CommandType.StoredProcedure
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-CREATE] ⚠️ Non-fatal exception queueing emails: {ex.Message}");
                _logger.LogWarning(ex, "[MeetingService] Non-fatal exception queueing meeting join emails: {Message}", ex.Message);
            }

            // Register recording tracking with BBB internalMeetingID
            var internalMeetingId = xdoc.Root?.Element("internalMeetingID")?.Value?.Trim();
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-RECORDING] 🆔 Extracted internalMeetingID from BBB XML: '{internalMeetingId}'");

            if (!string.IsNullOrWhiteSpace(internalMeetingId))
            {
                try
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-RECORDING] 💾 Calling wms.usp_RegisterWebinarRecording (WebinarId: {webinarId}, MeetingId: {meetingId}, MeetingIDString: '{meetingID}', RecordId: '{internalMeetingId}')...");
                    await conn.ExecuteAsync(
                        "wms.usp_RegisterWebinarRecording",
                        new
                        {
                            WebinarId = webinarId,
                            MeetingId = meetingId,
                            MeetingIDString = meetingID,
                            RecordId = internalMeetingId
                        },
                        commandType: CommandType.StoredProcedure
                    );
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-RECORDING] ✅ SUCCESS: RecordId '{internalMeetingId}' INSERTED into wms.WebinarRecordings table (Status: WAITING_FOR_END)!");
                    _logger.LogInformation("[MeetingService] Registered recording tracking for MeetingID '{MeetingID}', RecordId: '{RecordId}'",
                        meetingID, internalMeetingId);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-RECORDING] ❌ ERROR: Failed executing wms.usp_RegisterWebinarRecording: {ex.Message}");
                    _logger.LogWarning(ex, "[MeetingService] Could not register recording tracking for '{MeetingID}': {Msg}", meetingID, ex.Message);
                }
            }
            else
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss} BBB-RECORDING] ⚠️ WARNING: internalMeetingID was NULL or EMPTY in BBB create response! Cannot register recording tracking.");
            }

            // Sync Google Calendar events with the new join link
            try
            {
                await _googleCalendarService.UpdateCalendarEventsWithJoinLinkAsync(webinarId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[MeetingService] Non-fatal exception updating Google Calendar events: {Message}", ex.Message);
            }

            return (true, newModeratorJoinUrl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[MeetingService] Exception in CallBbbCreateMeetingInternalAsync for MeetingID '{MeetingID}': {Message}",
                meetingID, ex.Message);
            return (false, null);
        }
    }

    private async Task SyncAttendeeLinksInternalAsync(
        long meetingId,
        long webinarId,
        string meetingID,
        string? meetingAttendeePW,
        SqlConnection conn)
    {
        try
        {
            var attendees = (await conn.QueryAsync<AttendeeMeetingParamDto>(
                "wms.sp_GetWebinarRegistartionsMeetingParams",
                new { WebinarId = webinarId },
                commandType: CommandType.StoredProcedure
            )).ToList();

            var missingAttendees = attendees.Where(a => !a.HasLink || string.IsNullOrWhiteSpace(a.ExistingJoinLink)).ToList();
            if (missingAttendees.Count == 0) return;

            var attendeePw = !string.IsNullOrWhiteSpace(meetingAttendeePW)
                ? meetingAttendeePW
                : (!string.IsNullOrWhiteSpace(attendees[0].AttendeePW) ? attendees[0].AttendeePW : "ap");

            foreach (var student in missingAttendees)
            {
                var studentName = !string.IsNullOrWhiteSpace(student.FullName)
                    ? student.FullName
                    : (!string.IsNullOrWhiteSpace(student.Email) ? student.Email : $"Student-{student.UserId}");

                var joinParams = new List<KeyValuePair<string, string>>
                {
                    new("fullName", studentName),
                    new("meetingID", meetingID),
                    new("password", attendeePw),
                    new("redirect", "true")
                };

                if (!string.IsNullOrWhiteSpace(student.CustomUserId))
                {
                    joinParams.Add(new("userID", student.CustomUserId.Trim()));
                }

                var joinQuery = string.Join("&", joinParams.Select(p =>
                    $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

                var joinHash = "join" + joinQuery + _sharedSecret;
                using var sha1Join = SHA1.Create();
                var joinChecksum = Convert.ToHexString(sha1Join.ComputeHash(Encoding.UTF8.GetBytes(joinHash))).ToLowerInvariant();
                var attendeeJoinUrl = $"{_joinMeetingApi}?{joinQuery}&checksum={joinChecksum}";

                await conn.ExecuteAsync(
                    "wms.sp_StoreAttendeeLink",
                    new
                    {
                        MeetingId = meetingId,
                        WebinarRegistrationId = student.WebinarRegistrationId,
                        JoinLink = attendeeJoinUrl,
                        IsCreatedLink = true
                    },
                    commandType: CommandType.StoredProcedure
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[MeetingService] Non-fatal exception while syncing attendee links: {Message}", ex.Message);
        }
    }

    public async Task<(bool success, string message, int recordedCount)> ProcessMeetingEndedAsync(string? meetingId, string? rawPayload)
    {
        _logger.LogInformation("[MeetingService] ProcessMeetingEndedAsync triggered for MeetingID: '{MeetingID}'. Payload length: {PayloadLen}",
            meetingId, rawPayload?.Length ?? 0);

        if (string.IsNullOrWhiteSpace(meetingId) && !string.IsNullOrWhiteSpace(rawPayload))
        {
            // Attempt to extract meetingID from JSON payload if present
            try
            {
                using var doc = JsonDocument.Parse(rawPayload);
                if (doc.RootElement.TryGetProperty("meetingId", out var midProp) ||
                    doc.RootElement.TryGetProperty("meetingID", out midProp))
                {
                    meetingId = midProp.GetString();
                }
            }
            catch { }
        }

        if (string.IsNullOrWhiteSpace(meetingId))
        {
            return (false, "Missing meetingId for ended meeting notification.", 0);
        }

        meetingId = meetingId.Trim();
        using var conn = new SqlConnection(_connectionString);

        // Verify meeting exists in our database
        var meeting = await conn.QueryFirstOrDefaultAsync<MeetingDto>(
            "SELECT * FROM wms.Meetings WHERE MeetingID = @MeetingID",
            new { MeetingID = meetingId }
        );

        if (meeting == null)
        {
            _logger.LogWarning("[MeetingService] Meeting with MeetingID '{MeetingID}' not found in database.", meetingId);
            return (false, $"Meeting '{meetingId}' not found in database.", 0);
        }

        // Update recording status to PROCESSING so the sync service polls BBB for the video
        try
        {
            await conn.ExecuteAsync(
                "wms.usp_MarkRecordingProcessing",
                new { MeetingIDString = meetingId },
                commandType: CommandType.StoredProcedure
            );
            _logger.LogInformation("[MeetingService] Marked recording as PROCESSING for MeetingID '{MeetingID}'.", meetingId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[MeetingService] Could not update recording status to PROCESSING for '{MeetingID}': {Msg}", meetingId, ex.Message);
        }

        int defaultDurationSeconds = meeting.Duration > 0 ? (meeting.Duration * 60) : 7200;
        int recordedCount = 0;

        // List of attendees to record: (CustomUserId, DurationSeconds, JoinedAt, LeftAt)
        var attendeesToProcess = new List<(string CustomUserId, int DurationSeconds, DateTime? JoinedAt, DateTime? LeftAt)>();

        // 1. Try parsing raw JSON payload (e.g. from meta_analytics-callback-url)
        if (!string.IsNullOrWhiteSpace(rawPayload))
        {
            try
            {
                using var jsonDoc = JsonDocument.Parse(rawPayload);
                var root = jsonDoc.RootElement;

                JsonElement usersElement;
                bool foundUsers = false;

                if (root.ValueKind == JsonValueKind.Array)
                {
                    usersElement = root;
                    foundUsers = true;
                }
                else if (root.TryGetProperty("users", out usersElement) && usersElement.ValueKind == JsonValueKind.Array)
                {
                    foundUsers = true;
                }
                else if (root.TryGetProperty("data", out usersElement) && usersElement.ValueKind == JsonValueKind.Array)
                {
                    foundUsers = true;
                }

                if (foundUsers)
                {
                    foreach (var u in usersElement.EnumerateArray())
                    {
                        string? uid = null;
                        if (u.TryGetProperty("userId", out var p1) || u.TryGetProperty("userID", out p1) || u.TryGetProperty("id", out p1))
                            uid = p1.GetString();

                        int durationSec = defaultDurationSeconds;
                        if (u.TryGetProperty("duration", out var durProp) && durProp.TryGetInt32(out var dVal))
                            durationSec = dVal;
                        else if (u.TryGetProperty("totalTime", out var ttProp) && ttProp.TryGetInt32(out var ttVal))
                            durationSec = ttVal;

                        if (!string.IsNullOrWhiteSpace(uid) && uid.StartsWith("UserId -", StringComparison.OrdinalIgnoreCase))
                        {
                            attendeesToProcess.Add((uid.Trim(), durationSec, null, null));
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[MeetingService] Could not parse raw analytics JSON: {Msg}", ex.Message);
            }
        }

        // 2. If no attendees found from JSON payload, query BBB getMeetingInfo API
        if (attendeesToProcess.Count == 0 && !string.IsNullOrWhiteSpace(_createMeetingApi))
        {
            try
            {
                var baseApi = _createMeetingApi.EndsWith("/create", StringComparison.OrdinalIgnoreCase)
                    ? _createMeetingApi[..^"/create".Length]
                    : _createMeetingApi;

                var getMeetingInfoUrl = $"{baseApi}/getMeetingInfo";
                var getInfoQuery = $"meetingID={Uri.EscapeDataString(meetingId)}";
                var dataToHash = "getMeetingInfo" + getInfoQuery + _sharedSecret;

                using var sha1 = SHA1.Create();
                var checksum = Convert.ToHexString(sha1.ComputeHash(Encoding.UTF8.GetBytes(dataToHash))).ToLowerInvariant();
                var fullUrl = $"{getMeetingInfoUrl}?{getInfoQuery}&checksum={checksum}";

                var httpClient = _httpClientFactory.CreateClient("BbbClient");
                httpClient.Timeout = TimeSpan.FromSeconds(15);

                var response = await httpClient.GetAsync(fullUrl);
                if (response.IsSuccessStatusCode)
                {
                    var xmlContent = await response.Content.ReadAsStringAsync();
                    var xdoc = XDocument.Parse(xmlContent);
                    var returncode = xdoc.Root?.Element("returncode")?.Value;

                    if (string.Equals(returncode, "SUCCESS", StringComparison.OrdinalIgnoreCase))
                    {
                        var users = xdoc.Root?.Element("attendees")?.Elements("user") ?? Enumerable.Empty<XElement>();
                        foreach (var u in users)
                        {
                            var uid = u.Element("userID")?.Value?.Trim();
                            var role = u.Element("role")?.Value?.Trim();

                            // Filter to student attendees
                            if (!string.IsNullOrWhiteSpace(uid) && (uid.StartsWith("UserId -", StringComparison.OrdinalIgnoreCase) || string.Equals(role, "VIEWER", StringComparison.OrdinalIgnoreCase)))
                            {
                                attendeesToProcess.Add((uid, defaultDurationSeconds, null, null));
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[MeetingService] getMeetingInfo call failed for {MeetingID}: {Msg}", meetingId, ex.Message);
            }
        }

        // 3. Fallback: If BBB already purged the meeting from RAM, record all registered students for this webinar
        if (attendeesToProcess.Count == 0)
        {
            var studentCustomUids = (await conn.QueryAsync<string>(
                @"SELECT DISTINCT wr.CustomUserId 
                  FROM wms.WebinarRegistrations wr
                  WHERE wr.WebinarId = @WebinarId AND wr.CustomUserId IS NOT NULL",
                new { WebinarId = meeting.WebinarId }
            )).ToList();

            foreach (var customUid in studentCustomUids)
            {
                attendeesToProcess.Add((customUid, defaultDurationSeconds, null, null));
            }
        }

        // 4. Save into wms.MeetingAttendance and complete wms.WebinarCompleted
        foreach (var attendee in attendeesToProcess)
        {
            try
            {
                var result = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.sp_RecordAttendanceAndCompleteWebinar",
                    new
                    {
                        MeetingIDString = meetingId,
                        CustomUserId = attendee.CustomUserId,
                        AttendedDuration = attendee.DurationSeconds,
                        JoinedAt = attendee.JoinedAt,
                        LeftAt = attendee.LeftAt
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (result != null && result.Success == 1)
                {
                    recordedCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[MeetingService] Failed recording attendance for {CustomUserId}: {Msg}", attendee.CustomUserId, ex.Message);
            }
        }

        // Ensure the Webinar itself is marked as Completed (IsCompleted = 1)
        try
        {
            await conn.ExecuteAsync(
                "wms.usp_MarkWebinarCompleted",
                new { WebinarId = meeting.WebinarId },
                commandType: CommandType.StoredProcedure
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[MeetingService] Could not mark Webinar {WebinarId} as completed: {Msg}", meeting.WebinarId, ex.Message);
        }

        _logger.LogInformation("[MeetingService] Completed meeting processing for '{MeetingID}'. Recorded {Count} student attendance(s).",
            meetingId, recordedCount);

        return (true, $"Recorded {recordedCount} student attendance record(s).", recordedCount);
    }

    private class WebinarScheduleInfo
    {
        public long Id { get; set; }
        public string WebinarName { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string? ConductorName { get; set; }
        public int? CreatedBy { get; set; }
    }
}

