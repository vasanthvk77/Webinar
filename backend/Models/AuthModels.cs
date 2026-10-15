namespace WebinarApi.Models;

// -------------------------------------------------------
// Represents a row from wms.Users table
// Used internally by the API (never sent to the client)
// -------------------------------------------------------
public class User
{
    public int    Id             { get; set; }
    public string FirstName      { get; set; } = string.Empty;
    public string? LastName      { get; set; }
    public string Email          { get; set; } = string.Empty;
    public string? PasswordHash  { get; set; }
    public string AuthProvider   { get; set; } = "Local";
    public string? ProviderUserId { get; set; }
    public int    RoleId         { get; set; }
    public bool   IsActive       { get; set; }
    public bool   EmailVerified  { get; set; }
    public string? CountryCode   { get; set; }
    public string? MobileNumber  { get; set; }
}

// -------------------------------------------------------
// What the client sends when logging in
// -------------------------------------------------------
public class LoginRequest
{
    public string Email    { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

// -------------------------------------------------------
// What the client sends when registering
// -------------------------------------------------------
public class RegisterRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string CountryCode { get; set; } = string.Empty;
    public string MobileNumber { get; set; } = string.Empty;
}

// -------------------------------------------------------
// What the client sends for Google authentication
// -------------------------------------------------------
public class GoogleTokenRequest
{
    public string Token { get; set; } = string.Empty;
}

// -------------------------------------------------------
// What the API returns after successful authentication
// -------------------------------------------------------
public class LoginResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public UserDto User { get; set; }
}

// -------------------------------------------------------
// User data sent to client
// -------------------------------------------------------
public class UserDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string? LastName { get; set; }
    public string AuthProvider { get; set; } = "Local";
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool EmailVerified { get; set; }
    public string? CountryCode { get; set; }
    public string? MobileNumber { get; set; }
}

// -------------------------------------------------------
// Google ID Token Claims (decoded JWT payload)
// -------------------------------------------------------
public class GoogleTokenClaims
{
    public string iss { get; set; } = string.Empty;         // Issuer
    public string sub { get; set; } = string.Empty;         // Subject (Google user ID)
    public string aud { get; set; } = string.Empty;         // Audience (Client ID)
    public long iat { get; set; }                           // Issued at (Unix timestamp)
    public long exp { get; set; }                           // Expiration (Unix timestamp)
    public string email { get; set; } = string.Empty;
    public bool email_verified { get; set; }
    public string name { get; set; } = string.Empty;
    public string given_name { get; set; } = string.Empty;
    public string family_name { get; set; } = string.Empty;
    public string picture { get; set; } = string.Empty;
}
