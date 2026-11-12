namespace WebinarApi.Models;

public enum GenderType : byte
{
    Male = 1,
    Female = 2,
    Others = 3
}

public class StudentProfileDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string? LastName { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? MobileNumber { get; set; }
    public string? CountryCode { get; set; }
    public string CountryName { get; set; } = string.Empty;
    public byte? Gender { get; set; }
    public string GenderName { get; set; } = string.Empty;
    public string? ProfileUrl { get; set; }
    public string? RoleName { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UpdateStudentProfileRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string? LastName { get; set; }
    public string? MobileNumber { get; set; }
    public string? CountryCode { get; set; }
    public byte? Gender { get; set; }
    public string? ProfileUrl { get; set; }
}

