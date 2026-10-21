



using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace WebinarApi.Services;

public record CertificateRequest(
    string? ParticipantName = null,
    string? WebinarName = null,
    DateTime? CompletionDate = null,
    string? CertificateId = null
);

public class CertificateTemplateDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Format { get; set; } = "PDF";
    public long FileSizeBytes { get; set; }
    public string FileSizeFormatted { get; set; } = string.Empty;
    public string PreviewUrl { get; set; } = string.Empty;
    public string DownloadUrl { get; set; } = string.Empty;
    public string PreviewBase64 { get; set; } = string.Empty;
}

public class CertificateService
{
    private readonly IWebHostEnvironment _env;

    // Page width stays at A4 landscape width (841.89 pt).
    // Page height is derived from the template image so the artwork fills the page exactly.
    private static readonly float PageWidthPt = PageSizes.A4.Landscape().Width;

    public CertificateService(IWebHostEnvironment env)
    {
        _env = env;
    }

    private string GetImagesDirectory()
    {
        var candidates = new[]
        {
            Path.Combine(_env.ContentRootPath, "Images"),
            Path.Combine(_env.ContentRootPath, "..", "Images"),
            Path.Combine(Directory.GetCurrentDirectory(), "Images"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "Images"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "Images")
        };

        var found = candidates.FirstOrDefault(Directory.Exists);
        if (found != null) return Path.GetFullPath(found);

        var fallback = Path.Combine(_env.ContentRootPath, "..", "Images");
        return Path.GetFullPath(fallback);
    }

    private string? GetTemplatePath(string templateId)
    {
        var dir = GetImagesDirectory();
        if (!Directory.Exists(dir)) return null;

        var cleanId = Path.GetFileNameWithoutExtension(templateId).Trim();
        var candidates = new[]
        {
            Path.Combine(dir, $"{cleanId}.png"),
            Path.Combine(dir, $"{cleanId}.jpg"),
            Path.Combine(dir, $"{cleanId}.jpeg"),
            Path.Combine(dir, cleanId)
        };

        return candidates.FirstOrDefault(File.Exists);
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{bytes / 1024.0:F1} KB";
        return $"{bytes / (1024.0 * 1024.0):F2} MB";
    }

    /// <summary>
    /// Reads the pixel size of a PNG or JPEG by parsing its header only
    /// (no image library needed). Returns null if the format is not recognised.
    /// </summary>
    private static (int width, int height)? GetImageSize(string path)
    {
        try
        {
            using var fs = File.OpenRead(path);
            using var br = new BinaryReader(fs);

            // ---- PNG: 8-byte signature, then IHDR (width, height as big-endian ints)
            var sig = br.ReadBytes(8);
            if (sig.Length == 8 && sig[0] == 0x89 && sig[1] == 0x50 && sig[2] == 0x4E && sig[3] == 0x47)
            {
                br.ReadBytes(8); // IHDR length + type
                int w = ReadInt32BigEndian(br);
                int h = ReadInt32BigEndian(br);
                return (w, h);
            }

            // ---- JPEG: walk markers until a Start-Of-Frame marker
            fs.Position = 0;
            if (br.ReadByte() != 0xFF || br.ReadByte() != 0xD8) return null;

            while (fs.Position < fs.Length)
            {
                byte b = br.ReadByte();
                if (b != 0xFF) continue;

                byte marker = br.ReadByte();
                while (marker == 0xFF) marker = br.ReadByte(); // skip fill bytes

                bool isSof = marker >= 0xC0 && marker <= 0xCF &&
                             marker != 0xC4 && marker != 0xC8 && marker != 0xCC;

                int len = (br.ReadByte() << 8) | br.ReadByte();

                if (isSof)
                {
                    br.ReadByte(); // precision
                    int h = (br.ReadByte() << 8) | br.ReadByte();
                    int w = (br.ReadByte() << 8) | br.ReadByte();
                    return (w, h);
                }

                fs.Position += len - 2;
            }
        }
        catch
        {
            // fall through
        }

        return null;
    }

    private static int ReadInt32BigEndian(BinaryReader br)
    {
        var b = br.ReadBytes(4);
        return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
    }

    /// <summary>
    /// Page that has exactly the same aspect ratio as the template image,
    /// so there is no blank strip and nothing gets cropped or stretched.
    /// Falls back to A4 landscape if the image size cannot be read.
    /// </summary>
    private static PageSize GetPageSizeForTemplate(string templatePath)
    {
        var size = GetImageSize(templatePath);
        if (size is { width: > 0, height: > 0 })
        {
            float pageH = PageWidthPt * size.Value.height / size.Value.width;
            return new PageSize(PageWidthPt, pageH);
        }

        return PageSizes.A4.Landscape();
    }

