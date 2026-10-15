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
        private readonly IActivityLogService  _activityLog;

        public AuthService(IConfiguration config, ILogger<AuthService> logger, IActivityLogService activityLog)
        {
            _config           = config;
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? config["DatabaseConnectionString"]
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
            _activityLog = activityLog;
        }

        // -------------------------------------------------------
        // Register a new local (email/password) user
        // -------------------------------------------------------
        public async Task<(bool success, string message, UserDto user, string token)> RegisterAsync(RegisterRequest request)
        {
            var email = request.Email?.Trim().ToLower();
            _logger.LogInformation("[Auth] Register attempt for email: {Email}", email);
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                {
                    _logger.LogWarning("[Auth] Register failed — email is empty.");
                    return (false, "Email is required", null!, null!);
                }
                if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                {
                    _logger.LogWarning("[Auth] Register failed for {Email} — password too short.", email);
                    return (false, "Password must be at least 6 characters", null!, null!);
                }
                if (string.IsNullOrWhiteSpace(request.FirstName))
                {
                    _logger.LogWarning("[Auth] Register failed for {Email} — first name missing.", email);
                    return (false, "First name is required", null!, null!);
                }

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
                    string provider = (string)existing.AuthProvider;
                    _logger.LogWarning("[Auth] Register blocked for {Email} — already registered via {Provider}.", email, provider);
                    return provider == "Local"
                        ? (false, "An account with this email already exists. Please log in.", null!, null!)
                        : (false, $"This email is already registered with {provider}.", null!, null!);
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
                {
                    _logger.LogError("[Auth] Register DB insert returned null for {Email}.", email);
                    return (false, "Failed to create account", null!, null!);
                }

                var dto      = MapToUserDto(user);
                var jwtToken = GenerateJwtToken(dto);
                _logger.LogInformation("[Auth] Register SUCCESS — UserId: {UserId}, Email: {Email}, Role: {Role}",
                    (int)user.Id, (string)user.Email, (string)user.RoleName);
                await _activityLog.LogActivityAsync(dto.Id, $"{dto.FirstName} {dto.LastName}".Trim(), dto.RoleId, "CREATE", "AUTH", $"Local account registered successfully: {dto.Email}");
                return (true, "Registration successful", dto, jwtToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Auth] Register EXCEPTION for {Email}: {Message}", email, ex.Message);
                return (false, "An error occurred during registration", null!, null!);
            }
        }

        // -------------------------------------------------------
        // Authenticate with email + password
        // -------------------------------------------------------
        public async Task<(bool success, string message, UserDto user, string token)> LoginAsync(LoginRequest request)
        {
            var email = request.Email?.Trim().ToLower();
            _logger.LogInformation("[Auth] Login attempt for email: {Email}", email);
            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                // SP: wms.usp_LoginUser — returns user + PasswordHash + RoleName
                var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_LoginUser",
                    new { Email = email },
                    commandType: CommandType.StoredProcedure
                );

                if (user == null)
                {
                    _logger.LogWarning("[Auth] Login failed — no user found for {Email}.", email);
                    return (false, "Invalid email or password", null!, null!);
                }

                if (!(bool)user.IsActive)
                {
                    _logger.LogWarning("[Auth] Login blocked — account deactivated for {Email}.", email);
                    return (false, "Your account has been deactivated. Please contact support.", null!, null!);
                }

                string authProvider = (string)user.AuthProvider;
                if (authProvider != "Local")
                {
                    _logger.LogWarning("[Auth] Login failed — {Email} is a {Provider} account, not Local.", email, authProvider);
                    return (false, $"This account was registered via {authProvider}. Please use that login method.", null!, null!);
                }

                if (string.IsNullOrEmpty((string?)user.PasswordHash) ||
                    !BCrypt.Net.BCrypt.Verify(request.Password, (string)user.PasswordHash))
                {
                    _logger.LogWarning("[Auth] Login failed — wrong password for {Email}.", email);
                    return (false, "Invalid email or password", null!, null!);
                }

                UserDto dto      = MapToUserDto(user);
                var     jwtToken = GenerateJwtToken(dto);
                _logger.LogInformation("[Auth] Login SUCCESS — UserId: {UserId}, Email: {Email}, Role: {Role}",
                    dto.Id, dto.Email, dto.RoleName);
                await _activityLog.LogActivityAsync(dto.Id, $"{dto.FirstName} {dto.LastName}".Trim(), dto.RoleId, "LOGIN", "AUTH", $"User logged in: {dto.Email}");
                return (true, "Login successful", dto, jwtToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Auth] Login EXCEPTION for {Email}: {Message}", email, ex.Message);
                return (false, "An error occurred during login", null!, null!);
            }
        }

        // -------------------------------------------------------
        // Authenticate via Google ID token
        // -------------------------------------------------------
        public async Task<(bool success, string message, UserDto user, string token)> GoogleLoginAsync(GoogleTokenRequest request)
        {
            _logger.LogInformation("[Auth] Google login attempt received.");
            try
            {
                if (string.IsNullOrEmpty(request.Token))
                {
                    _logger.LogWarning("[Auth] Google login failed — token is empty.");
                    return (false, "Google token is required", null!, null!);
                }

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

                _logger.LogInformation("[Auth] Google token validated for email: {Email}", googleEmail);

                if (string.IsNullOrEmpty(googleEmail))
                {
                    _logger.LogWarning("[Auth] Google login failed — email missing from token payload.");
                    return (false, "Google email not found", null!, null!);
                }

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
                    {
                        _logger.LogWarning("[Auth] Google login blocked — account deactivated for {Email}.", googleEmail);
                        return (false, "Your account has been deactivated.", null!, null!);
                    }

                    UserDto dto      = MapToUserDto(existingGoogle);
                    var     jwtToken = GenerateJwtToken(dto);
                    _logger.LogInformation("[Auth] Google login SUCCESS (existing user) — UserId: {UserId}, Email: {Email}",
                        dto.Id, dto.Email);
                    await _activityLog.LogActivityAsync(dto.Id, $"{dto.FirstName} {dto.LastName}".Trim(), dto.RoleId, "LOGIN", "AUTH", $"Google login successful: {dto.Email}");
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
                    string matchProvider = (string)emailMatch.AuthProvider;
                    if (matchProvider == "Local")
                    {
                        _logger.LogWarning("[Auth] Google login blocked — {Email} has a Local account.", googleEmail);
                        return (false, "An account with this email exists. Please sign in with email and password.", null!, null!);
                    }

                    if ((string)emailMatch.ProviderUserId != googleSub)
                    {
                        _logger.LogWarning("[Auth] Google provider conflict for email {Email} — ProviderUserId mismatch.", googleEmail);
                        return (false, "This email is linked to a different Google account.", null!, null!);
                    }
                }

                // 3. Create new Google user — SP: wms.usp_RegisterGoogleUser
                _logger.LogInformation("[Auth] Registering new Google user: {Email}", googleEmail);
                var newUser = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_RegisterGoogleUser",
                    new { FirstName = firstName, LastName = lastName, Email = googleEmail, ProviderUserId = googleSub, RoleId = 3 },
                    commandType: CommandType.StoredProcedure
                );

                if (newUser == null)
                {
                    _logger.LogError("[Auth] Google register DB insert returned null for {Email}.", googleEmail);
                    return (false, "Failed to create Google account", null!, null!);
                }

                UserDto newDto   = MapToUserDto(newUser);
                var     newToken = GenerateJwtToken(newDto);
                _logger.LogInformation("[Auth] Google register SUCCESS — UserId: {UserId}, Email: {Email}",
                    newDto.Id, newDto.Email);
                await _activityLog.LogActivityAsync(newDto.Id, $"{newDto.FirstName} {newDto.LastName}".Trim(), newDto.RoleId, "CREATE", "AUTH", $"Google account registered successfully: {newDto.Email}");
                return (true, "Google registration successful", newDto, newToken);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "[Auth] Google token validation FAILED: {Message}", ex.Message);
                if (ex.Message.Contains("Audience"))   return (false, "Google token mismatch. Please try again.", null!, null!);
                if (ex.Message.Contains("expired", StringComparison.OrdinalIgnoreCase)) return (false, "Google token expired.", null!, null!);
                return (false, $"Google authentication failed: {ex.Message}", null!, null!);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Auth] Google login EXCEPTION: {Message}", ex.Message);
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

            var expiryHours = double.Parse(jwt["ExpiryInHours"]!);
            var tokenObj = new JwtSecurityToken(
                issuer:             jwt["Issuer"],
                audience:           jwt["Audience"],
                claims:             claims,
                expires:            DateTime.UtcNow.AddHours(expiryHours),
                signingCredentials: credentials
            );

            var tokenStr = new JwtSecurityTokenHandler().WriteToken(tokenObj);
            _logger.LogInformation("[Auth] JWT issued for UserId: {UserId}, Expires in {Hours}h", user.Id, expiryHours);
            return tokenStr;
        }
    }
}
