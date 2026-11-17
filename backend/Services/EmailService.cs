using System.Net;
using System.Net.Mail;

namespace WebinarApi.Services
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, string? recipientName = null);
        Task<bool> SendOtpEmailAsync(string recipientEmail, string otp, int expirySeconds);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        public async Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, string? recipientName = null)
        {
            string smtpHost  = _config["Smtp:Host"] ?? "";
            int    smtpPort  = int.TryParse(_config["Smtp:Port"], out var p) ? p : 587;
            bool   enableSsl = !bool.TryParse(_config["Smtp:EnableSsl"], out var ssl) || ssl;
            string smtpUser  = _config["Smtp:Username"] ?? "";
            string smtpPass  = _config["Smtp:Password"] ?? "";
            string fromEmail = !string.IsNullOrWhiteSpace(_config["Smtp:FromEmail"]) ? _config["Smtp:FromEmail"] : smtpUser;
            string fromName  = _config["Smtp:FromName"] ?? "ProdesX Webinars";

            if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpUser))
            {
                _logger.LogWarning("[EmailService] SMTP not configured in appsettings.json. Cannot send email to {Email}", toEmail);
                return false;
            }

            try
            {
                using var client = new SmtpClient(smtpHost, smtpPort)
                {
                    EnableSsl = enableSsl,
                    Credentials = new NetworkCredential(smtpUser, smtpPass),
                    Timeout = 15000
                };

                using var mailMsg = new MailMessage
                {
                    From = new MailAddress(fromEmail, fromName),
                    Subject = subject,
                    Body = htmlBody,
                    IsBodyHtml = true
                };

                if (!string.IsNullOrWhiteSpace(recipientName))
                {
                    mailMsg.To.Add(new MailAddress(toEmail, recipientName));
                }
                else
                {
                    mailMsg.To.Add(new MailAddress(toEmail));
                }

                await client.SendMailAsync(mailMsg);
                _logger.LogInformation("[EmailService] Email '{Subject}' sent successfully to {Email}", subject, toEmail);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[EmailService] Error sending email to {Email}: {Message}", toEmail, ex.Message);
                return false;
            }
        }

        public async Task<bool> SendOtpEmailAsync(string recipientEmail, string otp, int expirySeconds)
        {
            string fromName = _config["Smtp:FromName"] ?? "ProdesX Webinars";

            string htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .brand {{ font-size: 20px; font-weight: 700; color: #2563eb; }}
    .title {{ font-size: 18px; font-weight: 600; margin: 16px 0 8px; color: #0f172a; }}
    .subtitle {{ font-size: 14px; color: #64748b; line-height: 1.5; }}
    .otp-box {{ background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; text-align: center; padding: 20px; margin: 24px 0; }}
    .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }}
    .warning {{ font-size: 13px; color: #dc2626; margin-top: 8px; font-weight: 600; }}
    .note {{ font-size: 13px; color: #64748b; line-height: 1.5; }}
    .footer {{ font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class='container'>
    <div class='header'>
      <div class='brand'>{fromName}</div>
      <div class='title'>Verify Your Email Address</div>
      <div class='subtitle'>Please use the following 6-digit verification code to complete your registration.</div>
    </div>
    <div class='otp-box'>
      <div class='otp-code'>{otp}</div>
      <div class='warning'>Valid for {expirySeconds} seconds only</div>
    </div>
    <p class='note'>
      Do not share this code with anyone. If you did not request this verification code, please ignore this email.
    </p>
    <div class='footer'>
      &copy; {DateTime.UtcNow.Year} {fromName}. All rights reserved.
    </div>
  </div>
</body>
</html>";

            return await SendEmailAsync(recipientEmail, $"{otp} is your verification code", htmlBody);
        }
    }
}