    public IEnumerable<CertificateTemplateDto> GetAvailableTemplates()
    {
        var dir = GetImagesDirectory();
        if (!Directory.Exists(dir))
            return Enumerable.Empty<CertificateTemplateDto>();

        var supportedExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg" };
        var files = Directory.GetFiles(dir)
            .Where(f => supportedExts.Contains(Path.GetExtension(f)))
            .OrderBy(f => f)
            .ToList();

        var list = new List<CertificateTemplateDto>();
        foreach (var file in files)
        {
            var fileInfo = new FileInfo(file);
            var id = Path.GetFileNameWithoutExtension(file);

            string friendlyName = id.Replace("-", " ").Replace("_", " ");
            if (id.StartsWith("CertificateTemplate", StringComparison.OrdinalIgnoreCase))
            {
                friendlyName = "Certificate Template " + id.Substring("CertificateTemplate".Length);
            }

            var (imgBytes, contentType) = GetTemplateImage(id);
            string base64 = (imgBytes != null && imgBytes.Length > 0)
                ? $"data:{contentType};base64,{Convert.ToBase64String(imgBytes)}"
                : string.Empty;

            list.Add(new CertificateTemplateDto
            {
                Id = id,
                Name = friendlyName,
                FileName = fileInfo.Name,
                Format = "Landscape (PDF)",
                FileSizeBytes = fileInfo.Length,
                FileSizeFormatted = FormatBytes(fileInfo.Length),
                PreviewUrl = $"/api/certificates/templates/{id}/preview",
                DownloadUrl = $"/api/certificates/templates/{id}/download",
                PreviewBase64 = base64
            });
        }

        return list;
    }

    public (byte[]? bytes, string contentType) GetTemplateImage(string templateId)
    {
        var path = GetTemplatePath(templateId);
        if (path == null || !File.Exists(path))
            return (null, "application/octet-stream");

        var bytes = File.ReadAllBytes(path);
        var ext = Path.GetExtension(path).ToLowerInvariant();
        var contentType = ext switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            _ => "application/octet-stream"
        };

        return (bytes, contentType);
    }

    public byte[]? GenerateCertificatePdf(string templateId, CertificateRequest? data = null)
    {
        var templatePath = GetTemplatePath(templateId);
        if (templatePath == null || !File.Exists(templatePath))
            return null;

        // FIX: page shape follows the template image (no blank strip at the bottom,
        // bottom-right artwork is no longer cut off).
        var pageSize = GetPageSizeForTemplate(templatePath);

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(pageSize);
                page.Margin(0);

                if (data == null || (string.IsNullOrWhiteSpace(data.ParticipantName) && string.IsNullOrWhiteSpace(data.WebinarName)))
                {
                    // Template only (preview / blank download)
                    page.Content().Image(templatePath).FitArea();
                }
                else
                {
                    var participantName = !string.IsNullOrWhiteSpace(data.ParticipantName)
                        ? data.ParticipantName.Trim()
                        : "PARTICIPANT NAME";

                    var webinarName = !string.IsNullOrWhiteSpace(data.WebinarName)
                        ? data.WebinarName.Trim()
                        : "Webinar";

                    var certCode = !string.IsNullOrWhiteSpace(data.CertificateId)
                        ? data.CertificateId.Trim()
                        : "PDX-WB-" + DateTime.UtcNow.Year + "-0001";

                    var compDate = data.CompletionDate ?? DateTime.UtcNow;

                    float nameFontSize = participantName.Length > 28 ? 22f : (participantName.Length > 20 ? 25f : 28f);

                    // Matches the size of the placeholder text in the template (~80% of page width on the long line)
                    const float bodyFontSize = 19f;

                    page.Content().Layers(layers =>
                    {
                        // Background template image
                        layers.Layer().Image(templatePath).FitArea();

                        // Dynamic text overlay
                        layers.PrimaryLayer().Column(col =>
                        {
                            // 1. Certificate number (top right)
                            col.Item()
                                .PaddingTop(40)
                                .PaddingRight(52)
                                .AlignRight()
                                .Text(text =>
                                {
                                    text.Span("Certificate No: ").FontSize(10.5f).FontColor("#475569");
                                    text.Span(certCode).FontSize(10.5f).Bold().FontColor("#0F2942");
                                });

                            // 2. Participant name, just above the gold line
                            col.Item()
                                .PaddingTop(182)
                                .AlignCenter()
                                .Width(580)
                                .Height(46)
                                .AlignCenter()
                                .AlignMiddle()
                                .Text(participantName.ToUpperInvariant())
                                .FontSize(nameFontSize)
                                .Bold()
                                .FontColor("#0F2942");

                            // 3. Participation text.
                            // The white background masks the placeholder text
                            // ("For participating in the webinar {webinar name}...")
                            // that is baked into the template image.
                            col.Item()
                                .PaddingTop(4)
                                .AlignCenter()
                                .Width(720)
                                .Height(82)
                                .Background("#FFFFFF")
                                .AlignCenter()
                                .AlignMiddle()
                                .Column(desc =>
                                {
                                    desc.Item().AlignCenter().Text(text =>
                                    {
                                        text.Span("For participating in the webinar ").FontSize(bodyFontSize).FontColor("#1E293B");
                                        text.Span(webinarName).FontSize(bodyFontSize).Bold().FontColor("#0F2942");
                                    });

                                    desc.Item().PaddingTop(4).AlignCenter().Text(text =>
                                    {
                                        text.Span("conducted on ").FontSize(bodyFontSize).FontColor("#1E293B");
                                        text.Span(compDate.ToString("d MMMM yyyy")).FontSize(bodyFontSize).Bold().FontColor("#0F2942");
                                        text.Span(". We appreciate your active involvement and").FontSize(bodyFontSize).FontColor("#1E293B");
                                    });

                                    desc.Item().PaddingTop(3).AlignCenter().Text(text =>
                                    {
                                        text.Span("commitment to continuous learning").FontSize(bodyFontSize).FontColor("#1E293B");
                                    });
                                });
                        });
                    });
                }
            });
        });

        return document.GeneratePdf();
    }
}