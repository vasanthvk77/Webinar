



using System.Text.Json;
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

public class StoredLogoSlot
{
    public string Id { get; set; } = string.Empty;
    public float X { get; set; }
    public float Y { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
    public string? ImageUrl { get; set; }
    public string? Type { get; set; } // "slot" or "text"
    public string? Text { get; set; }
    public string? Color { get; set; }
    public bool Bold { get; set; }
    public float? FontSize { get; set; }
    public string? Align { get; set; }
    public string? GroupId { get; set; }
}

public class StoredLogoConfig
{
    public float TemplateWidth { get; set; } = 1200f;
    public float TemplateHeight { get; set; } = 850f;
    public string? BackgroundUrl { get; set; }
    public List<StoredLogoSlot> LogoSlots { get; set; } = new();
}

public class CertificateFileTemplateDto
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

/// <summary>
/// Global configuration declarations for QuestPDF certificate printing positions,
/// dimensions, font sizes, colors, and date formatting.
/// </summary>
public static class CertificateOverlayLayoutConfig
{
    // ==========================================
    // 1. Certificate Number (Top Right)
    // ==========================================
    public static float CertNumberTopPadding       = 40f;
    public static float CertNumberRightPadding     = 52f;
    public static float CertNumberFontSize         = 10.5f;
    public static string CertNumberLabelColor      = "#475569";
    public static string CertNumberValueColor      = "#0F2942";
    public static string CertNumberPrefix          = "Certificate No: ";

    // ==========================================
    // 2. Participant Name (Center Headline)
    // ==========================================
    public static float ParticipantNameTopPadding  = 182f;
    public static float ParticipantNameWidth       = 580f;
    public static float ParticipantNameHeight      = 46f;
    public static float ParticipantNameFontSize    = 28f;
    public static float ParticipantNameMediumFontSize = 25f;
    public static float ParticipantNameSmallFontSize  = 22f;
    public static string ParticipantNameColor      = "#0F2942";
    public static bool ParticipantNameBold         = true;

    // ==========================================
    // 3. Participation & Webinar Name / Date Block
    // ==========================================
    public static float ParticipationBlockTopPadding = 4f;
    public static float ParticipationBlockWidth      = 720f;
    public static float ParticipationBlockHeight     = 82f;
    public static float BodyFontSize                 = 19f;
    public static string BodyTextColor               = "#1E293B";
    public static string HighlightTextColor          = "#0F2942";
    public static string MaskBackgroundColor         = "#FFFFFF";
    public static string DateFormat                  = "d MMMM yyyy";
}

public class CertificateService
{
    private readonly IWebHostEnvironment _env;
    private readonly ICertificateTemplateService? _templateService;
    private readonly ILogger<CertificateService>? _logger;

    // Page width stays at A4 landscape width (841.89 pt).
    // Page height is derived from the template image so the artwork fills the page exactly.
    private static readonly float PageWidthPt = PageSizes.A4.Landscape().Width;

    public CertificateService(
        IWebHostEnvironment env,
        ICertificateTemplateService? templateService = null,
        ILogger<CertificateService>? logger = null)
    {
        _env = env;
        _templateService = templateService;
        _logger = logger;
    }

    public string GetImagesDirectory()
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

