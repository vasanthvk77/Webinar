using WebinarApi.Models;

namespace WebinarApi.Services;

public interface IStudentProfileService
{
    Task<StudentProfileDto?> GetProfileAsync(int userId);
    Task<StudentProfileDto?> UpdateProfileAsync(int userId, UpdateStudentProfileRequest request);
    Task<string> UploadProfileImageAsync(int userId, IFormFile file);
}

