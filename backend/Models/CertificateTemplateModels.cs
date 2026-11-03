using System;

namespace WebinarApi.Models
{
    public class CertificateTemplateDto
    {
        public int Id { get; set; }
        public string CertificateName { get; set; } = string.Empty;
        public string TemplateImageUrl { get; set; } = string.Empty;
        public int LogoCount { get; set; }
        public string? LogoConfiguration { get; set; }
        public bool IsActive { get; set; }
        public int? CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class SaveCertificateTemplateRequest
    {
        public int Id { get; set; } = 0;
        public string CertificateName { get; set; } = string.Empty;
        public string TemplateImageUrl { get; set; } = string.Empty;
        public int LogoCount { get; set; } = 0;
        public string? LogoConfiguration { get; set; }
    }

    public class UploadImageResultDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string OriginalName { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
    }
}