    public IEnumerable<CertificateFileTemplateDto> GetAvailableTemplates()
    {
        var dir = GetImagesDirectory();
        if (!Directory.Exists(dir))
            return Enumerable.Empty<CertificateFileTemplateDto>();

        var supportedExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg" };
        var files = Directory.GetFiles(dir)
            .Where(f => supportedExts.Contains(Path.GetExtension(f)))
            .OrderBy(f => f)
            .ToList();

        var list = new List<CertificateFileTemplateDto>();
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

            list.Add(new CertificateFileTemplateDto
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
        // 1. If templateId is a DB ID, resolve from wms.CertificateTemplates table
        if (int.TryParse(templateId, out int dbId) && _templateService != null)
        {
            try
            {
                var dbTemplate = _templateService.GetByIdAsync(dbId).GetAwaiter().GetResult();
                if (dbTemplate != null)
                {
                    var bgUrl = dbTemplate.TemplateImageUrl;
                    if (string.IsNullOrWhiteSpace(bgUrl) && !string.IsNullOrWhiteSpace(dbTemplate.LogoConfiguration))
                    {
                        try
                        {
                            var cfg = JsonSerializer.Deserialize<StoredLogoConfig>(
                                dbTemplate.LogoConfiguration,
                                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                            bgUrl = cfg?.BackgroundUrl;
                        }
                        catch { }
                    }

                    if (!string.IsNullOrWhiteSpace(bgUrl))
                    {
                        string cleanUrl = bgUrl.Split('?')[0].Split('#')[0];
                        var fileName = Path.GetFileName(cleanUrl);
                        var fullPath = Path.Combine(GetImagesDirectory(), fileName);
                        if (!File.Exists(fullPath))
                        {
                            fullPath = GetTemplatePath(fileName) ?? fullPath;
                        }

                        if (File.Exists(fullPath))
                        {
                            var b = File.ReadAllBytes(fullPath);
                            var e = Path.GetExtension(fullPath).ToLowerInvariant();
                            var ct = e switch
                            {
                                ".png" => "image/png",
                                ".jpg" or ".jpeg" => "image/jpeg",
                                ".webp" => "image/webp",
                                _ => "application/octet-stream"
                            };
                            return (b, ct);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "[CertificateService] GetTemplateImage DB lookup failed for {TemplateId}: {Message}", templateId, ex.Message);
            }
        }

        var path = GetTemplatePath(templateId);
        if (path == null || !File.Exists(path))
            return (null, "application/octet-stream");

        var bytes = File.ReadAllBytes(path);
        var ext = Path.GetExtension(path).ToLowerInvariant();
        var contentType = ext switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        return (bytes, contentType);
    }

    public byte[]? GenerateCertificatePdf(string templateId, CertificateRequest? data = null)
    {
        // 1. Check if templateId is an integer ID referencing a visual CertificateTemplate in DB
        if (int.TryParse(templateId, out int dbId) && _templateService != null)
        {
            var dbTemplate = _templateService.GetByIdAsync(dbId).GetAwaiter().GetResult();
            if (dbTemplate != null)
            {
                return GenerateVisualTemplatePdf(dbTemplate, data);
            }
        }

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

                    float nameFontSize = participantName.Length > 28
                        ? CertificateOverlayLayoutConfig.ParticipantNameSmallFontSize
                        : (participantName.Length > 20
                            ? CertificateOverlayLayoutConfig.ParticipantNameMediumFontSize
                            : CertificateOverlayLayoutConfig.ParticipantNameFontSize);

                    float bodyFontSize = CertificateOverlayLayoutConfig.BodyFontSize;

                    page.Content().Layers(layers =>
                    {
                        // Background template image
                        layers.Layer().Image(templatePath).FitArea();

                        // Dynamic text overlay using global layout configuration
                        layers.PrimaryLayer().Column(col =>
                        {
                            // 1. Certificate number (top right)
                            col.Item()
                                .PaddingTop(CertificateOverlayLayoutConfig.CertNumberTopPadding)
                                .PaddingRight(CertificateOverlayLayoutConfig.CertNumberRightPadding)
                                .AlignRight()
                                .Text(text =>
                                {
                                    text.Span(CertificateOverlayLayoutConfig.CertNumberPrefix)
                                        .FontSize(CertificateOverlayLayoutConfig.CertNumberFontSize)
                                        .FontColor(CertificateOverlayLayoutConfig.CertNumberLabelColor);
                                    text.Span(certCode)
                                        .FontSize(CertificateOverlayLayoutConfig.CertNumberFontSize)
                                        .Bold()
                                        .FontColor(CertificateOverlayLayoutConfig.CertNumberValueColor);
                                });

                            // 2. Participant name
                            col.Item()
                                .PaddingTop(CertificateOverlayLayoutConfig.ParticipantNameTopPadding)
                                .AlignCenter()
                                .Width(CertificateOverlayLayoutConfig.ParticipantNameWidth)
                                .AlignCenter()
                                .Text(participantName.ToUpperInvariant())
                                .FontSize(nameFontSize)
                                .Bold()
                                .FontColor(CertificateOverlayLayoutConfig.ParticipantNameColor);

                            // 3. Participation text with masking
                            col.Item()
                                .PaddingTop(CertificateOverlayLayoutConfig.ParticipationBlockTopPadding)
                                .AlignCenter()
                                .Width(CertificateOverlayLayoutConfig.ParticipationBlockWidth)
                                .Background(CertificateOverlayLayoutConfig.MaskBackgroundColor)
                                .AlignCenter()
                                .AlignMiddle()
                                .Column(desc =>
                                {
                                    desc.Item().AlignCenter().Text(text =>
                                    {
                                        text.Span("For participating in the webinar ")
                                            .FontSize(bodyFontSize)
                                            .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                        text.Span(webinarName)
                                            .FontSize(bodyFontSize)
                                            .Bold()
                                            .FontColor(CertificateOverlayLayoutConfig.HighlightTextColor);
                                    });

                                    desc.Item().PaddingTop(4).AlignCenter().Text(text =>
                                    {
                                        text.Span("conducted on ")
                                            .FontSize(bodyFontSize)
                                            .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                        text.Span(compDate.ToString(CertificateOverlayLayoutConfig.DateFormat))
                                            .FontSize(bodyFontSize)
                                            .Bold()
                                            .FontColor(CertificateOverlayLayoutConfig.HighlightTextColor);
                                        text.Span(". We appreciate your active involvement and")
                                            .FontSize(bodyFontSize)
                                            .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                    });

                                    desc.Item().PaddingTop(3).AlignCenter().Text(text =>
                                    {
                                        text.Span("commitment to continuous learning")
                                            .FontSize(bodyFontSize)
                                            .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                    });
                                });
                        });
                    });
                }
            });
        });

