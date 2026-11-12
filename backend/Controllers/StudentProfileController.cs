using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

[ApiController]
[Route("api/student/profile")]
[Authorize]
public class StudentProfileController : ControllerBase
{
    private readonly IStudentProfileService _profileService;
    private readonly ILogger<StudentProfileController> _logger;

    public StudentProfileController(
        IStudentProfileService profileService,
        ILogger<StudentProfileController> logger)
    {
        _profileService = profileService;
        _logger = logger;
    }

    private int CallerUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var u) ? u : 0;

    /// <summary>
    /// GET /api/student/profile
    /// Retrieves authenticated student's profile details via wms.sp_GetStudentProfile
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var userId = CallerUserId;
        if (userId <= 0)
        {
            return Unauthorized(new { success = false, message = "Invalid user identification." });
        }

        try
        {
            var profile = await _profileService.GetProfileAsync(userId);
            if (profile == null)
            {
                return NotFound(new { success = false, message = "Profile not found." });
            }

            return Ok(new { success = true, data = profile });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[StudentProfileController] GetProfile failed for UserId {UserId}", userId);
            return StatusCode(500, new { success = false, message = "Failed to fetch student profile." });
        }
    }

    /// <summary>
    /// PUT /api/student/profile
    /// Updates allowed student profile fields via wms.sp_UpdateStudentProfile
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateStudentProfileRequest request)
    {
        var userId = CallerUserId;
        if (userId <= 0)
        {
            return Unauthorized(new { success = false, message = "Invalid user identification." });
        }

        if (string.IsNullOrWhiteSpace(request.FirstName))
        {
            return BadRequest(new { success = false, message = "First Name is required." });
        }

        try
        {
            var updated = await _profileService.UpdateProfileAsync(userId, request);
            return Ok(new { success = true, message = "Profile updated successfully.", data = updated });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[StudentProfileController] UpdateProfile failed for UserId {UserId}", userId);
            return StatusCode(500, new { success = false, message = "Failed to update profile." });
        }
    }

    /// <summary>
    /// POST /api/student/profile/upload-photo
    /// Uploads an avatar image, generates an 8-char unique identifier name,
    /// saves into StudentProfileImages, and updates ProfileUrl
    /// </summary>
    [HttpPost("upload-photo")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadPhoto([FromForm] IFormFile file)
    {
        var userId = CallerUserId;
        if (userId <= 0)
        {
            return Unauthorized(new { success = false, message = "Invalid user identification." });
        }

        try
        {
            var profileUrl = await _profileService.UploadProfileImageAsync(userId, file);
            return Ok(new { success = true, message = "Profile picture uploaded successfully.", profileUrl });
        }
        catch (ArgumentException aEx)
        {
            return BadRequest(new { success = false, message = aEx.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[StudentProfileController] UploadPhoto failed for UserId {UserId}", userId);
            return StatusCode(500, new { success = false, message = "Failed to upload profile picture." });
        }
    }
}

