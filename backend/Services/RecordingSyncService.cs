using System.Collections.Concurrent;
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
    private static readonly ConcurrentDictionary<string, byte> _activeTranscriptionJobs = new();
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

        if (pending.Count > 0)
        {
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

        // Flexible barrier sweep: check any uncompleted webinars whose meeting/recording already finished
        await SweepUncompletedEndedWebinarsAsync(conn, stoppingToken);
    }

    private async Task ProcessSingleRecordingAsync(
        PendingRecordingDto item,
        SqlConnection conn,
        CancellationToken stoppingToken)
    {
        // 0. If in WAITING_FOR_END state, verify if BBB session has finished running
        if (string.Equals(item.Status, "WAITING_FOR_END", StringComparison.OrdinalIgnoreCase))
        {
            // Only check if current time is strictly greater than the webinar's scheduled EndTime
            var nowUtc = DateTime.UtcNow;
            DateTime endTimeUtc;

            if (item.EndTime.HasValue)
            {
                endTimeUtc = DateTime.SpecifyKind(item.EndTime.Value, DateTimeKind.Utc);
            }
            else
            {
                var webinarEndTime = await conn.ExecuteScalarAsync<DateTime?>(
                    "SELECT EndTime FROM wms.Webinars WHERE Id = @WebinarId",
                    new { WebinarId = item.WebinarId }
                );
                endTimeUtc = webinarEndTime.HasValue
                    ? DateTime.SpecifyKind(webinarEndTime.Value, DateTimeKind.Utc)
                    : DateTime.MaxValue;
            }

            // If current time has not yet passed EndTime, the webinar is still upcoming or in progress!
            if (nowUtc <= endTimeUtc)
            {
                LogBoth($"[RecordingSyncService] ⏳ Webinar {item.WebinarId} has not reached EndTime yet (Now UTC: {nowUtc:yyyy-MM-dd HH:mm:ss} <= EndTime UTC: {endTimeUtc:yyyy-MM-dd HH:mm:ss}). Keeping 'WAITING_FOR_END'.");
                return;
            }

            // Current Time > EndTime has passed! Now verify with BBB if session is still running (e.g. overtime Q&A)
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

                if (isRunning)
                {
                    // BBB is still running! Moderator/speaker is running overtime. Wait for next polling window!
                    LogBoth($"[RecordingSyncService] ⏳ Meeting '{item.MeetingIDString}' is still ACTIVE on BBB after EndTime (overtime Q&A). Keeping 'WAITING_FOR_END' for next window.");
                    return;
                }

                // BBB is NOT running (running == false) AND Current Time > EndTime: Meeting has truly ended!
                LogBoth($"[RecordingSyncService] 🛑 Meeting '{item.MeetingIDString}' has ENDED on BBB (Now > EndTime and BBB running == false). Transitioning Status to 'PROCESSING'...");
                await conn.ExecuteAsync(
                    "wms.usp_MarkRecordingProcessing",
                    new { MeetingIDString = item.MeetingIDString },
                    commandType: CommandType.StoredProcedure
                );
                item.Status = "PROCESSING";

                // Flexible barrier: if attendance not yet recorded, complete it now!
                await EnsureWebinarCompletedIfEndedAsync(item.WebinarId, item.MeetingIDString, conn);
            }
            else
            {
                LogBoth($"[RecordingSyncService] ⚠️ BBB isMeetingRunning returned HTTP {runningResp.StatusCode} for '{item.MeetingIDString}'. Keeping 'WAITING_FOR_END'.");
                return;
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

            // Sequentially trigger transcription for this newly downloaded recording
            await TriggerSingleTranscriptionAsync(item.RecordId, downloadSuccess.relativeFilePath, stoppingToken);
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

            // Self-healing: If any recording is already transcribed, ensure TranscriptStatus is COMPLETED
            await conn.ExecuteAsync(
                @"UPDATE wms.WebinarRecordings
                  SET TranscriptStatus = 'COMPLETED',
                      UpdatedAt = SYSUTCDATETIME()
                  WHERE IsTranscribed = 1 
                    AND TranscriptFilePath IS NOT NULL 
                    AND TranscriptStatus <> 'COMPLETED'"
            );

            // Self-healing: Reset stale IN_PROGRESS jobs (e.g. from previous server restart/freeze) back to NOT_STARTED
            await conn.ExecuteAsync(
                @"UPDATE wms.WebinarRecordings
                  SET TranscriptStatus = 'NOT_STARTED',
                      UpdatedAt = SYSUTCDATETIME()
                  WHERE IsTranscribed = 0
                    AND TranscriptStatus = 'IN_PROGRESS'
                    AND UpdatedAt < DATEADD(MINUTE, -5, SYSUTCDATETIME())"
            );

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
        // 1. In-memory concurrency guard: Only 1 worker can process a RecordId at a time in this instance
        if (!_activeTranscriptionJobs.TryAdd(recordId, 0))
        {
            LogBoth($"[RecordingSyncService] ℹ️ RecordId '{recordId}' is currently being transcribed by another active worker. Skipping duplicate spawn.");
            return;
        }

        try
        {
            using var conn = new SqlConnection(_connectionString);

            // 2. Check if already completed in DB
            var existingStatus = await conn.QueryFirstOrDefaultAsync<(bool IsTranscribed, string? TranscriptStatus)>(
                "SELECT IsTranscribed, TranscriptStatus FROM wms.WebinarRecordings WHERE RecordId = @RecordId",
                new { RecordId = recordId }
            );

            if (existingStatus.IsTranscribed || string.Equals(existingStatus.TranscriptStatus, "COMPLETED", StringComparison.OrdinalIgnoreCase))
            {
                LogBoth($"[RecordingSyncService] ℹ️ RecordId '{recordId}' is already COMPLETED. Skipping duplicate transcription.");
                return;
            }

            // 3. Atomic SQL job claim: Transition to IN_PROGRESS only if still NOT_STARTED or PENDING
            var claimed = await conn.ExecuteAsync(
                @"UPDATE wms.WebinarRecordings
                  SET TranscriptStatus = 'IN_PROGRESS',
                      UpdatedAt = SYSUTCDATETIME()
                  WHERE RecordId = @RecordId
                    AND IsTranscribed = 0
                    AND (TranscriptStatus IN ('NOT_STARTED', 'PENDING') OR TranscriptStatus IS NULL)",
                new { RecordId = recordId }
            );

            if (claimed == 0)
            {
                LogBoth($"[RecordingSyncService] ℹ️ RecordId '{recordId}' was already claimed or updated by another worker. Skipping.");
                return;
            }

            LogBoth($"[RecordingSyncService] ⏳ Starting Whisper transcription for RecordId '{recordId}' (File: '{localFilePath}')...");

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
                LogWarnBoth($"[RecordingSyncService] ⚠️ Transcription failed for '{recordId}': {message}. Checking status before reset...");

                // 4. Safe failure reset: NEVER reset if already transcribed or completed
                await conn.ExecuteAsync(
                    @"UPDATE wms.WebinarRecordings
                      SET TranscriptStatus = 'NOT_STARTED',
                          UpdatedAt = SYSUTCDATETIME()
                      WHERE RecordId = @RecordId
                        AND IsTranscribed = 0
                        AND TranscriptStatus <> 'COMPLETED'",
                    new { RecordId = recordId }
                );
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[RecordingSyncService] ❌ Exception in TriggerSingleTranscriptionAsync for '{recordId}': {ex.Message}");
        }
        finally
        {
            _activeTranscriptionJobs.TryRemove(recordId, out _);
        }
    }

    private async Task EnsureWebinarCompletedIfEndedAsync(long webinarId, string meetingId, SqlConnection conn)
    {
        try
        {
            // Barrier: Check if webinar already has completed student records OR is already marked IsCompleted = 1
            var isAlreadyCompleted = await conn.ExecuteScalarAsync<bool>(
                @"SELECT CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM wms.WebinarCompleted wc 
                        JOIN wms.WebinarRegistrations wr ON wr.Id = wc.WebinarRegisterId 
                        WHERE wr.WebinarId = @WebinarId
                    ) OR EXISTS (
                        SELECT 1 FROM wms.Webinars WHERE Id = @WebinarId AND IsCompleted = 1
                    ) THEN 1 ELSE 0 END",
                new { WebinarId = webinarId }
            );

            if (isAlreadyCompleted)
            {
                LogBoth($"[RecordingSyncService] ℹ️ Webinar {webinarId} already has completion records or IsCompleted = 1. Skipping duplicate completion.");
                return;
            }

            LogBoth($"[RecordingSyncService] ⚡ Meeting '{meetingId}' (Webinar {webinarId}) ended on BBB but attendance not yet recorded in WebinarCompleted. Completing now...");

            using var scope = _scopeFactory.CreateScope();
            var meetingService = scope.ServiceProvider.GetRequiredService<IMeetingService>();
            var (success, msg, count) = await meetingService.ProcessMeetingEndedAsync(meetingId, null);

            LogBoth($"[RecordingSyncService] ✅ Attendance processed for Webinar {webinarId}. Recorded {count} student(s). Message: {msg}");
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[RecordingSyncService] ⚠️ Non-fatal error completing Webinar {webinarId}: {ex.Message}");
        }
    }

    private async Task SweepUncompletedEndedWebinarsAsync(SqlConnection conn, CancellationToken stoppingToken)
    {
        try
        {
            // Find any uncompleted webinars where recording has already downloaded, transcribed, or completed
            var uncompletedList = (await conn.QueryAsync<(long WebinarId, string MeetingID)>(
                @"SELECT DISTINCT w.Id AS WebinarId, m.MeetingID
                  FROM wms.Webinars w
                  JOIN wms.Meetings m ON m.WebinarId = w.Id
                  JOIN wms.WebinarRecordings wr ON wr.WebinarId = w.Id
                  WHERE w.IsCompleted = 0 
                    AND w.EndTime <= SYSUTCDATETIME()
                    AND wr.Status IN ('COMPLETED', 'PROCESSING', 'DOWNLOADED')
                    AND m.MeetingID IS NOT NULL"
            )).ToList();

            foreach (var item in uncompletedList)
            {
                if (stoppingToken.IsCancellationRequested) break;
                await EnsureWebinarCompletedIfEndedAsync(item.WebinarId, item.MeetingID, conn);
            }
        }
        catch (Exception ex)
        {
            LogWarnBoth($"[RecordingSyncService] ⚠️ Error in SweepUncompletedEndedWebinarsAsync: {ex.Message}");
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
