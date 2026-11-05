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
    private readonly string _sharedSecret;
    private readonly string _createMeetingApi;
    private readonly string _joinMeetingApi;
    private readonly string _serverToServerUrl;

    public MeetingService(IConfiguration config, IHttpClientFactory httpClientFactory, ILogger<MeetingService> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
                         ?? throw new InvalidOperationException("Connection string not configured.");
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _sharedSecret = config["BBB:SharedSecret"]?.Trim() ?? string.Empty;
        _createMeetingApi = config["BBB:CreateMeetingApi"]?.Trim() ?? string.Empty;
        _joinMeetingApi = config["BBB:JoinMeetingApi"]?.Trim() ?? string.Empty;
        _serverToServerUrl = (config["BBB:ServerToServerUrl"] ?? config["BBB:EndedURL"] ?? string.Empty).Trim();
    }

    public async Task<(bool success, string message, MeetingDto? meeting)> ScheduleMeetingAsync(ScheduleMeetingRequest request, int userId)
    {
        _logger.LogInformation("[MeetingService] ScheduleMeeting called for WebinarId: {WebinarId}, MeetingID: {MeetingID}, UserId: {UserId}",
            request.WebinarId, request.MeetingID, userId);

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

            var parameters = new DynamicParameters();
            parameters.Add("@WebinarId", request.WebinarId);
            parameters.Add("@MeetingID", request.MeetingID.Trim());
            parameters.Add("@Name", request.Name.Trim());
            parameters.Add("@MaxParticipants", request.MaxParticipants);
            parameters.Add("@Duration", request.Duration);
            parameters.Add("@Record", request.Record);
            parameters.Add("@AutoStartRecording", request.AutoStartRecording);
            parameters.Add("@AllowStartStopRecording", request.AllowStartStopRecording);
            parameters.Add("@LogoutURL", string.IsNullOrWhiteSpace(request.LogoutURL) ? null : request.LogoutURL.Trim());
            parameters.Add("@MeetingExpireIfNoUserJoinedInMinutes", request.MeetingExpireIfNoUserJoinedInMinutes);
            parameters.Add("@MeetingExpireWhenLastUserLeftInMinutes", request.MeetingExpireWhenLastUserLeftInMinutes);
            parameters.Add("@EndWhenNoModerator", request.EndWhenNoModerator);
            parameters.Add("@GuestPolicy", string.IsNullOrWhiteSpace(request.GuestPolicy) ? "ALWAYS_ACCEPT" : request.GuestPolicy.Trim());
            parameters.Add("@MuteOnStart", request.MuteOnStart);
            parameters.Add("@MeetingLayout", string.IsNullOrWhiteSpace(request.MeetingLayout) ? "UNIFIED_LAYOUT" : request.MeetingLayout.Trim());
            parameters.Add("@LockSettingsPresenterPolicy", string.IsNullOrWhiteSpace(request.LockSettingsPresenterPolicy) ? "default" : request.LockSettingsPresenterPolicy.Trim());
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
                return (false, "Failed to schedule meeting.", null);
            }

            _logger.LogInformation("[MeetingService] Meeting scheduled successfully with Id: {MeetingId} for Webinar: {WebinarId}",
                savedMeeting.Id, request.WebinarId);

            return (true, "Meeting scheduled successfully.", savedMeeting);
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

            // Ensure meeting session is active/created on BigBlueButton
            var parameters = new List<KeyValuePair<string, string>>
            {
                new("name", meeting.Name.Trim()),
                new("meetingID", meeting.MeetingID.Trim()),
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
                parameters.Add(new("logoutURL", meeting.LogoutURL.Trim()));

            if (!string.IsNullOrWhiteSpace(meeting.LockSettingsPresenterPolicy))
                parameters.Add(new("lockSettingsPresenterPolicy", meeting.LockSettingsPresenterPolicy.Trim()));

            if (!string.IsNullOrWhiteSpace(meeting.ModeratorPW))
                parameters.Add(new("moderatorPW", meeting.ModeratorPW.Trim()));

            if (!string.IsNullOrWhiteSpace(meeting.AttendeePW))
                parameters.Add(new("attendeePW", meeting.AttendeePW.Trim()));

            if (!string.IsNullOrWhiteSpace(_serverToServerUrl) && !_serverToServerUrl.Equals("nothing now yet", StringComparison.OrdinalIgnoreCase))
            {
                parameters.Add(new("meetingEndedURL", _serverToServerUrl));
                parameters.Add(new("meetingKeepEvents", "true"));
                parameters.Add(new("meta_analytics-callback-url", _serverToServerUrl));
            }

            var queryString = string.Join("&", parameters.Select(p =>
                $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));

            var dataToHash = "create" + queryString + _sharedSecret;
            using var sha1 = SHA1.Create();
            var checksum = Convert.ToHexString(sha1.ComputeHash(Encoding.UTF8.GetBytes(dataToHash))).ToLowerInvariant();
            var createUrl = $"{_createMeetingApi}?{queryString}&checksum={checksum}";

            var httpClient = _httpClientFactory.CreateClient("BbbClient");
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            var createResponse = await httpClient.GetAsync(createUrl);
            var responseXml = await createResponse.Content.ReadAsStringAsync();

            var xdoc = XDocument.Parse(responseXml);
            var returncode = xdoc.Root?.Element("returncode")?.Value;

            if (!string.Equals(returncode, "SUCCESS", StringComparison.OrdinalIgnoreCase))
            {
                var messageKey = xdoc.Root?.Element("messageKey")?.Value;
                var message = xdoc.Root?.Element("message")?.Value ?? "Failed to create/verify meeting on BigBlueButton.";
                _logger.LogWarning("[MeetingService] BBB create failed during regenerate for MeetingID '{MeetingID}': {Code} - {Msg}",
                    meeting.MeetingID, messageKey, message);
                return (false, $"BigBlueButton response: {messageKey} - {message}", null);
            }

            // Generate fresh Moderator Join URL
            var moderatorPw = !string.IsNullOrWhiteSpace(meeting.ModeratorPW)
                ? meeting.ModeratorPW
                : xdoc.Root?.Element("moderatorPW")?.Value ?? "mp";

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
            var joinChecksum = Convert.ToHexString(sha1Join.ComputeHash(Encoding.UTF8.GetBytes(joinDataToHash))).ToLowerInvariant();
            var newModeratorJoinUrl = $"{_joinMeetingApi}?{joinQuery}&checksum={joinChecksum}";

            // Update database: replace ModeratorJoinUrl in both wms.Meetings and wms.Webinars
            var nowUtc = DateTime.UtcNow;
            await conn.ExecuteAsync(
                "wms.usp_MarkMeetingCreated",
                new { Id = meeting.Id, MeetingCreatedAt = nowUtc, ModeratorJoinUrl = newModeratorJoinUrl },
                commandType: CommandType.StoredProcedure
            );

            // Synchronize attendee links for this webinar as well
            await SyncAttendeeLinksInternalAsync(meeting, conn);

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

    private async Task SyncAttendeeLinksInternalAsync(PendingMeetingScheduleDto meeting, SqlConnection conn)
    {
        try
        {
            var attendees = (await conn.QueryAsync<AttendeeMeetingParamDto>(
                "wms.sp_GetWebinarRegistartionsMeetingParams",
                new { WebinarId = meeting.WebinarId },
                commandType: CommandType.StoredProcedure
            )).ToList();

            var missingAttendees = attendees.Where(a => !a.HasLink || string.IsNullOrWhiteSpace(a.ExistingJoinLink)).ToList();
            if (missingAttendees.Count == 0) return;

            var attendeePw = !string.IsNullOrWhiteSpace(meeting.AttendeePW)
                ? meeting.AttendeePW
                : (!string.IsNullOrWhiteSpace(attendees[0].AttendeePW) ? attendees[0].AttendeePW : "ap");

            foreach (var student in missingAttendees)
            {
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

                var joinHash = "join" + joinQuery + _sharedSecret;
                using var sha1Join = SHA1.Create();
                var joinChecksum = Convert.ToHexString(sha1Join.ComputeHash(Encoding.UTF8.GetBytes(joinHash))).ToLowerInvariant();
                var attendeeJoinUrl = $"{_joinMeetingApi}?{joinQuery}&checksum={joinChecksum}";

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

        // 3. Fallback: If BBB already purged the meeting from RAM, record all registered students with join links
        if (attendeesToProcess.Count == 0)
        {
            var existingLinks = (await conn.QueryAsync<string>(
                @"SELECT wr.CustomUserId 
                  FROM wms.AttendeeMeetingLinks aml
                  JOIN wms.WebinarRegistrations wr ON wr.Id = aml.WebinarRegistrationId
                  WHERE aml.MeetingId = @MeetingDbId AND wr.CustomUserId IS NOT NULL",
                new { MeetingDbId = meeting.Id }
            )).ToList();

            foreach (var customUid in existingLinks)
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

        _logger.LogInformation("[MeetingService] Completed meeting processing for '{MeetingID}'. Recorded {Count} student attendance(s).",
            meetingId, recordedCount);

        return (true, $"Recorded {recordedCount} student attendance record(s).", recordedCount);
    }
}

