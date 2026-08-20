using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;
using Google.Apis.Auth;
using WebinarApi.Models;

namespace WebinarApi.Services
{
    public interface IAuthService
    {
        Task<(bool success, string message, UserDto user, string token)> RegisterAsync(RegisterRequest request);
        Task<(bool success, string message, UserDto user, string token)> LoginAsync(LoginRequest request);
        Task<(bool success, string message, UserDto user, string token)> GoogleLoginAsync(GoogleTokenRequest request);
    }

    public class AuthService : IAuthService
    {
        private readonly IConfiguration _config;
        private readonly string         _connectionString;
        private readonly ILogger<AuthService> _logger;

        public AuthService(IConfiguration config, ILogger<AuthService> logger)
        {
            _config           = config;
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? config["DatabaseConnectionString"]
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
        }

        // -------------------------------------------------------
        // Register a new local (email/password) user
        // -------------------------------------------------------
        public async Task<(bool success, string message, UserDto user, string token)> RegisterAsync(RegisterRequest request)
        {
            try
            {
                var email = request.Email?.Trim().ToLower();

                if (string.IsNullOrWhiteSpace(email))
                    return (false, "Email is required", null!, null!);
                if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                    return (false, "Password must be at least 6 characters", null!, null!);
                if (string.IsNullOrWhiteSpace(request.FirstName))
                    return (false, "First name is required", null!, null!);

                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                // 1. Check email — SP: wms.usp_CheckEmailExists
                var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_CheckEmailExists",
                    new { Email = email },
                    commandType: CommandType.StoredProcedure
                );

                if (existing != null)
                {
                    return existing.AuthProvider == "Local"
                        ? (false, "An account with this email already exists. Please log in.", null!, null!)
                        : (false, $"This email is already registered with {existing.AuthProvider}.", null!, null!);
                }

                // 2. Hash password — BCrypt done in C#, never in SQL
                var hash = BCrypt.Net.BCrypt.HashPassword(request.Password);

                // 3. Insert + return user — SP: wms.usp_RegisterLocalUser
                var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_RegisterLocalUser",
                    new
                    {
                        FirstName    = request.FirstName.Trim(),
                        LastName     = request.LastName?.Trim() ?? "",
                        Email        = email,
                        PasswordHash = hash,
                        RoleId       = 3,       // Student (default)
                        CountryCode  = request.CountryCode  ?? "",
                        MobileNumber = request.MobileNumber ?? ""
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (user == null)
                    return (false, "Failed to create account", null!, null!);

                var dto   = MapToUserDto(user);
                var jwtToken = GenerateJwtToken(dto);
                return (true, "Registration successful", dto, jwtToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Registration error");
                return (false, "An error occurred during registration", null!, null!);
            }
        }

        // -------------------------------------------------------
        // Authenticate with email + password
        // -------------------------------------------------------
        public async Task<(bool success, string message, UserDto user, string token)> LoginAsync(LoginRequest request)
        {
            try
            {
                var email = request.Email?.Trim().ToLower();

                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                // SP: wms.usp_LoginUser — returns user + PasswordHash + RoleName
                var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_LoginUser",
                    new { Email = email },
                    commandType: CommandType.StoredProcedure
                );

                if (user == null)
                    return (false, "Invalid email or password", null!, null!);

                if (!(bool)user.IsActive)
                    return (false, "Your account has been deactivated. Please contact support.", null!, null!);

                if ((string)user.AuthProvider != "Local")
                    return (false, $"This account was registered via {user.AuthProvider}. Please use that login method.", null!, null!);

                if (string.IsNullOrEmpty((string?)user.PasswordHash) ||
                    !BCrypt.Net.BCrypt.Verify(request.Password, (string)user.PasswordHash))
                    return (false, "Invalid email or password", null!, null!);

                var dto      = MapToUserDto(user);
                var jwtToken = GenerateJwtToken(dto);
                return (true, "Login successful", dto, jwtToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error");
                return (false, "An error occurred during login", null!, null!);
            }
        }

        // -------------------------------------------------------
        // Authenticate via Google ID token
        // -------------------------------------------------------
        public async Task<(bool success, string message, UserDto user, string token)> GoogleLoginAsync(GoogleTokenRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Token))
                    return (false, "Google token is required", null!, null!);

