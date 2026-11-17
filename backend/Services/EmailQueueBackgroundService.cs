using System.Data;
using System.Net;
using System.Net.Mail;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;
using NodaTime;
using NodaTime.TimeZones;
using PhoneNumbers;
using WebinarApi.Hubs;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public class EmailQueueBackgroundService : BackgroundService
    {
        private readonly IServiceProvider                     _serviceProvider;
        private readonly IConfiguration                       _config;
        private readonly ILogger<EmailQueueBackgroundService> _logger;
        private readonly IHubContext<UsersHub>                _hubContext;
        private readonly string                               _connectionString;
        private readonly string                               _frontendUrl;
        private readonly string                               _templatePath;
        private readonly string                               _joinLinkTemplatePath;

        public EmailQueueBackgroundService(
            IServiceProvider serviceProvider,
            IConfiguration config,
            ILogger<EmailQueueBackgroundService> logger,
            IHubContext<UsersHub> hubContext)
        {
            _serviceProvider  = serviceProvider;
            _config           = config;
            _logger           = logger;
            _hubContext       = hubContext;
            _connectionString = config.GetConnectionString("DefaultConnection")
                              ?? throw new InvalidOperationException("Connection string not configured.");

            var frontendArray = config.GetSection("frontend").Get<string[]>();
            _frontendUrl      = (frontendArray != null && frontendArray.Length > 0)
                              ? frontendArray[0].TrimEnd('/')
                              : "http://localhost:5173";

            _templatePath         = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplete", "StudentWebinrNotification.html");
            _joinLinkTemplatePath = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplete", "MeetingInviteLinkNotification.html");
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[EmailQueueBackgroundService] Background email processor started.");

            try
            {
                // Ensure all SQL files (including webinars.sql) are initialized
                await WebinarApi.Database.DBInitializer.RunAsync(_config);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[EmailQueueBackgroundService] Startup DBInitializer notice: {Message}", ex.Message);
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessPendingEmailBatchAsync(stoppingToken);
                }
                catch (SqlException ex) when (ex.Number == 2812)
                {
                    _logger.LogWarning("[EmailQueueBackgroundService] Stored procedure missing, executing DBInitializer...");
                    try { await WebinarApi.Database.DBInitializer.RunAsync(_config); } catch { }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[EmailQueueBackgroundService] Unhandled error during batch processing: {Message}", ex.Message);
                }

                // Poll every 10 seconds
                await Task.Delay(10000, stoppingToken);
            }

            _logger.LogInformation("[EmailQueueBackgroundService] Background email processor stopped.");
        }

        private async Task ProcessPendingEmailBatchAsync(CancellationToken stoppingToken)
        {
            List<EmailQueueItemDto> items;

            // 1. Fetch pending batch using single connection
            using (var conn = new SqlConnection(_connectionString))
            {
                var rows = await conn.QueryAsync<EmailQueueItemDto>(
                    "wms.usp_GetPendingEmailQueueBatch",
                    new { BatchSize = 50 },
                    commandType: CommandType.StoredProcedure
                );
                items = rows.ToList();
            }

            if (items.Count == 0)
                return;

            _logger.LogInformation("[EmailQueueBackgroundService] Found {Count} pending emails to process.", items.Count);

            string templateContent = "";
            if (File.Exists(_templatePath))
            {
                templateContent = await File.ReadAllTextAsync(_templatePath, stoppingToken);
            }
            else
            {
                _logger.LogWarning("[EmailQueueBackgroundService] Invite email template not found at {Path}, using fallback.", _templatePath);
            }

            string joinLinkTemplateContent = "";
            if (File.Exists(_joinLinkTemplatePath))
            {
                joinLinkTemplateContent = await File.ReadAllTextAsync(_joinLinkTemplatePath, stoppingToken);
            }
            else
            {
                _logger.LogWarning("[EmailQueueBackgroundService] Meeting join link email template not found at {Path}, using fallback.", _joinLinkTemplatePath);
            }

            // Read SMTP configuration
            string smtpHost     = _config["Smtp:Host"] ?? "";
            int    smtpPort     = int.TryParse(_config["Smtp:Port"], out var p) ? p : 587;
            bool   enableSsl    = !bool.TryParse(_config["Smtp:EnableSsl"], out var ssl) || ssl;
            string smtpUser     = _config["Smtp:Username"] ?? "";
            string smtpPass     = _config["Smtp:Password"] ?? "";
            string fromEmail    = !string.IsNullOrWhiteSpace(_config["Smtp:FromEmail"]) ? _config["Smtp:FromEmail"] : smtpUser;
            string fromName     = _config["Smtp:FromName"] ?? "Webinar Management";

            bool isSmtpConfigured = !string.IsNullOrWhiteSpace(smtpHost) && !string.IsNullOrWhiteSpace(smtpUser);

            var processedWebinarIds = new HashSet<long>();

            // 2. Point 4: Reuse ONE connection for the entire batch
            SmtpClient? client = null;
            if (isSmtpConfigured)
            {
                try
                {
                    client = new SmtpClient(smtpHost, smtpPort)
                    {
                        EnableSsl   = enableSsl,
                        Credentials = new NetworkCredential(smtpUser, smtpPass),
                        Timeout     = 30000
                    };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[EmailQueueBackgroundService] Failed to initialize SMTP client: {Message}", ex.Message);
                }
            }

            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync(stoppingToken);

                foreach (var item in items)
                {
                    if (stoppingToken.IsCancellationRequested) break;

                    processedWebinarIds.Add(item.WebinarId);
                    bool sent = false;

                    bool isJoinLinkEmail = string.Equals(item.EmailType, "MEETING_JOIN_LINK", StringComparison.OrdinalIgnoreCase);
                    bool isAdminAlertEmail = string.Equals(item.EmailType, "ADMIN_UNSCHEDULED_MEETING_ALERT", StringComparison.OrdinalIgnoreCase);

                    string emailSubject;
                    string emailBody;

                    var (timeFormatted, dateFormatted, subjectTime) = ResolveRecipientTiming(item);

                    if (isAdminAlertEmail)
                    {
                        // Urgent Admin Alert: Upcoming Webinar Not Scheduled
                        emailSubject = $"URGENT: Schedule Meeting for Upcoming Webinar: {item.WebinarName}";
                        emailBody = FormatAdminAlertEmailTemplate(item, timeFormatted, dateFormatted);
                    }
                    else if (isJoinLinkEmail)
                    {
                        // Meeting Join Link Notification with explicit local start time
                        emailSubject = $"Live Session Access Link: {item.WebinarName} (Starts at {subjectTime})";
                        emailBody = FormatJoinLinkEmailTemplate(joinLinkTemplateContent, item, timeFormatted, dateFormatted);
                    }
                    else
                    {
                        // Standard Webinar Registration Invite
                        string trackingUrl = $"{_frontendUrl}/webinar-registration?trackingId={item.ShareId}";
                        emailSubject = $"Invitation: {item.WebinarName} - Reserve Your Spot!";
                        emailBody = FormatEmailTemplate(templateContent, item, trackingUrl, timeFormatted, dateFormatted);
                    }

                    if (isSmtpConfigured && client != null)
                    {
                        try
                        {
                            using var mailMsg = new MailMessage
                            {
                                From       = new MailAddress(fromEmail, fromName),
                                Subject    = emailSubject,
                                Body       = emailBody,
                                IsBodyHtml = true
                            };
                            mailMsg.To.Add(new MailAddress(item.RecipientEmail, $"{item.RecipientFirstName} {item.RecipientLastName}".Trim()));

                            await client.SendMailAsync(mailMsg, stoppingToken);
                            sent = true;
                            _logger.LogInformation("[EmailQueueBackgroundService] [{EmailType}] Email sent to {Email} for Webinar {WebinarId}",
                                item.EmailType, item.RecipientEmail, item.WebinarId);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "[EmailQueueBackgroundService] Error sending [{EmailType}] to {Email}: {Message}",
                                item.EmailType, item.RecipientEmail, ex.Message);
                        }
                    }
                    else
                    {
                        _logger.LogWarning("[EmailQueueBackgroundService] SMTP is not configured in appsettings.json. Email to {Email} will remain pending until SMTP settings are provided.", item.RecipientEmail);
                        sent = false;
                    }

                    // Update database status using the active connection
                    await conn.ExecuteAsync(
                        "wms.usp_MarkEmailQueueSent",
                        new { QueueId = item.Id, IsSent = sent },
                        commandType: CommandType.StoredProcedure
                    );
                }
            }
            finally
            {
                client?.Dispose();
            }

            // 3. Point 3: Check if all emails for processed webinars have finished
            using (var conn = new SqlConnection(_connectionString))
            {
                foreach (var webinarId in processedWebinarIds)
                {
                    var status = await conn.QueryFirstOrDefaultAsync<dynamic>(
                        "wms.usp_CheckWebinarEmailQueueFinished",
                        new { WebinarId = webinarId },
                        commandType: CommandType.StoredProcedure
                    );

                    if (status != null && status.IsFinished != null && (int)status.IsFinished == 1)
                    {
                        string webinarName = status.WebinarName != null ? (string)status.WebinarName : "Webinar";
                        int totalSent = status.TotalCount != null ? (int)status.TotalCount : 0;

                        _logger.LogInformation("[EmailQueueBackgroundService] All {Count} emails for Webinar '{WebinarName}' (ID {WebinarId}) processed successfully!",
                            totalSent, webinarName, webinarId);

                        // Broadcast completion snackbar to Admin UI
                        await _hubContext.Clients.All.SendAsync("WebinarEmailsCompleted", new
                        {
                            webinarId,
                            webinarName,
                            totalSent,
                            timestamp = DateTime.UtcNow
                        }, cancellationToken: stoppingToken);
                    }
                }
            }
        }

        private static string FormatEmailTemplate(string template, EmailQueueItemDto item, string trackingUrl, string timeFormatted, string dateFormatted)
        {
            if (string.IsNullOrWhiteSpace(template))
            {
                return $@"
                    <h2>You're invited to {item.WebinarName}</h2>
                    <p>Hi {item.RecipientFirstName},</p>
                    <p>Date: {dateFormatted}</p>
                    <p>Time: {timeFormatted}</p>
                    <p>Conductor: {item.ConductorName}</p>
                    <p><a href='{trackingUrl}'>Register Here</a></p>
                ";
            }

            string priceText = item.IsPaid ? $"₹{item.Price}" : "FREE";
            string priceClass = item.IsPaid ? "badge-paid" : "badge-free";
            string studentName = $"{item.RecipientFirstName} {item.RecipientLastName}".Trim();
            if (string.IsNullOrWhiteSpace(studentName)) studentName = "Student";

            return template
                .Replace("{{StudentName}}", studentName)
                .Replace("{{WebinarTitle}}", item.WebinarName)
                .Replace("{{Category}}", item.CategoryName)
                .Replace("{{PriceBadgeClass}}", priceClass)
                .Replace("{{PriceText}}", priceText)
                .Replace("{{Date}}", dateFormatted)
                .Replace("{{Time}}", timeFormatted)
                .Replace("{{Duration}}", $"{item.DurationMinutes} min")
                .Replace("{{ConductorName}}", item.ConductorName)
                .Replace("{{RegisterUrl}}", trackingUrl);
        }

        private static string FormatJoinLinkEmailTemplate(string template, EmailQueueItemDto item, string timeFormatted, string dateFormatted)
        {
            string studentName = $"{item.RecipientFirstName} {item.RecipientLastName}".Trim();
            if (string.IsNullOrWhiteSpace(studentName)) studentName = "Student";

            string joinUrl = !string.IsNullOrWhiteSpace(item.JoinLink) ? item.JoinLink : "#";

            if (string.IsNullOrWhiteSpace(template))
            {
                return $@"
                    <h2>Live Session Starting Soon: {item.WebinarName}</h2>
                    <p>Hi {studentName},</p>
                    <p><strong>Date:</strong> {dateFormatted}</p>
                    <p><strong>Meeting Start Time:</strong> {timeFormatted}</p>
                    <p><strong>Duration:</strong> {item.DurationMinutes} min</p>
                    <p><strong>Speaker:</strong> {item.ConductorName}</p>
                    <p><a href='{joinUrl}'>Join Live Webinar Now</a></p>
                ";
            }

            return template
                .Replace("{{StudentName}}", studentName)
                .Replace("{{WebinarTitle}}", item.WebinarName)
                .Replace("{{Category}}", item.CategoryName)
                .Replace("{{Date}}", dateFormatted)
                .Replace("{{StartTime}}", timeFormatted)
                .Replace("{{Time}}", timeFormatted)
                .Replace("{{Duration}}", $"{item.DurationMinutes} min")
                .Replace("{{ConductorName}}", item.ConductorName)
                .Replace("{{JoinMeetingUrl}}", joinUrl)
                .Replace("{{JoinLink}}", joinUrl);
        }

        private static string FormatAdminAlertEmailTemplate(EmailQueueItemDto item, string timeFormatted, string dateFormatted)
        {
            string adminName = $"{item.RecipientFirstName} {item.RecipientLastName}".Trim();
            if (string.IsNullOrWhiteSpace(adminName)) adminName = "Admin";

            return $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                    <h2 style='color: #d9534f; margin-top: 0;'>⚠️ Urgent: Schedule Meeting Reminder</h2>
                    <p>Dear {adminName},</p>
                    <p>Your webinar <strong>{item.WebinarName}</strong> is scheduled to start in <strong>less than 30 minutes</strong>!</p>
                    <table style='width: 100%; border-collapse: collapse; margin: 15px 0;'>
                        <tr><td style='padding: 6px 0; color: #555;'><strong>Webinar:</strong></td><td style='padding: 6px 0;'>{item.WebinarName}</td></tr>
                        <tr><td style='padding: 6px 0; color: #555;'><strong>Date:</strong></td><td style='padding: 6px 0;'>{dateFormatted}</td></tr>
                        <tr><td style='padding: 6px 0; color: #555;'><strong>Time:</strong></td><td style='padding: 6px 0;'>{timeFormatted}</td></tr>
                        <tr><td style='padding: 6px 0; color: #555;'><strong>Conductor:</strong></td><td style='padding: 6px 0;'>{item.ConductorName}</td></tr>
                    </table>
                    <div style='background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 12px; border-radius: 4px; margin: 15px 0;'>
                        <strong>Action Required:</strong> The BigBlueButton meeting room has not been scheduled yet. Please log in to your admin dashboard and schedule the meeting now so attendees can receive their join links.
                    </div>
                    <p style='color: #888; font-size: 12px; margin-top: 20px;'>This is an automated operational alert sent from your Webinar Management System.</p>
                </div>
            ";
        }

        /// <summary>
        /// Resolves an IANA timezone ID using NodaTime and libphonenumber:
        /// 1. Uses the user's saved IANA timezone if present and valid.
        /// 2. Otherwise parses the phone / dialing code to ISO 3166-1 alpha-2 region code.
        /// 3. Queries NodaTime TZDB zone locations for that region.
        /// If unambiguous (single zone for the country, e.g. AE -> Asia/Dubai, IN -> Asia/Kolkata), returns that zone.
        /// If country has multiple zones (e.g. US, CA, AU) and user has no saved zone, returns null (UTC only).
        /// </summary>
        public static string? ResolveTimeZoneId(string? savedIanaZone, string? countryCode, string? mobileNumber)
        {
            // 1. Prefer the user's saved IANA zone
            if (!string.IsNullOrWhiteSpace(savedIanaZone))
            {
                var savedZone = DateTimeZoneProviders.Tzdb.GetZoneOrNull(savedIanaZone.Trim());
                if (savedZone != null) return savedZone.Id;
            }

            // 2. Parse phone number / country code to ISO region code
            string? region = null;
            var util = PhoneNumberUtil.GetInstance();

            // Try full phone number first if mobile number exists
            if (!string.IsNullOrWhiteSpace(mobileNumber))
            {
                string rawPhone = (countryCode ?? string.Empty).Trim() + mobileNumber.Trim();
                if (!rawPhone.StartsWith("+")) rawPhone = "+" + rawPhone;
                try
                {
                    var parsed = util.Parse(rawPhone, null);
                    if (util.IsValidNumber(parsed) || !string.IsNullOrEmpty(util.GetRegionCodeForNumber(parsed)))
                    {
                        region = util.GetRegionCodeForNumber(parsed);
                    }
                }
                catch
                {
                    // Fall through to country code parsing
                }
            }

            // If region not resolved yet, extract from country calling code
            if (string.IsNullOrEmpty(region) || region == "ZZ")
            {
                string cleanCode = (countryCode ?? "+91").Trim();
                if (cleanCode.StartsWith("00")) cleanCode = cleanCode[2..];
                else if (cleanCode.StartsWith("+")) cleanCode = cleanCode[1..];

                if (int.TryParse(cleanCode, out int cc))
                {
                    region = util.GetRegionCodeForCountryCode(cc);
                }
            }

            if (string.IsNullOrEmpty(region) || region == "ZZ")
            {
                return null;
            }

            // 3. Query NodaTime TZDB for zone locations in that region
            var zones = TzdbDateTimeZoneSource.Default.ZoneLocations?
                .Where(z => string.Equals(z.CountryCode, region, StringComparison.OrdinalIgnoreCase))
                .Select(z => z.ZoneId)
                .Distinct()
                .ToList();

            // Only use if unambiguous (single zone in the country); multi-zone without saved zone returns null (UTC only)
            return (zones != null && zones.Count == 1) ? zones[0] : null;
        }

        private static (string timeFormatted, string dateFormatted, string subjectTime) ResolveRecipientTiming(EmailQueueItemDto item)
        {
            var startUtc = DateTime.SpecifyKind(item.StartTime, DateTimeKind.Utc);
            var endUtc = DateTime.SpecifyKind(item.EndTime, DateTimeKind.Utc);

            var startInstant = Instant.FromDateTimeUtc(startUtc);
            var endInstant = Instant.FromDateTimeUtc(endUtc);

            string? timeZoneId = ResolveTimeZoneId(item.RecipientTimeZone, item.RecipientCountryCode, item.RecipientMobileNumber);

            if (!string.IsNullOrEmpty(timeZoneId))
            {
                var zone = DateTimeZoneProviders.Tzdb.GetZoneOrNull(timeZoneId);
                if (zone != null)
                {
                    var localStart = startInstant.InZone(zone);
                    var localEnd = endInstant.InZone(zone);
                    var interval = zone.GetZoneInterval(startInstant);
                    string tzAbbr = interval.Name;

                    var localStartDt = localStart.ToDateTimeUnspecified();
                    var localEndDt = localEnd.ToDateTimeUnspecified();

                    string dateFormatted = localStartDt.ToString("dddd, MMM dd, yyyy");
                    string timeFormatted = $"{localStartDt:hh:mm tt} – {localEndDt:hh:mm tt} {tzAbbr} ({startUtc:hh:mm tt} – {endUtc:hh:mm tt} UTC)";
                    string subjectTime = $"{localStartDt:hh:mm tt} {tzAbbr}";

                    return (timeFormatted, dateFormatted, subjectTime);
                }
            }

            // Fallback for multi-zone countries without saved preference: send standard UTC time
            string utcDateFormatted = startUtc.ToString("dddd, MMM dd, yyyy");
            string utcTimeFormatted = $"{startUtc:hh:mm tt} – {endUtc:hh:mm tt} UTC";
            string utcSubjectTime = $"{startUtc:hh:mm tt} UTC";

            return (utcTimeFormatted, utcDateFormatted, utcSubjectTime);
        }
    }
}
