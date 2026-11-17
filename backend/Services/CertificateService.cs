using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace WebinarApi.Services;

public record CertificateRequest(
    string? ParticipantName = null,
    string? WebinarName = null,
    DateTime? CompletionDate = null,
    string? CertificateId = null,
    string? Year = null,
    string? Department = null
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
    public string? TextHtml { get; set; }
    public string? Color { get; set; }
    public bool Bold { get; set; }
    public float? FontSize { get; set; }
    public float? LineHeight { get; set; }
    public string? Align { get; set; }
    public string? GroupId { get; set; }
    public string? FontFamily { get; set; }  // e.g. "Arial", "Lato" — must be registered via FontManager
}

public class StoredLogoConfig
{
    public float TemplateWidth { get; set; } = 1200f;
    public float TemplateHeight { get; set; } = 850f;
    public string? BackgroundUrl { get; set; }
    public List<StoredLogoSlot> LogoSlots { get; set; } = new();
    public Dictionary<string, string>? Keywords { get; set; }
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
    public static float CertNumberTopPadding = 70f;
    public static float CertNumberRightPadding = 52f;
    public static float CertNumberFontSize = 10.5f;
    public static string CertNumberLabelColor = "#fafafaff";
    public static string CertNumberValueColor = "#ffffffff";
    public static string CertNumberPrefix = "Certificate No: ";

    // ==========================================
    // 2. Participant Name (Center Headline)
    // ==========================================
    public static float ParticipantNameTopPadding = 240f; // Moved down to rest directly on the underline
    public static float ParticipantNameWidth = 580f;
    public static float ParticipantNameHeight = 46f;
    public static float ParticipantNameFontSize = 26f;
    public static float ParticipantNameMediumFontSize = 23f;
    public static float ParticipantNameSmallFontSize = 20f;
    public static string ParticipantNameColor = "#0F2942";
    public static bool ParticipantNameBold = true;

    // ==========================================
    // 3. Participation & Webinar Name / Date Block
    // ==========================================
    public static float ParticipationBlockTopPadding = 20f; // Moved down below the line over the placeholder text
    public static float ParticipationBlockWidth = 720f;
    public static float ParticipationBlockHeight = 82f;
    public static float BodyFontSize = 13.5f; // Crisp fit over the 3-line placeholder area
    public static string BodyTextColor = "#1E293B";
    public static string HighlightTextColor = "#0F2942";
    public static string MaskBackgroundColor = "#FFFFFF";
    public static string DateFormat = "d MMMM yyyy";
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
        _logger?.LogInformation("[FLOW-4a] GenerateCertificatePdf called — templateId={TemplateId}", templateId);

        // 1. Check if templateId is an integer ID referencing a visual CertificateTemplate in DB
        if (int.TryParse(templateId, out int dbId) && _templateService != null)
        {
            _logger?.LogInformation("[FLOW-4b] templateId is numeric ({DbId}), fetching from DB via _templateService", dbId);
            var dbTemplate = _templateService.GetByIdAsync(dbId).GetAwaiter().GetResult();
            if (dbTemplate != null)
            {
                _logger?.LogInformation("[FLOW-4c] DB template found — Id={Id}, Name={Name}, HasLogoConfig={HasConfig}", 
                    dbTemplate.Id, dbTemplate.CertificateName, !string.IsNullOrWhiteSpace(dbTemplate.LogoConfiguration));
                return GenerateVisualTemplatePdf(dbTemplate, data);
            }
            _logger?.LogWarning("[FLOW-4b] DB template NOT found for dbId={DbId}, falling through to file-based path", dbId);
        }
        else
        {
            _logger?.LogInformation("[FLOW-4b] templateId is NOT numeric or _templateService is null — using file path: {TemplateId}", templateId);
        }