        return document.GeneratePdf();
    }

    private byte[]? GenerateVisualTemplatePdf(WebinarApi.Models.CertificateTemplateDto dbTemplate, CertificateRequest? data = null)
    {
        try
        {
            StoredLogoConfig? logoConfig = null;
            if (!string.IsNullOrWhiteSpace(dbTemplate.LogoConfiguration))
            {
                try
                {
                    logoConfig = JsonSerializer.Deserialize<StoredLogoConfig>(
                        dbTemplate.LogoConfiguration,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "[CertificateService] Failed to deserialize LogoConfiguration for Template {Id}", dbTemplate.Id);
                }
            }

            float designWidth = logoConfig?.TemplateWidth > 0 ? logoConfig.TemplateWidth : 1200f;
            float designHeight = logoConfig?.TemplateHeight > 0 ? logoConfig.TemplateHeight : 850f;

            float pageWidthPt = PageWidthPt; // 841.89 pt
            float pageHeightPt = pageWidthPt * (designHeight / designWidth);
            var pageSize = new PageSize(pageWidthPt, pageHeightPt);
            float scale = pageWidthPt / designWidth;

            // Resolve background image
            string? bgPath = null;
            var bgUrl = dbTemplate.TemplateImageUrl;
            if (string.IsNullOrWhiteSpace(bgUrl) && logoConfig != null)
            {
                bgUrl = logoConfig.BackgroundUrl;
            }

            if (!string.IsNullOrWhiteSpace(bgUrl))
            {
                string cleanBg = bgUrl.Split('?')[0].Split('#')[0];
                var fileName = Path.GetFileName(cleanBg);
                var cand = Path.Combine(GetImagesDirectory(), fileName);
                if (File.Exists(cand))
                {
                    bgPath = cand;
                }
                else
                {
                    bgPath = GetTemplatePath(fileName);
                }
            }

            _logger?.LogInformation("[CertificateService] GenerateVisualTemplatePdf: Id={Id}, Bg={BgPath}, Slots={Count}, Page={W}x{H}",
                dbTemplate.Id, bgPath, logoConfig?.LogoSlots?.Count ?? 0, pageWidthPt, pageHeightPt);

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(pageSize);
                    page.Margin(0);

                    page.Content().Layers(layers =>
                    {
                        // 1. Primary layer MUST BE the full canvas / background image!
                        // In QuestPDF, PrimaryLayer dictates container dimensions for all other layers.
                        if (bgPath != null && File.Exists(bgPath))
                        {
                            layers.PrimaryLayer().Width(pageWidthPt).Height(pageHeightPt).Image(bgPath).FitArea();
                        }
                        else
                        {
                            layers.PrimaryLayer().Width(pageWidthPt).Height(pageHeightPt).Background(Colors.White);
                        }

                        // 2. Render all configured logo slots and text elements at exact scaled canvas coordinates
                        if (logoConfig?.LogoSlots != null)
                        {
                            foreach (var slot in logoConfig.LogoSlots)
                            {
                                float pdfX = slot.X * scale;
                                float pdfY = slot.Y * scale;
                                float pdfW = slot.Width * scale;
                                float pdfH = slot.Height * scale;

                                float safeW = Math.Max(1f, pdfW);
                                float safeH = Math.Max(1f, pdfH);

                                if (string.Equals(slot.Type, "text", StringComparison.OrdinalIgnoreCase) || !string.IsNullOrWhiteSpace(slot.Text))
                                {
                                    var textContent = slot.Text ?? string.Empty;
                                    var textColor = !string.IsNullOrWhiteSpace(slot.Color) ? slot.Color : "#1E293B";
                                    var isBold = slot.Bold;
                                    float fontSizePt = (slot.FontSize.HasValue && slot.FontSize.Value > 0)
                                        ? Math.Max(6f, slot.FontSize.Value * scale)
                                        : Math.Max(6f, Math.Min(safeH * 0.7f, 32f));

                                    layers.Layer()
                                        .AlignTop()
                                        .AlignLeft()
                                        .PaddingLeft(pdfX)
                                        .PaddingTop(pdfY)
                                        .Width(safeW)
                                        .Text(t =>
                                        {
                                            if (string.Equals(slot.Align, "left", StringComparison.OrdinalIgnoreCase))
                                                t.AlignLeft();
                                            else if (string.Equals(slot.Align, "right", StringComparison.OrdinalIgnoreCase))
                                                t.AlignRight();
                                            else
                                                t.AlignCenter();

                                            var span = t.Span(textContent).FontSize(fontSizePt).FontColor(textColor);
                                            if (isBold) span.Bold();
                                        });
                                }
                                else if (!string.IsNullOrWhiteSpace(slot.ImageUrl))
                                {
                                    string cleanUrl = slot.ImageUrl.Split('?')[0].Split('#')[0];
                                    var logoFileName = Path.GetFileName(cleanUrl);
                                    string? logoPath = null;
                                    var cand1 = Path.Combine(GetImagesDirectory(), logoFileName);
                                    if (File.Exists(cand1)) logoPath = cand1;
                                    else
                                    {
                                        var cand2 = GetTemplatePath(logoFileName);
                                        if (cand2 != null && File.Exists(cand2)) logoPath = cand2;
                                    }

                                    if (logoPath != null && File.Exists(logoPath))
                                    {
                                        layers.Layer()
                                            .AlignTop()
                                            .AlignLeft()
                                            .PaddingLeft(pdfX)
                                            .PaddingTop(pdfY)
                                            .Width(safeW)
                                            .Height(safeH)
                                            .AlignCenter()
                                            .AlignMiddle()
                                            .Image(logoPath)
                                            .FitArea();
                                    }
                                }
                            }
                        }

                        // 3. Dynamic participant text overlay if request data supplied
                        if (data != null && (!string.IsNullOrWhiteSpace(data.ParticipantName) || !string.IsNullOrWhiteSpace(data.WebinarName)))
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

                            float nameBaseSize = participantName.Length > 28
                                ? CertificateOverlayLayoutConfig.ParticipantNameSmallFontSize
                                : (participantName.Length > 20
                                    ? CertificateOverlayLayoutConfig.ParticipantNameMediumFontSize
                                    : CertificateOverlayLayoutConfig.ParticipantNameFontSize);

                            float nameFontSize = Math.Max(16f, nameBaseSize * (pageHeightPt / 595f));
                            float bodyFontSize = Math.Max(12f, CertificateOverlayLayoutConfig.BodyFontSize * (pageHeightPt / 595f));

                            layers.Layer().Column(col =>
                            {
                                // 1. Certificate number (top right)
                                col.Item()
                                    .PaddingTop(CertificateOverlayLayoutConfig.CertNumberTopPadding * (pageHeightPt / 595f))
                                    .PaddingRight(CertificateOverlayLayoutConfig.CertNumberRightPadding * (pageWidthPt / 842f))
                                    .AlignRight()
                                    .Text(text =>
                                    {
                                        text.Span(CertificateOverlayLayoutConfig.CertNumberPrefix)
                                            .FontSize(CertificateOverlayLayoutConfig.CertNumberFontSize)
                                            .FontColor(CertificateOverlayLayoutConfig.CertNumberLabelColor);
                                        text.Span(certCode)
                                            .FontSize(CertificateOverlayLayoutConfig.CertNumberFontSize)
                                            .Bold()
                                            .FontColor(CertificateOverlayLayoutConfig.CertNumberValueColor);
                                    });

                                // 2. Participant name
                                col.Item()
                                    .PaddingTop(CertificateOverlayLayoutConfig.ParticipantNameTopPadding * (pageHeightPt / 595f))
                                    .AlignCenter()
                                    .Width(Math.Min(pageWidthPt * 0.85f, CertificateOverlayLayoutConfig.ParticipantNameWidth))
                                    .AlignCenter()
                                    .Text(participantName.ToUpperInvariant())
                                    .FontSize(nameFontSize)
                                    .Bold()
                                    .FontColor(CertificateOverlayLayoutConfig.ParticipantNameColor);

                                // 3. Participation text
                                col.Item()
                                    .PaddingTop(CertificateOverlayLayoutConfig.ParticipationBlockTopPadding * (pageHeightPt / 595f))
                                    .AlignCenter()
                                    .Width(Math.Min(pageWidthPt * 0.90f, CertificateOverlayLayoutConfig.ParticipationBlockWidth))
                                    .Background(CertificateOverlayLayoutConfig.MaskBackgroundColor)
                                    .AlignCenter()
                                    .AlignMiddle()
                                    .Column(desc =>
                                    {
                                        desc.Item().AlignCenter().Text(text =>
                                        {
                                            text.Span("For participating in the webinar ")
                                                .FontSize(bodyFontSize)
                                                .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                            text.Span(webinarName)
                                                .FontSize(bodyFontSize)
                                                .Bold()
                                                .FontColor(CertificateOverlayLayoutConfig.HighlightTextColor);
                                        });

                                        desc.Item().PaddingTop(4).AlignCenter().Text(text =>
                                        {
                                            text.Span("conducted on ")
                                                .FontSize(bodyFontSize)
                                                .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                            text.Span(compDate.ToString(CertificateOverlayLayoutConfig.DateFormat))
                                                .FontSize(bodyFontSize)
                                                .Bold()
                                                .FontColor(CertificateOverlayLayoutConfig.HighlightTextColor);
                                            text.Span(". We appreciate your active involvement and")
                                                .FontSize(bodyFontSize)
                                                .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                        });

                                        desc.Item().PaddingTop(3).AlignCenter().Text(text =>
                                        {
                                            text.Span("commitment to continuous learning")
                                                .FontSize(bodyFontSize)
                                                .FontColor(CertificateOverlayLayoutConfig.BodyTextColor);
                                        });
                                    });
                            });
                        }
                    });
                });
            });

            return document.GeneratePdf();
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "[CertificateService] GenerateVisualTemplatePdf EXCEPTION for Template {Id}: {Message}", dbTemplate.Id, ex.Message);
            return null;
        }
    }
}