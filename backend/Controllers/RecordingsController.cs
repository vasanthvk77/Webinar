using System.Data;
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

    // -------------------------------------------------------
    // GET /api/recordings
    // Returns all webinars where TranscriptStatus == 'COMPLETED' AND IsTranscribed == 1,
    // with WebinarName and full transcript text for student & admin view
    // -------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> GetCompletedTranscripts()
    {
        _logger.LogInformation("[RecordingsController] GET /api/recordings (Completed Transcripts)");
        using var conn = new SqlConnection(_connectionString);

        var list = (await conn.QueryAsync<WebinarRecordingListItemDto>(
            "wms.usp_GetCompletedTranscripts",
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
        _logger.LogInformation("[RecordingsController] GET /api/recordings/{WebinarId}/transcript", webinarId);

        using var conn = new SqlConnection(_connectionString);

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
