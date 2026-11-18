using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Dapper;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;

namespace WebinarApi.Services;

// -------------------------------------------------------
// RecordingSyncService: Periodic Background Worker
// Runs every X minutes (default 3 mins)
// 1. Queries wms.WebinarRecordings where Status = 'PROCESSING'
// 2. Polls BigBlueButton getRecordings API for publication status
// 3. When published == true, streams the video (.webm) into MeetingSources/
// 4. Updates database to Status = 'DOWNLOADED' (ready for transcription)
// -------------------------------------------------------
public class RecordingSyncService : BackgroundService
{
    private readonly IConfiguration _config;
    private readonly ILogger<RecordingSyncService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly string _connectionString;
    private readonly string _getRecordingsApi;
    private readonly string _basePresentationUrl;
    private readonly string _sharedSecret;
    private readonly string _recordingStoragePath;
    private readonly int _intervalInMinutes;
    private readonly int _maxHoursToPoll;

    public RecordingSyncService(
        IConfiguration config,
        ILogger<RecordingSyncService> logger,
        IHttpClientFactory httpClientFactory,
        IServiceScopeFactory scopeFactory)
    {
        _config = config;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _scopeFactory = scopeFactory;

        _connectionString = config.GetConnectionString("DefaultConnection")
                          ?? throw new InvalidOperationException("Connection string not configured.");

        _sharedSecret = config["BBB:SharedSecret"] ?? string.Empty;

        _getRecordingsApi = (config["BBB:GetRecordingsApi"]
                          ?? "https://bbb.test/bigbluebutton/api/getRecordings").Trim();

        _basePresentationUrl = (config["BBB:BasePresentationUrl"]
                             ?? "https://bbb.test/presentation").Trim();

        _recordingStoragePath = config["BBB:RecordingStoragePath"] ?? "MeetingSources";

        _intervalInMinutes = config.GetValue<int>("RecordingSync:IntervalInMinutes", 3);
        _maxHoursToPoll = config.GetValue<int>("RecordingSync:MaxHoursToPoll", 24);
    }