        var templatePath = GetTemplatePath(templateId);
        _logger?.LogInformation("[FLOW-4d] File template path resolved: {Path}, exists={Exists}", templatePath, templatePath != null && File.Exists(templatePath));
        if (templatePath == null || !File.Exists(templatePath))
        {
            _logger?.LogError("[FLOW-4d] File template NOT found — returning null");
            return null;
        }

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
                                .PaddingVertical(3)
                                .PaddingHorizontal(8)
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
            _logger?.LogInformation("[FLOW-4e] GenerateVisualTemplatePdf START — TemplateId={Id}", dbTemplate.Id);

            StoredLogoConfig? logoConfig = null;
            if (!string.IsNullOrWhiteSpace(dbTemplate.LogoConfiguration))
            {
                try
                {
                    logoConfig = JsonSerializer.Deserialize<StoredLogoConfig>(
                        dbTemplate.LogoConfiguration,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );
                    _logger?.LogInformation("[FLOW-4e] LogoConfig deserialized — Slots={Count}, Width={W}, Height={H}",
                        logoConfig?.LogoSlots?.Count ?? 0, logoConfig?.TemplateWidth, logoConfig?.TemplateHeight);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "[FLOW-4e] Failed to deserialize LogoConfiguration for Template {Id}", dbTemplate.Id);
                }
            }
            else
            {
                _logger?.LogWarning("[FLOW-4e] LogoConfiguration is empty/null for TemplateId={Id}", dbTemplate.Id);
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
                            _logger?.LogInformation("[FLOW-4e] Processing {Count} slots", logoConfig.LogoSlots.Count);
                            foreach (var slot in logoConfig.LogoSlots)
                            {
                                _logger?.LogInformation("[FLOW-slot] Slot Type={Type}, Text={Text}, Align={Align}, X={X}, Y={Y}, W={W}, H={H}, FontSize={FS}, Bold={Bold}",
                                    slot.Type, slot.Text?.Substring(0, Math.Min(30, slot.Text?.Length ?? 0)), slot.Align, slot.X, slot.Y, slot.Width, slot.Height, slot.FontSize, slot.Bold);
                                float pdfX = slot.X * scale;
                                float pdfY = slot.Y * scale;
                                float pdfW = slot.Width * scale;
                                float pdfH = slot.Height * scale;

                                float safeW = Math.Max(1f, pdfW);
                                float safeH = Math.Max(1f, pdfH);

                                if (string.Equals(slot.Type, "text", StringComparison.OrdinalIgnoreCase) || !string.IsNullOrWhiteSpace(slot.Text))
                                {
                                    var textContent = slot.Text ?? string.Empty;
                                    var htmlContent = slot.TextHtml;

                                    // Dynamically substitute template keywords / placeholders if data supplied
                                    if (data != null)
                                    {
                                        var participant = !string.IsNullOrWhiteSpace(data.ParticipantName) ? data.ParticipantName.Trim() : "";
                                        var webinar = !string.IsNullOrWhiteSpace(data.WebinarName) ? data.WebinarName.Trim() : "";
                                        var year = !string.IsNullOrWhiteSpace(data.Year) ? data.Year.Trim() : "";
                                        var dept = !string.IsNullOrWhiteSpace(data.Department) ? data.Department.Trim() : "";
                                        var certCode = !string.IsNullOrWhiteSpace(data.CertificateId) ? data.CertificateId.Trim() : "";
                                        var dateStr = (data.CompletionDate ?? DateTime.UtcNow).ToString("dd MMMM, yyyy");

                                        string ReplaceTokens(string src)
                                        {
                                            if (string.IsNullOrEmpty(src)) return src;

                                            // 1. Built-in default keywords
                                            var res = src
                                                .Replace("{WebinarName}", webinar, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{Year}", year, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{Department}", dept, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{StudentName}", participant, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{ParticipantName}", participant, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{CertificateId}", certCode, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{CertificateCode}", certCode, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{CertificateNo}", certCode, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{Date}", dateStr, StringComparison.OrdinalIgnoreCase)
                                                .Replace("{CompletionDate}", dateStr, StringComparison.OrdinalIgnoreCase);

                                            // 2. Custom mapped keywords from LogoConfiguration.keywords
                                            if (logoConfig?.Keywords != null)
                                            {
                                                foreach (var (customKey, targetCol) in logoConfig.Keywords)
                                                {
                                                    if (string.IsNullOrWhiteSpace(customKey) || string.IsNullOrWhiteSpace(targetCol)) continue;
                                                    string tag = customKey.StartsWith("{") ? customKey : $"{{{customKey}}}";
                                                    string val = "";
                                                    if (targetCol.Contains("WebinarName", StringComparison.OrdinalIgnoreCase)) val = webinar;
                                                    else if (targetCol.Contains("Year", StringComparison.OrdinalIgnoreCase)) val = year;
                                                    else if (targetCol.Contains("Department", StringComparison.OrdinalIgnoreCase)) val = dept;
                                                    else if (targetCol.Contains("FullName", StringComparison.OrdinalIgnoreCase) || targetCol.Contains("FirstName", StringComparison.OrdinalIgnoreCase)) val = participant;
                                                    else if (targetCol.Contains("Certificate", StringComparison.OrdinalIgnoreCase)) val = certCode;
                                                    else if (targetCol.Contains("Date", StringComparison.OrdinalIgnoreCase)) val = dateStr;

                                                    res = res.Replace(tag, val, StringComparison.OrdinalIgnoreCase);
                                                }
                                            }

                                            return res;
                                        }

                                        textContent = ReplaceTokens(textContent);
                                        if (!string.IsNullOrEmpty(htmlContent))
                                        {
                                            htmlContent = ReplaceTokens(htmlContent);
                                        }
                                    }

                                    if (string.IsNullOrEmpty(htmlContent) && !string.IsNullOrEmpty(textContent) && textContent.Contains('<') && textContent.Contains('>'))
                                    {
                                        htmlContent = textContent;
                                    }

                                    var textColor = !string.IsNullOrWhiteSpace(slot.Color) ? slot.Color : "#1E293B";
                                    var isBold = slot.Bold;
                                    float fontSizePt = (slot.FontSize.HasValue && slot.FontSize.Value > 0)
                                        ? Math.Max(6f, slot.FontSize.Value * scale)
                                        : Math.Max(6f, Math.Min(safeH * 0.7f, 32f));

                                    float lineH = slot.LineHeight.HasValue && slot.LineHeight.Value > 0
                                        ? slot.LineHeight.Value
                                        : 1.4f;

                                    // Build text container: alignment MUST come before Width/Height in QuestPDF
                                    string alignStr = slot.Align ?? "center";
                                    IContainer textContainer;
                                    if (string.Equals(alignStr, "left", StringComparison.OrdinalIgnoreCase))
                                    {
                                        textContainer = layers.Layer()
                                            .AlignTop().AlignLeft()
                                            .PaddingLeft(pdfX).PaddingTop(pdfY)
                                            .Width(safeW).MinHeight(safeH)
                                            .PaddingHorizontal(12f * scale)
                                            .AlignLeft().AlignMiddle();
                                    }
                                    else if (string.Equals(alignStr, "right", StringComparison.OrdinalIgnoreCase))
                                    {
                                        textContainer = layers.Layer()
                                            .AlignTop().AlignLeft()
                                            .PaddingLeft(pdfX).PaddingTop(pdfY)
                                            .Width(safeW).MinHeight(safeH)
                                            .PaddingHorizontal(12f * scale)
                                            .AlignRight().AlignMiddle();
                                    }
                                    else
                                    {
                                        textContainer = layers.Layer()
                                            .AlignTop().AlignLeft()
                                            .PaddingLeft(pdfX).PaddingTop(pdfY)
                                            .Width(safeW).MinHeight(safeH)
                                            .PaddingHorizontal(12f * scale)
                                            .AlignCenter().AlignMiddle();
                                    }

                                    textContainer.Text(t =>
                                    {
                                        // NormalizeFontFamily strips CSS stacks like '"Inter","Roboto",Arial,sans-serif'
                                        // down to the first registered font name. Never passes raw CSS to QuestPDF.
                                        var resolvedFont = NormalizeFontFamily(slot.FontFamily);
                                        t.DefaultTextStyle(x => x.FontFamily(resolvedFont).LineHeight(lineH));

                                        if (string.Equals(slot.Align, "left", StringComparison.OrdinalIgnoreCase))
                                            t.AlignLeft();
                                        else if (string.Equals(slot.Align, "right", StringComparison.OrdinalIgnoreCase))
                                            t.AlignRight();
                                        else
                                            t.AlignCenter();

                                        var richSpans = ParseRichText(htmlContent, textColor, isBold, fontSizePt, scale);
                                        if (richSpans.Count > 0)
                                        {
                                            foreach (var s in richSpans)
                                            {
                                                if (string.IsNullOrEmpty(s.Text)) continue;
                                                var safeColor = NormalizeColor(s.Color, textColor);
                                                float safeFontSize = Math.Max(6f, s.FontSize ?? fontSizePt);
                                                var span = t.Span(s.Text)
                                                    .FontSize(safeFontSize)
                                                    .FontColor(safeColor);

                                                if (s.IsBold)
                                                    span.Bold();
                                                else
                                                    span.NormalWeight();
                                            }
                                        }
                                        else if (!string.IsNullOrEmpty(textContent))
                                        {
                                            var safeColor = NormalizeColor(textColor, "#1E293B");
                                            float safeFontSize = Math.Max(6f, fontSizePt);
                                            var span = t.Span(textContent)
                                                .FontSize(safeFontSize)
                                                .FontColor(safeColor);

                                            if (isBold)
                                                span.Bold();
                                            else
                                                span.NormalWeight();
                                        }
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

                        bool hasCustomTextSlots = logoConfig?.LogoSlots != null &&
                            logoConfig.LogoSlots.Any(s => string.Equals(s.Type, "text", StringComparison.OrdinalIgnoreCase) || !string.IsNullOrWhiteSpace(s.Text));

                        // 3. Dynamic participant text overlay
                        // For visual designer templates: layout is 100% controlled by designer slots (e.g. {CertificateId}, {StudentName}, etc.).
                        // Only pure legacy templates (without custom text slots) fall back to the fixed legacy overlay block.
                        if (!hasCustomTextSlots && data != null && (!string.IsNullOrWhiteSpace(data.ParticipantName) || !string.IsNullOrWhiteSpace(data.WebinarName)))
                        {
                            // Legacy fixed layout overlay ONLY for legacy pre-builder templates
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
                                    .PaddingVertical(3)
                                    .PaddingHorizontal(8)
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

            _logger?.LogInformation("[FLOW-4f] Calling document.GeneratePdf() for TemplateId={Id}", dbTemplate.Id);
            return document.GeneratePdf();
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "[FLOW-4g] GenerateVisualTemplatePdf CRASHED for TemplateId={Id} — {Message}", dbTemplate.Id, ex.Message);
            return null;
        }
    }

    private class RichTextSpan
    {
        public string Text { get; set; } = string.Empty;
        public string Color { get; set; } = "#1E293B";
        public bool IsBold { get; set; }
        public float? FontSize { get; set; }
    }

    private static List<RichTextSpan> ParseRichText(string? html, string defaultColor, bool defaultBold, float defaultFontSize, float scale)
    {
        var result = new List<RichTextSpan>();
        if (string.IsNullOrWhiteSpace(html))
            return result;

        if (!html.Contains('<') || !html.Contains('>'))
        {
            result.Add(new RichTextSpan
            {
                Text = System.Net.WebUtility.HtmlDecode(html),
                Color = defaultColor,
                IsBold = defaultBold,
                FontSize = defaultFontSize
            });
            return result;
        }

        var tokens = System.Text.RegularExpressions.Regex.Split(html, @"(<[^>]+>)");

        var colorStack = new Stack<string>();
        var boldStack = new Stack<bool>();
        var fontStack = new Stack<float?>();

        colorStack.Push(defaultColor);
        boldStack.Push(defaultBold);
        fontStack.Push(defaultFontSize);

        foreach (var token in tokens)
        {
            if (string.IsNullOrEmpty(token)) continue;

            if (token.StartsWith("<") && token.EndsWith(">"))
            {
                var tag = token.Trim().ToLowerInvariant();

                if (tag.StartsWith("</"))
                {
                    if (tag.StartsWith("</b") || tag.StartsWith("</strong") || tag.StartsWith("</span") || tag.StartsWith("</font") || tag.StartsWith("</em") || tag.StartsWith("</i"))
                    {
                        if (colorStack.Count > 1) colorStack.Pop();
                        if (boldStack.Count > 1) boldStack.Pop();
                        if (fontStack.Count > 1) fontStack.Pop();
                    }
                }
                else if (tag.StartsWith("<br") || tag == "<p>" || tag.StartsWith("<div"))
                {
                    if (result.Count > 0 && !result[^1].Text.EndsWith("\n"))
                    {
                        result.Add(new RichTextSpan
                        {
                            Text = "\n",
                            Color = colorStack.Peek(),
                            IsBold = boldStack.Peek(),
                            FontSize = fontStack.Peek()
                        });
                    }
                }
                else
                {
                    bool isB = boldStack.Peek();
                    string col = colorStack.Peek();
                    float? fSize = fontStack.Peek();

                    if (tag.StartsWith("<b") || tag.StartsWith("<strong"))
                    {
                        isB = true;
                    }

                    var styleMatch = System.Text.RegularExpressions.Regex.Match(token, @"style\s*=\s*[""']([^""']+)[""']", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (styleMatch.Success)
                    {
                        var styleStr = styleMatch.Groups[1].Value;

                        if (System.Text.RegularExpressions.Regex.IsMatch(styleStr, @"font-weight\s*:\s*(bold|700|800|900)", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                        {
                            isB = true;
                        }
                        else if (System.Text.RegularExpressions.Regex.IsMatch(styleStr, @"font-weight\s*:\s*(normal|400|500)", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                        {
                            isB = false;
                        }

                        var colMatch = System.Text.RegularExpressions.Regex.Match(styleStr, @"color\s*:\s*([^;""']+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                        if (colMatch.Success)
                        {
                            col = NormalizeColor(colMatch.Groups[1].Value.Trim(), col);
                        }

                        var sizeMatch = System.Text.RegularExpressions.Regex.Match(styleStr, @"font-size\s*:\s*(\d+(\.\d+)?)px", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                        if (sizeMatch.Success && float.TryParse(sizeMatch.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedSize))
                        {
                            fSize = Math.Max(6f, parsedSize * scale);
                        }
                    }

                    var fontColMatch = System.Text.RegularExpressions.Regex.Match(token, @"color\s*=\s*[""']([^""']+)[""']", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (fontColMatch.Success)
                    {
                        col = NormalizeColor(fontColMatch.Groups[1].Value.Trim(), col);
                    }

                    boldStack.Push(isB);
                    colorStack.Push(col);
                    fontStack.Push(fSize);
                }
            }
            else
            {
                var text = System.Net.WebUtility.HtmlDecode(token);
                if (!string.IsNullOrEmpty(text))
                {
                    text = text.Replace('\u00A0', ' ');
                    result.Add(new RichTextSpan
                    {
                        Text = text,
                        Color = colorStack.Peek(),
                        IsBold = boldStack.Peek(),
                        FontSize = fontStack.Peek()
                    });
                }
            }
        }

        return result;
    }

    // -----------------------------------------------------------------------
    // NormalizeFontFamily — strips CSS font stacks, returns one registered name
    // -----------------------------------------------------------------------
    private static readonly HashSet<string> _cssFontGenericKeywords = new(StringComparer.OrdinalIgnoreCase)
    {
        "sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui",
        "ui-sans-serif", "ui-serif", "ui-monospace", "inherit", "initial", "unset"
    };

    // Map CSS / Google Font names → registered QuestPDF font family name.
    // Add entries here when new font TTF files are added to backend/Fonts/.
    private static readonly Dictionary<string, string> _fontAliasMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "inter",         "Arial" },
        { "roboto",        "Arial" },
        { "open sans",     "Arial" },
        { "noto sans",     "Arial" },
        { "helvetica",     "Arial" },
        { "helvetica neue","Arial" },
        { "verdana",       "Arial" },
        { "calibri",       "Arial" },
        { "tahoma",        "Arial" },
        { "trebuchet ms",  "Arial" },
        { "arial",         "Arial" },
        { "lato",          "Lato"  },
    };

    // Font families registered via FontManager at startup (Program.cs).
    // Keep in sync with the Fonts/ directory contents.
    private static readonly HashSet<string> _registeredFonts = new(StringComparer.OrdinalIgnoreCase)
    {
        "Arial", "Lato"
    };

    /// <summary>
    /// Normalizes a raw CSS font-family value (possibly a stack like
    /// <c>"Inter", "Roboto", Arial, sans-serif</c>) to a single font-family
    /// name that is registered with QuestPDF's FontManager.
    /// Never returns a CSS generic keyword or multi-token value.
    /// Falls back to <paramref name="fallback"/> (default: "Arial").
    /// </summary>
    private static string NormalizeFontFamily(string? rawCssFont, string fallback = "Arial")
    {
        if (string.IsNullOrWhiteSpace(rawCssFont))
            return fallback;

        foreach (var candidate in rawCssFont.Split(','))
        {
            var name = candidate.Trim().Trim('"', '\'').Trim();
            if (string.IsNullOrEmpty(name) || _cssFontGenericKeywords.Contains(name))
                continue;

            if (_registeredFonts.Contains(name))
                return name;

            if (_fontAliasMap.TryGetValue(name, out var mapped))
                return mapped;
        }

        return fallback;
    }

    private static string NormalizeColor(string? raw, string fallback = "#1E293B")
    {
        string safeFallback = (fallback != null && fallback.StartsWith("#") && (fallback.Length == 4 || fallback.Length == 7 || fallback.Length == 9))
            ? fallback
            : "#1E293B";

        if (string.IsNullOrWhiteSpace(raw)) return safeFallback;
        raw = raw.Trim();

        // 1. Valid Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
        if (System.Text.RegularExpressions.Regex.IsMatch(raw, @"^#[0-9a-fA-F]{3,8}$"))
        {
            if (raw.Length == 4 || raw.Length == 5 || raw.Length == 7 || raw.Length == 9)
                return raw;
        }

        // 2. rgb(...) or rgba(...) format
        var rgbMatch = System.Text.RegularExpressions.Regex.Match(raw, @"rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (rgbMatch.Success &&
            int.TryParse(rgbMatch.Groups[1].Value, out int r) &&
            int.TryParse(rgbMatch.Groups[2].Value, out int g) &&
            int.TryParse(rgbMatch.Groups[3].Value, out int b))
        {
            r = Math.Clamp(r, 0, 255);
            g = Math.Clamp(g, 0, 255);
            b = Math.Clamp(b, 0, 255);
            return $"#{r:X2}{g:X2}{b:X2}";
        }

        // 3. Common CSS color names
        return raw.ToLowerInvariant() switch
        {
            "black" => "#000000",
            "white" => "#FFFFFF",
            "red" => "#DC2626",
            "blue" => "#2563EB",
            "green" => "#16A34A",
            "yellow" => "#CA8A04",
            "orange" => "#EA580C",
            "purple" => "#9333EA",
            "gray" or "grey" => "#64748B",
            _ => safeFallback
        };
    }
}