                // Validate Google token
                var clientId = _config["GoogleAuth:ClientId"];
                var payload  = await GoogleJsonWebSignature.ValidateAsync(
                    request.Token,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = new[] { clientId }
                    }
                );

                var googleEmail = payload.Email?.ToLower().Trim();
                var googleSub   = payload.Subject;
                var firstName   = payload.GivenName ?? payload.Name ?? "User";
                var lastName    = payload.FamilyName ?? "";

                if (string.IsNullOrEmpty(googleEmail))
                    return (false, "Google email not found", null!, null!);

                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                // 1. Find by ProviderUserId — SP: wms.usp_FindGoogleUserByProvider
                var existingGoogle = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_FindGoogleUserByProvider",
                    new { ProviderUserId = googleSub },
                    commandType: CommandType.StoredProcedure
                );

                if (existingGoogle != null)
                {
                    if (!(bool)existingGoogle.IsActive)
                        return (false, "Your account has been deactivated.", null!, null!);

                    var dto      = MapToUserDto(existingGoogle);
                    var jwtToken = GenerateJwtToken(dto);
                    return (true, "Google login successful", dto, jwtToken);
                }

                // 2. Check email conflict — SP: wms.usp_FindUserByEmail
                var emailMatch = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_FindUserByEmail",
                    new { Email = googleEmail },
                    commandType: CommandType.StoredProcedure
                );

                if (emailMatch != null)
                {
                    if ((string)emailMatch.AuthProvider == "Local")
                        return (false, "An account with this email exists. Please sign in with email and password.", null!, null!);

                    // Google account with different ProviderUserId — conflict
                    if ((string)emailMatch.ProviderUserId != googleSub)
                    {
                        _logger.LogWarning("Google provider conflict for email {Email}", googleEmail);
                        return (false, "This email is linked to a different Google account.", null!, null!);
                    }
                }

                // 3. Create new Google user — SP: wms.usp_RegisterGoogleUser
                var newUser = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_RegisterGoogleUser",
                    new { FirstName = firstName, LastName = lastName, Email = googleEmail, ProviderUserId = googleSub, RoleId = 3 },
                    commandType: CommandType.StoredProcedure
                );

                if (newUser == null)
                    return (false, "Failed to create Google account", null!, null!);

                var newDto   = MapToUserDto(newUser);
                var newToken = GenerateJwtToken(newDto);
                return (true, "Google registration successful", newDto, newToken);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Google token validation error");
                if (ex.Message.Contains("Audience"))   return (false, "Google token mismatch. Please try again.", null!, null!);
                if (ex.Message.Contains("expired", StringComparison.OrdinalIgnoreCase)) return (false, "Google token expired.", null!, null!);
                return (false, $"Google authentication failed: {ex.Message}", null!, null!);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google login error");
                return (false, $"Google authentication error: {ex.Message}", null!, null!);
            }
        }

        // -------------------------------------------------------
        // Map dynamic Dapper row → typed UserDto
        // -------------------------------------------------------
        private static UserDto MapToUserDto(dynamic u) => new UserDto
        {
            Id            = (int)u.Id,
            Email         = (string)u.Email,
            FirstName     = (string)u.FirstName,
            LastName      = (string?)u.LastName,
            AuthProvider  = (string)u.AuthProvider,
            RoleId        = (int)u.RoleId,
            RoleName      = (string)u.RoleName,
            IsActive      = (bool)u.IsActive,
            EmailVerified = (bool)u.EmailVerified,
            CountryCode   = (string?)u.CountryCode,
            MobileNumber  = (string?)u.MobileNumber
        };

        // -------------------------------------------------------
        // Generate JWT — claims include RoleId for API guards
        // -------------------------------------------------------
        private string GenerateJwtToken(UserDto user)
        {
            var jwt         = _config.GetSection("Jwt");
            var key         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Secret"]!));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email,          user.Email),
                new Claim(ClaimTypes.Name,           user.FirstName),
                new Claim("RoleId",                  user.RoleId.ToString()),
                new Claim(ClaimTypes.Role,           user.RoleName)
            };

            var tokenObj = new JwtSecurityToken(
                issuer:             jwt["Issuer"],
                audience:           jwt["Audience"],
                claims:             claims,
                expires:            DateTime.UtcNow.AddHours(double.Parse(jwt["ExpiryInHours"]!)),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(tokenObj);
        }
    }
}
