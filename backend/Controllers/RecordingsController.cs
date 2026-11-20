using System.Data;
using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

[ApiController]
[Route("api/recordings")]
[Authorize]
public class RecordingsController : ControllerBase
{
    private readonly string _connectionString;
    private readonly ITranscriptionService _transcriptionService;
    private readonly ILogger<RecordingsController> _logger;

    public RecordingsController(
        IConfiguration config,
        ITranscriptionService transcriptionService,
        ILogger<RecordingsController> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection")
                          ?? throw new InvalidOperationException("Connection string not configured.");
        _transcriptionService = transcriptionService;
        _logger = logger;
    }

    private int CallerRoleId =>
        int.TryParse(User.FindFirstValue("RoleId"), out var r) ? r : 0;

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    // -------------------------------------------------------
    // GET /api/recordings
    // Returns webinars where TranscriptStatus == 'COMPLETED' AND IsTranscribed == 1:
    // - For Admin / Super Admin (RoleId 1 or 2): returns all transcripts.
    // - For Student (RoleId 3): returns only transcripts for their completed webinars.
    // -------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> GetCompletedTranscripts()
    {
        _logger.LogInformation("[RecordingsController] GET /api/recordings (Completed Transcripts) — CallerUserId: {UserId}, RoleId: {RoleId}", CallerUserId, CallerRoleId);
        using var conn = new SqlConnection(_connectionString);

        var list = (await conn.QueryAsync<WebinarRecordingListItemDto>(
            "wms.usp_GetCompletedTranscripts",
            new { UserId = CallerUserId, RoleId = CallerRoleId },
            commandType: CommandType.StoredProcedure
        )).ToList();

        foreach (var item in list)
        {
            if (!string.IsNullOrWhiteSpace(item.TranscriptFilePath))
            {
                var (success, content) = await _transcriptionService.ReadTranscriptContentAsync(item.TranscriptFilePath);
                if (success && !string.IsNullOrWhiteSpace(content))
                {
                    item.TranscriptText = content;
                }
            }
        }

        return Ok(new { success = true, data = list });
    }

    // -------------------------------------------------------
    // GET /api/recordings/{webinarId}/transcript
    // Returns full transcript text for student/admin viewing
    // -------------------------------------------------------
    [HttpGet("{webinarId:long}/transcript")]
    public async Task<IActionResult> GetWebinarTranscript(long webinarId)
    {
        _logger.LogInformation("[RecordingsController] GET /api/recordings/{WebinarId}/transcript — CallerUserId: {UserId}, RoleId: {RoleId}", webinarId, CallerUserId, CallerRoleId);

        using var conn = new SqlConnection(_connectionString);

        // Security check: If student, verify that the student completed this webinar
        if (CallerRoleId != 1 && CallerRoleId != 2)
        {
            var isCompleted = await conn.ExecuteScalarAsync<int>(
                @"SELECT 1 
                  FROM wms.WebinarRegistrations reg
                  LEFT JOIN wms.WebinarCompleted wc ON wc.WebinarRegisterId = reg.Id
                  INNER JOIN wms.Webinars w ON w.Id = reg.WebinarId
                  WHERE reg.WebinarId = @WebinarId 
                    AND reg.UserId = @UserId 
                    AND (wc.IsAttended = 1 OR w.IsCompleted = 1)",
                new { WebinarId = webinarId, UserId = CallerUserId }
            );

            if (isCompleted == 0)
            {
                _logger.LogWarning("[RecordingsController] Student {UserId} attempted unauthorized access to transcript for non-completed Webinar {WebinarId}", CallerUserId, webinarId);
                return Forbid();
            }
        }

        var record = await conn.QueryFirstOrDefaultAsync<WebinarTranscriptResponseDto>(
            "wms.usp_GetWebinarTranscript",
            new { WebinarId = webinarId },
            commandType: CommandType.StoredProcedure
        );

        if (record == null || string.IsNullOrWhiteSpace(record.TranscriptFilePath))
        {
            return Ok(new
            {
                success = false,
                message = "Transcript is not available yet for this webinar.",
                isTranscribed = false,
                data = (object?)null
            });
        }

        var (success, content) = await _transcriptionService.ReadTranscriptContentAsync(record.TranscriptFilePath);

        if (!success || string.IsNullOrWhiteSpace(content))
        {
            return Ok(new
            {
                success = false,
                message = "Could not read transcript content from storage.",
                isTranscribed = false,
                data = (object?)null
            });
        }

        record.TranscriptContent = content;

        return Ok(new
        {
            success = true,
            isTranscribed = true,
            data = record
        });
    }
}