    private void LogBoth(string message)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss} REC] {message}");
        _logger.LogInformation("{Message}", message);
    }

    private void LogWarnBoth(string message)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss} WRN] {message}");
        _logger.LogWarning("{Message}", message);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogBoth($"[RecordingSyncService] 🚀 Background worker started. Poll Interval: {_intervalInMinutes} min(s).");

        // Ensure target storage folder exists
        EnsureStorageDirectory();

        // Initial delay to let application start up cleanly
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncPendingRecordingsAsync(stoppingToken);
                await ProcessPendingTranscriptionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                LogWarnBoth($"[RecordingSyncService] ⚠️ Error during recording sync cycle: {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromMinutes(_intervalInMinutes), stoppingToken);
        }
    }

    public async Task SyncPendingRecordingsAsync(CancellationToken stoppingToken)
    {
        using var conn = new SqlConnection(_connectionString);

        // Fetch all recordings waiting to be published
        var pending = (await conn.QueryAsync<PendingRecordingDto>(
            "wms.usp_GetPendingRecordings",
            commandType: CommandType.StoredProcedure
        )).ToList();

        if (pending.Count == 0)
        {
            return;
        }

        LogBoth($"[RecordingSyncService] 🔍 Found {pending.Count} pending recording(s) to verify with BigBlueButton.");

        var nowUtc = DateTime.UtcNow;

        foreach (var item in pending)
        {
            if (stoppingToken.IsCancellationRequested) break;

            // Check if recording exceeded max polling age (e.g. 24 hours)
            if ((nowUtc - item.CreatedAt) > TimeSpan.FromHours(_maxHoursToPoll))
            {
                LogWarnBoth($"[RecordingSyncService] ⏰ Recording for Meeting '{item.MeetingIDString}' (RecordId: {item.RecordId}) exceeded {_maxHoursToPoll}h. Marking NO_RECORDING.");
                await conn.ExecuteAsync(
                    "wms.usp_MarkRecordingStatus",
                    new { RecordId = item.RecordId, Status = "NO_RECORDING" },
                    commandType: CommandType.StoredProcedure
                );
                continue;
            }

            try
            {
                await ProcessSingleRecordingAsync(item, conn, stoppingToken);
            }
            catch (Exception ex)
            {
                LogWarnBoth($"[RecordingSyncService] ⚠️ Exception processing RecordId '{item.RecordId}': {ex.Message}");
            }
        }
    }

    private async Task ProcessSingleRecordingAsync(
        PendingRecordingDto item,
        SqlConnection conn,
        CancellationToken stoppingToken)
    {
        // 0. If in WAITING_FOR_END state, verify if BBB session has finished running
        if (string.Equals(item.Status, "WAITING_FOR_END", StringComparison.OrdinalIgnoreCase))
        {
            var isRunningApi = _getRecordingsApi.EndsWith("/getRecordings", StringComparison.OrdinalIgnoreCase)
                ? _getRecordingsApi[..^"/getRecordings".Length] + "/isMeetingRunning"
                : _getRecordingsApi;

            var runningQuery = $"meetingID={Uri.EscapeDataString(item.MeetingIDString)}";
            var runningDataToHash = "isMeetingRunning" + runningQuery + _sharedSecret;
            using var sha1Run = SHA1.Create();
            var runningChecksum = Convert.ToHexString(sha1Run.ComputeHash(Encoding.UTF8.GetBytes(runningDataToHash))).ToLowerInvariant();
            var runningUrl = $"{isRunningApi}?{runningQuery}&checksum={runningChecksum}";

            var runningClient = _httpClientFactory.CreateClient("BbbClient");
            runningClient.Timeout = TimeSpan.FromSeconds(15);
            var runningResp = await runningClient.GetAsync(runningUrl, stoppingToken);

            if (runningResp.IsSuccessStatusCode)
            {
                var runXml = await runningResp.Content.ReadAsStringAsync(stoppingToken);
                var runDoc = XDocument.Parse(runXml);
                var isRunning = string.Equals(runDoc.Root?.Element("running")?.Value?.Trim(), "true", StringComparison.OrdinalIgnoreCase);

                if (!isRunning)
                {
                    LogBoth($"[RecordingSyncService] 🛑 Meeting '{item.MeetingIDString}' has ENDED on BBB. Transitioning Status to 'PROCESSING'...");
                    await conn.ExecuteAsync(
                        "wms.usp_MarkRecordingProcessing",
                        new { MeetingIDString = item.MeetingIDString },
                        commandType: CommandType.StoredProcedure
                    );
                    item.Status = "PROCESSING";
                }
                else
                {
                    LogBoth($"[RecordingSyncService] ⏳ Meeting '{item.MeetingIDString}' is still ACTIVE on BBB. Keeping 'WAITING_FOR_END'.");
                    return;
                }
            }
        }

        // 1. Call BBB getRecordings API
        var query = $"recordID={Uri.EscapeDataString(item.RecordId)}";
        var dataToHash = "getRecordings" + query + _sharedSecret;

        using var sha1 = SHA1.Create();
        var checksum = Convert.ToHexString(sha1.ComputeHash(Encoding.UTF8.GetBytes(dataToHash))).ToLowerInvariant();
        var requestUrl = $"{_getRecordingsApi}?{query}&checksum={checksum}";

        var httpClient = _httpClientFactory.CreateClient("BbbClient");
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var response = await httpClient.GetAsync(requestUrl, stoppingToken);
        if (!response.IsSuccessStatusCode)
        {
            LogWarnBoth($"[RecordingSyncService] BBB getRecordings returned HTTP {response.StatusCode} for RecordId '{item.RecordId}'.");
            return;
        }

        var xml = await response.Content.ReadAsStringAsync(stoppingToken);
        var xdoc = XDocument.Parse(xml);

        var returncode = xdoc.Root?.Element("returncode")?.Value;
        if (!string.Equals(returncode, "SUCCESS", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var recordingNode = xdoc.Root?.Element("recordings")?.Elements("recording")
            .FirstOrDefault(r => string.Equals(r.Element("recordID")?.Value?.Trim(), item.RecordId, StringComparison.OrdinalIgnoreCase));

        if (recordingNode == null)
        {
            LogBoth($"[RecordingSyncService] ⏳ RecordId '{item.RecordId}' not found in BBB published list yet. Still processing.");
            return;
        }

        var publishedStr = recordingNode.Element("published")?.Value?.Trim();
        bool isPublished = string.Equals(publishedStr, "true", StringComparison.OrdinalIgnoreCase);

        if (!isPublished)
        {
            LogBoth($"[RecordingSyncService] ⏳ RecordId '{item.RecordId}' exists in BBB but published=false. Waiting for BBB rap-worker to finish.");
            return;
        }

        // 2. Video is published! Download webcams.webm video
        var videoUrl = $"{_basePresentationUrl.TrimEnd('/')}/{item.RecordId}/video/webcams.webm";
        LogBoth($"[RecordingSyncService] 🎉 RecordId '{item.RecordId}' IS PUBLISHED! Beginning download from: {videoUrl}");

        var downloadSuccess = await DownloadAndSaveVideoAsync(item.RecordId, videoUrl, stoppingToken);
        if (downloadSuccess.success)
        {
            // 3. Mark database as DOWNLOADED
            await conn.ExecuteAsync(
                "wms.usp_MarkRecordingDownloaded",
                new
                {
                    RecordId = item.RecordId,
                    LocalFilePath = downloadSuccess.relativeFilePath,
                    RecordingUrl = videoUrl,
                    FileSize = downloadSuccess.fileSize
                },
                commandType: CommandType.StoredProcedure
            );

            LogBoth($"[RecordingSyncService] ✅ Successfully saved video to '{downloadSuccess.relativeFilePath}' ({downloadSuccess.fileSize} bytes). Status updated to DOWNLOADED.");

            // Immediately trigger transcription for this newly downloaded recording
            _ = Task.Run(async () =>
            {
                await TriggerSingleTranscriptionAsync(item.RecordId, downloadSuccess.relativeFilePath, stoppingToken);
            }, stoppingToken);
        }
        else
        {
            LogWarnBoth($"[RecordingSyncService] ❌ Failed downloading video stream for RecordId '{item.RecordId}'. Will retry on next cycle.");
        }
    }

    private async Task<(bool success, string relativeFilePath, long fileSize)> DownloadAndSaveVideoAsync(
        string recordId,
        string videoUrl,
        CancellationToken stoppingToken)
    {
        try
        {
            var absoluteDir = EnsureStorageDirectory();
            var fileName = $"{recordId}.webm";
            var finalFilePath = Path.Combine(absoluteDir, fileName);
            var tempFilePath = Path.Combine(absoluteDir, $"{recordId}.webm.tmp");

            // Idempotency check: if final file already exists and has valid size, avoid redundant download
            var cleanRelativePath = Path.Combine("MeetingSources", fileName).Replace('\\', '/');
            if (File.Exists(finalFilePath))
            {
                var existingInfo = new FileInfo(finalFilePath);
                if (existingInfo.Length > 0)
                {
                    return (true, cleanRelativePath, existingInfo.Length);
                }
            }

            var httpClient = _httpClientFactory.CreateClient("BbbClient");
            httpClient.Timeout = TimeSpan.FromMinutes(10); // Generous timeout for large video streams

            using var response = await httpClient.GetAsync(videoUrl, HttpCompletionOption.ResponseHeadersRead, stoppingToken);
            if (!response.IsSuccessStatusCode)
            {
                LogWarnBoth($"[RecordingSyncService] Video URL returned HTTP {response.StatusCode}: {videoUrl}");
                return (false, string.Empty, 0);
            }

            // Stream to temporary file
            await using (var remoteStream = await response.Content.ReadAsStreamAsync(stoppingToken))
            await using (var fileStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true))
            {
                await remoteStream.CopyToAsync(fileStream, stoppingToken);
            }

            var tempInfo = new FileInfo(tempFilePath);
            if (tempInfo.Length == 0)
            {
                File.Delete(tempFilePath);
                return (false, string.Empty, 0);
            }

            // Atomic rename to final file
            File.Move(tempFilePath, finalFilePath, overwrite: true);

            return (true, cleanRelativePath, tempInfo.Length);
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[RecordingSyncService] Exception downloading video for RecordId '{recordId}': {ex.Message}");
            return (false, string.Empty, 0);
        }
    }

    public async Task ProcessPendingTranscriptionsAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var conn = new SqlConnection(_connectionString);

            var pending = (await conn.QueryAsync<PendingTranscriptionDto>(
                "wms.usp_GetPendingTranscriptions",
                commandType: CommandType.StoredProcedure
            )).ToList();

            if (pending.Count == 0) return;

            LogBoth($"[RecordingSyncService] 🎙️ Found {pending.Count} downloaded recording(s) waiting for transcription.");

            foreach (var item in pending)
            {
                if (stoppingToken.IsCancellationRequested) break;
                if (string.IsNullOrWhiteSpace(item.LocalFilePath)) continue;

                await TriggerSingleTranscriptionAsync(item.RecordId, item.LocalFilePath, stoppingToken);
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[RecordingSyncService] ⚠️ Exception during pending transcriptions cycle: {ex.Message}");
        }
    }

    private async Task TriggerSingleTranscriptionAsync(
        string recordId,
        string localFilePath,
        CancellationToken stoppingToken)
    {
        try
        {
            using var conn = new SqlConnection(_connectionString);

            LogBoth($"[RecordingSyncService] ⏳ Starting Whisper transcription for RecordId '{recordId}' (File: '{localFilePath}')...");

            // Update status to IN_PROGRESS so subsequent ticks skip this item
            await conn.ExecuteAsync(
                "wms.usp_MarkRecordingTranscriptStatus",
                new { RecordId = recordId, TranscriptStatus = "IN_PROGRESS" },
                commandType: CommandType.StoredProcedure
            );

            using var scope = _scopeFactory.CreateScope();
            var transcriber = scope.ServiceProvider.GetRequiredService<ITranscriptionService>();

            var (success, message, transcriptPath) = await transcriber.TranscribeVideoAsync(recordId, localFilePath, stoppingToken);

            if (success && !string.IsNullOrWhiteSpace(transcriptPath))
            {
                await conn.ExecuteAsync(
                    "wms.usp_MarkRecordingTranscribed",
                    new { RecordId = recordId, TranscriptPath = transcriptPath },
                    commandType: CommandType.StoredProcedure
                );

                LogBoth($"[RecordingSyncService] ✅ SUCCESS: RecordId '{recordId}' transcribed! Status set to COMPLETED and IsTranscribed = 1.");
            }
            else
            {
                LogWarnBoth($"[RecordingSyncService] ⚠️ Transcription failed for '{recordId}': {message}. Resetting status to NOT_STARTED for retry.");
                await conn.ExecuteAsync(
                    "wms.usp_MarkRecordingTranscriptStatus",
                    new { RecordId = recordId, TranscriptStatus = "NOT_STARTED" },
                    commandType: CommandType.StoredProcedure
                );
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[RecordingSyncService] ❌ Exception in TriggerSingleTranscriptionAsync for '{recordId}': {ex.Message}");
        }
    }

    private string EnsureStorageDirectory()
    {
        var rawPath = _recordingStoragePath;
        var absolutePath = Path.GetFullPath(Path.IsPathRooted(rawPath)
            ? rawPath
            : Path.Combine(Directory.GetCurrentDirectory(), rawPath));

        if (!Directory.Exists(absolutePath))
        {
            Directory.CreateDirectory(absolutePath);
        }

        return absolutePath;
    }
}
