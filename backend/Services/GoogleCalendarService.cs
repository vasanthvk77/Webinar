using System;
using System.Collections.Generic;
using System.Data;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public class GoogleCalendarService : IGoogleCalendarService
    {
        private readonly GoogleCalendarOptions _options;
        private readonly string _connectionString;
        private readonly string _frontendUrl;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<GoogleCalendarService> _logger;

        public GoogleCalendarService(
            IOptions<GoogleCalendarOptions> options,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<GoogleCalendarService> logger)
        {
            _options = options.Value;
            _connectionString = configuration.GetConnectionString("DefaultConnection")
                                ?? throw new InvalidOperationException("DefaultConnection not found");

            var frontendArray = configuration.GetSection("frontend").Get<string[]>();
            _frontendUrl = (frontendArray != null && frontendArray.Length > 0)
                ? frontendArray[0].TrimEnd('/')
                : "http://localhost:5173";

            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public string GetAuthorizationUrl(int userId, long webinarId)
        {
            var state = $"{userId}_{webinarId}";
            var scope = "https://www.googleapis.com/auth/calendar.events";
            var url = $"{_options.AuthUri}?" +
                      $"client_id={HttpUtility.UrlEncode(_options.ClientId)}" +
                      $"&redirect_uri={HttpUtility.UrlEncode(_options.RedirectUri)}" +
                      $"&response_type=code" +
                      $"&scope={HttpUtility.UrlEncode(scope)}" +
                      $"&access_type=offline" +
                      $"&prompt=consent" +
                      $"&state={HttpUtility.UrlEncode(state)}";

            return url;
        }

        public async Task<(bool success, string message, string? htmlRedirect)> HandleCallbackAsync(string code, string? state)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return (false, "Missing authorization code from Google.", null);
            }

            try
            {
                var client = _httpClientFactory.CreateClient();
                var tokenReq = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = _options.ClientId,
                    ["client_secret"] = _options.ClientSecret,
                    ["code"] = code,
                    ["grant_type"] = "authorization_code",
                    ["redirect_uri"] = _options.RedirectUri
                });

                var tokenRes = await client.PostAsync(_options.TokenUri, tokenReq);
                var tokenJson = await tokenRes.Content.ReadAsStringAsync();

                if (!tokenRes.IsSuccessStatusCode)
                {
                    _logger.LogError("[GoogleCalendarService] Token exchange failed: {Error}", tokenJson);
                    return (false, $"Google authorization failed: {tokenJson}", null);
                }

                using var doc = JsonDocument.Parse(tokenJson);
                var root = doc.RootElement;
                var accessToken = root.GetProperty("access_token").GetString() ?? "";
                var refreshToken = root.TryGetProperty("refresh_token", out var rf) ? rf.GetString() : null;
                var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600;
                var scope = root.TryGetProperty("scope", out var sc) ? sc.GetString() : "";

                var expiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 60);

                int userId = 0;
                long webinarId = 0;
                if (!string.IsNullOrWhiteSpace(state))
                {
                    var parts = state.Split('_');
                    if (parts.Length >= 1) int.TryParse(parts[0], out userId);
                    if (parts.Length >= 2) long.TryParse(parts[1], out webinarId);
                }

                if (userId <= 0)
                {
                    return (false, "Invalid user session state.", null);
                }

                // Save or update tokens in database via Stored Procedure
                using var conn = new SqlConnection(_connectionString);
                await conn.ExecuteAsync(
                    "wms.usp_SaveUserGoogleToken",
                    new
                    {
                        UserId = userId,
                        AccessToken = accessToken,
                        RefreshToken = refreshToken,
                        ExpiresAt = expiresAt,
                        Scope = scope
                    },
                    commandType: CommandType.StoredProcedure
                );

                // If webinarId was part of the state, automatically insert the event now!
                if (webinarId > 0)
                {
                    await AddWebinarToCalendarAsync(userId, webinarId);
                }

                var successHtml = $@"
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Google Calendar Connected</title>
                        <style>
                            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FFFBEB; }}
                            .card {{ background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; max-width: 400px; }}
                            h2 {{ color: #dba009; margin-top: 0; }}
                            p {{ color: #475569; font-size: 14px; line-height: 1.5; }}
                            .btn {{ display: inline-block; margin-top: 16px; padding: 10px 20px; background: #EAB308; color: #1E293B; border-radius: 8px; font-weight: 700; text-decoration: none; }}
                        </style>
                    </head>
                    <body>
                        <div class='card'>
                            <h2>Calendar Connected!</h2>
                            <p>Your Google Calendar is successfully connected and the webinar event has been scheduled with your reminders.</p>
                            <a href='{_frontendUrl}/dashboard/webinars' class='btn'>Return to Webinars</a>
                        </div>
                        <script>
                            if (window.opener) {{
                                window.opener.postMessage({{ type: 'GOOGLE_CALENDAR_SUCCESS' }}, '*');
                                setTimeout(() => window.close(), 1500);
                            }} else {{
                                setTimeout(() => window.location.href = '{_frontendUrl}/dashboard/webinars', 2000);
                            }}
                        </script>
                    </body>
                    </html>";

                return (true, "Google Calendar authorization successful.", successHtml);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GoogleCalendarService] HandleCallback error: {Message}", ex.Message);
                return (false, $"An unexpected error occurred: {ex.Message}", null);
            }
        }

        public async Task<AddCalendarEventResponse> AddWebinarToCalendarAsync(int userId, long webinarId, string? timezone = null)
        {
            try
            {
                using var conn = new SqlConnection(_connectionString);

                // 1. Get stored token for this user via Stored Procedure
                var tokenRecord = await conn.QueryFirstOrDefaultAsync<UserGoogleTokenRecord>(
                    "wms.usp_GetUserGoogleToken",
                    new { UserId = userId },
                    commandType: CommandType.StoredProcedure
                );

                if (tokenRecord == null || string.IsNullOrWhiteSpace(tokenRecord.AccessToken))
                {
                    var authUrl = GetAuthorizationUrl(userId, webinarId);
                    return new AddCalendarEventResponse
                    {
                        Success = false,
                        RequiresAuth = true,
                        AuthUrl = authUrl,
                        Message = "Google Calendar authorization required."
                    };
                }

                var client = _httpClientFactory.CreateClient();
                var accessToken = tokenRecord.AccessToken;

                // 2. Check if access token is expired; refresh if needed
                if (tokenRecord.ExpiresAt <= DateTime.UtcNow)
                {
                    if (string.IsNullOrWhiteSpace(tokenRecord.RefreshToken))
                    {
                        var authUrl = GetAuthorizationUrl(userId, webinarId);
                        return new AddCalendarEventResponse
                        {
                            Success = false,
                            RequiresAuth = true,
                            AuthUrl = authUrl,
                            Message = "Authorization expired. Please re-authorize Google Calendar."
                        };
                    }

                    var refreshReq = new FormUrlEncodedContent(new Dictionary<string, string>
                    {
                        ["client_id"] = _options.ClientId,
                        ["client_secret"] = _options.ClientSecret,
                        ["refresh_token"] = tokenRecord.RefreshToken,
                        ["grant_type"] = "refresh_token"
                    });

                    var refreshRes = await client.PostAsync(_options.TokenUri, refreshReq);
                    var refreshJson = await refreshRes.Content.ReadAsStringAsync();

                    if (!refreshRes.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("[GoogleCalendarService] Refresh token failed: {Res}", refreshJson);
                        var authUrl = GetAuthorizationUrl(userId, webinarId);
                        return new AddCalendarEventResponse
                        {
                            Success = false,
                            RequiresAuth = true,
                            AuthUrl = authUrl,
                            Message = "Google session expired. Please re-authorize Google Calendar."
                        };
                    }

                    using var rDoc = JsonDocument.Parse(refreshJson);
                    accessToken = rDoc.RootElement.GetProperty("access_token").GetString() ?? "";
                    var expSec = rDoc.RootElement.TryGetProperty("expires_in", out var eSec) ? eSec.GetInt32() : 3600;
                    var newExpiresAt = DateTime.UtcNow.AddSeconds(expSec - 60);

                    await conn.ExecuteAsync(
                        "wms.usp_UpdateUserGoogleAccessToken",
                        new { UserId = userId, AccessToken = accessToken, ExpiresAt = newExpiresAt },
                        commandType: CommandType.StoredProcedure
                    );
                }

                // 3. Fetch Webinar details via Stored Procedure
                var webinar = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_GetWebinarForCalendar",
                    new { WebinarId = webinarId },
                    commandType: CommandType.StoredProcedure
                );

                if (webinar == null)
                {
                    return new AddCalendarEventResponse
                    {
                        Success = false,
                        Message = "Webinar record not found."
                    };
                }

                DateTime startUtc = Convert.ToDateTime(webinar.StartTime);
                DateTime endUtc = Convert.ToDateTime(webinar.EndTime);

                // 4. Build Reminder Overrides dynamically from global options (Google Calendar allows max 5 overrides)
                var reminderOverrides = new List<object>();
                var rawOffsets = _options.ReminderOffsetsInMinutes ?? new List<int>();

                // Deduplicate and sort descending (e.g. 240, 120, 30)
                var offsets = rawOffsets.Distinct().Where(m => m > 0).OrderByDescending(x => x).ToList();

                if (offsets.Count > 0)
                {
                    int finalOffset = offsets.Last(); // e.g. 30 minutes before webinar start

                    // For final reminder (e.g. 30m): BOTH popup (device sound/chime & toast alert) AND email
                    reminderOverrides.Add(new { method = "popup", minutes = finalOffset });
                    reminderOverrides.Add(new { method = "email", minutes = finalOffset });

                    // For remaining offsets (e.g. 240m, 120m): ONLY email
                    foreach (var offset in offsets.Where(o => o != finalOffset))
                    {
                        if (reminderOverrides.Count < 5)
                        {
                            reminderOverrides.Add(new { method = "email", minutes = offset });
                        }
                    }
                }

                var joinLink = $"{_frontendUrl}/register?trackingId={webinar.ShareId}";
                var eventBody = new
                {
                    summary = (string)webinar.WebinarName,
                    description = $"Webinar Session: {webinar.WebinarName}\n" +
                                  $"Instructor: {webinar.ConductorName}\n" +
                                  $"Duration: {webinar.DurationMinutes} minutes\n\n" +
                                  $"Join Webinar Link: {joinLink}\n\n" +
                                  $"Scheduled via ProdesX Weblearn.",
                    location = joinLink,
                    start = new
                    {
                        dateTime = startUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                        timeZone = "UTC"
                    },
                    end = new
                    {
                        dateTime = endUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                        timeZone = "UTC"
                    },
                    reminders = new
                    {
                        useDefault = false,
                        overrides = reminderOverrides
                    }
                };

                var postJson = JsonSerializer.Serialize(eventBody);
                using var calendarReq = new HttpRequestMessage(
                    HttpMethod.Post,
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
                );
                calendarReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                calendarReq.Content = new StringContent(postJson, Encoding.UTF8, "application/json");

                var calResponse = await client.SendAsync(calendarReq);
                var calJson = await calResponse.Content.ReadAsStringAsync();

                if (!calResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("[GoogleCalendarService] Insert event failed: {Error}", calJson);

                    if (calResponse.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        var authUrl = GetAuthorizationUrl(userId, webinarId);
                        return new AddCalendarEventResponse
                        {
                            Success = false,
                            RequiresAuth = true,
                            AuthUrl = authUrl,
                            Message = "Calendar session expired. Please re-authorize."
                        };
                    }

                    return new AddCalendarEventResponse
                    {
                        Success = false,
                        Message = "Failed saving event to Google Calendar."
                    };
                }

                using var createdDoc = JsonDocument.Parse(calJson);
                var htmlLink = createdDoc.RootElement.TryGetProperty("htmlLink", out var hl)
                    ? hl.GetString()
                    : null;

                _logger.LogInformation("[GoogleCalendarService] Event created successfully for User {UserId}, Webinar {WebinarId}. Link: {Link}", userId, webinarId, htmlLink);

                return new AddCalendarEventResponse
                {
                    Success = true,
                    RequiresAuth = false,
                    EventLink = htmlLink,
                    Message = "Event successfully added to your Google Calendar!"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GoogleCalendarService] AddWebinarToCalendarAsync exception: {Message}", ex.Message);
                return new AddCalendarEventResponse
                {
                    Success = false,
                    Message = $"An error occurred while adding to Google Calendar: {ex.Message}"
                };
            }
        }
    }
}

