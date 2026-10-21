using System.Data;
using System.Net;
using System.Net.Mail;
using Dapper;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Data.SqlClient;
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

            _templatePath     = Path.Combine(Directory.GetCurrentDirectory(), "EmailTemplete", "StudentWebinrNotification.html");
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
                _logger.LogWarning("[EmailQueueBackgroundService] Email template not found at {Path}, using fallback.", _templatePath);
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

                    // Build email content
                    string trackingUrl = $"{_frontendUrl}/webinar-registration?trackingId={item.ShareId}";
                    string emailBody = FormatEmailTemplate(templateContent, item, trackingUrl);

                    if (isSmtpConfigured && client != null)
                    {
                        try
                        {
                            using var mailMsg = new MailMessage
                            {
                                From       = new MailAddress(fromEmail, fromName),
                                Subject    = $"Invitation: {item.WebinarName} - Reserve Your Spot!",
                                Body       = emailBody,
                                IsBodyHtml = true
                            };
                            mailMsg.To.Add(new MailAddress(item.RecipientEmail, $"{item.RecipientFirstName} {item.RecipientLastName}".Trim()));

                            await client.SendMailAsync(mailMsg, stoppingToken);
                            sent = true;
                            _logger.LogInformation("[EmailQueueBackgroundService] Email sent to {Email} for Webinar {WebinarId}",
                                item.RecipientEmail, item.WebinarId);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "[EmailQueueBackgroundService] Error sending to {Email}: {Message}",
                                item.RecipientEmail, ex.Message);
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

                        _logger.LogInformation("[EmailQueueBackgroundService] All {Count} emails for Webinar '{WebinarName}' (ID {WebinarId}) sent successfully!",
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

        private static string FormatEmailTemplate(string template, EmailQueueItemDto item, string trackingUrl)
        {
            if (string.IsNullOrWhiteSpace(template))
            {
                return $@"
                    <h2>You're invited to {item.WebinarName}</h2>
                    <p>Hi {item.RecipientFirstName},</p>
                    <p>Date: {item.WebinarDate:yyyy-MM-dd} at {item.StartTime:hh:mm tt}</p>
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
                .Replace("{{Date}}", item.WebinarDate.ToString("dddd, MMM dd, yyyy"))
                .Replace("{{Time}}", $"{item.StartTime:hh:mm tt} - {item.EndTime:hh:mm tt}")
                .Replace("{{Duration}}", $"{item.DurationMinutes} min")
                .Replace("{{ConductorName}}", item.ConductorName)
                .Replace("{{RegisterUrl}}", trackingUrl);
        }
    }
}
