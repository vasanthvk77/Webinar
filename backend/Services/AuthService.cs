using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Net;
using System.Net.Mail;
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
        Task<(bool success, string message, int? remainingDailyOtps, int expiresInSeconds)> SendRegistrationOtpAsync(string email);
        Task<(bool success, string message)> VerifyRegistrationOtpAsync(string email, string otp);
    }

    public class AuthService : IAuthService
    {
        private readonly IConfiguration _config;
        private readonly string _connectionString;
        private readonly ILogger<AuthService> _logger;
        private readonly IActivityLogService _activityLog;
        private readonly IEmailService _emailService;

        public AuthService(IConfiguration config, ILogger<AuthService> logger, IActivityLogService activityLog, IEmailService emailService)
        {
            _config = config;
            _connectionString = config.GetConnectionString("DefaultConnection")
                             ?? config["DatabaseConnectionString"]
                             ?? throw new InvalidOperationException("Connection string not configured.");
            _logger = logger;
            _activityLog = activityLog;
            _emailService = emailService;
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

                // 1.5. Guard: Ensure email was verified via OTP within last 15 minutes
                var verifiedOtpId = await conn.ExecuteScalarAsync<long?>(
                    "wms.usp_CheckEmailOtpVerified",
                    new { Email = email, Purpose = (byte)1 },
                    commandType: CommandType.StoredProcedure
                );

                if (verifiedOtpId == null || verifiedOtpId == 0)
                {
                    _logger.LogWarning("[Auth] Register blocked for {Email} — email OTP not verified.", email);
                    return (false, "Please verify your email with OTP before creating an account.", null!, null!);
                }

                // 2. Hash password — BCrypt done in C#, never in SQL
                var hash = BCrypt.Net.BCrypt.HashPassword(request.Password);

                // 3. Insert + return user — SP: wms.usp_RegisterLocalUser
                var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_RegisterLocalUser",
                    new
                    {
                        FirstName = request.FirstName.Trim(),
                        LastName = request.LastName?.Trim() ?? "",
                        Email = email,
                        PasswordHash = hash,
                        RoleId = 3,       // Student (default)
                        CountryCode = request.CountryCode ?? "",
                        MobileNumber = request.MobileNumber ?? ""
                    },
                    commandType: CommandType.StoredProcedure
                );

                if (user == null)
                {
                    _logger.LogError("[Auth] Register DB insert returned null for {Email}.", email);
                    return (false, "Failed to create account", null!, null!);
                }

                var dto = MapToUserDto(user);
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
                if (string.IsNullOrEmpty((string?)user.PasswordHash))
                {
                    _logger.LogWarning("[Auth] Login failed — {Email} has no password set (registered via {Provider}).", email, authProvider);
                    return (false, $"This account was registered via {authProvider}. Please sign in with {authProvider} or reset your password.", null!, null!);
                }

                if (!BCrypt.Net.BCrypt.Verify(request.Password, (string)user.PasswordHash))
                {
                    _logger.LogWarning("[Auth] Login failed — wrong password for {Email}.", email);
                    return (false, "Invalid email or password", null!, null!);
                }

                UserDto dto = MapToUserDto(user);
                var jwtToken = GenerateJwtToken(dto);
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
                var payload = await GoogleJsonWebSignature.ValidateAsync(
                    request.Token,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = new[] { clientId }
                    }
                );

                var googleEmail = payload.Email?.ToLower().Trim();
                var googleSub = payload.Subject;
                var firstName = payload.GivenName ?? payload.Name ?? "User";
                var lastName = payload.FamilyName ?? "";

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

                    UserDto dto = MapToUserDto(existingGoogle);
                    var jwtToken = GenerateJwtToken(dto);
                    _logger.LogInformation("[Auth] Google login SUCCESS (existing user) — UserId: {UserId}, Email: {Email}",
                        dto.Id, dto.Email);
                    await _activityLog.LogActivityAsync(dto.Id, $"{dto.FirstName} {dto.LastName}".Trim(), dto.RoleId, "LOGIN", "AUTH", $"Google login successful: {dto.Email}");
                    return (true, "Google login successful", dto, jwtToken);
                }

                // 2. Check if user already exists with this email — SP: wms.usp_FindUserByEmail
                var emailMatch = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_FindUserByEmail",
                    new { Email = googleEmail },
                    commandType: CommandType.StoredProcedure
                );

                if (emailMatch != null)
                {
                    if (!(bool)emailMatch.IsActive)
                    {
                        _logger.LogWarning("[Auth] Google login blocked — account deactivated for {Email}.", googleEmail);
                        return (false, "Your account has been deactivated.", null!, null!);
                    }

                    _logger.LogInformation("[Auth] Linking Google OAuth (sub: {Sub}) to existing user: {Email}", googleSub, googleEmail);

                    var linkedUser = await conn.QueryFirstOrDefaultAsync<dynamic>(
                        "wms.usp_LinkGoogleAccount",
                        new { UserId = (int)emailMatch.Id, ProviderUserId = googleSub },
                        commandType: CommandType.StoredProcedure
                    );

                    UserDto dto      = MapToUserDto(linkedUser ?? emailMatch);
                    var     jwtToken = GenerateJwtToken(dto);
                    _logger.LogInformation("[Auth] Google login SUCCESS (account linked) — UserId: {UserId}, Email: {Email}",
                        dto.Id, dto.Email);
                    await _activityLog.LogActivityAsync(dto.Id, $"{dto.FirstName} {dto.LastName}".Trim(), dto.RoleId, "LOGIN", "AUTH", $"Google login successful (linked to existing account): {dto.Email}");
                    return (true, "Google login successful", dto, jwtToken);
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

                UserDto newDto = MapToUserDto(newUser);
                var newToken = GenerateJwtToken(newDto);
                _logger.LogInformation("[Auth] Google register SUCCESS — UserId: {UserId}, Email: {Email}",
                    newDto.Id, newDto.Email);
                await _activityLog.LogActivityAsync(newDto.Id, $"{newDto.FirstName} {newDto.LastName}".Trim(), newDto.RoleId, "CREATE", "AUTH", $"Google account registered successfully: {newDto.Email}");
                return (true, "Google registration successful", newDto, newToken);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "[Auth] Google token validation FAILED: {Message}", ex.Message);
                if (ex.Message.Contains("Audience")) return (false, "Google token mismatch. Please try again.", null!, null!);
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
        // Send OTP for Registration
        // -------------------------------------------------------
        public async Task<(bool success, string message, int? remainingDailyOtps, int expiresInSeconds)> SendRegistrationOtpAsync(string email)
        {
            email = email?.Trim().ToLower() ?? "";
            _logger.LogInformation("[Auth] SendRegistrationOtp attempt for email: {Email}", email);

            if (string.IsNullOrWhiteSpace(email))
            {
                return (false, "Email is required.", null, 0);
            }

            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                // 1. Check if user already exists
                var existing = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_CheckEmailExists",
                    new { Email = email },
                    commandType: CommandType.StoredProcedure
                );

                if (existing != null)
                {
                    string provider = (string)existing.AuthProvider;
                    return provider == "Local"
                        ? (false, "An account with this email already exists. Please log in.", null, 0)
                        : (false, $"This email is already registered with {provider}.", null, 0);
                }

                // 2. Read configuration
                int expirySeconds = _config.GetValue<int>("OtpSettings:ExpirySeconds", 60);
                int maxOtpsPerDay = _config.GetValue<int>("OtpSettings:MaxOtpsPerDay", 3);
                int resetDays = _config.GetValue<int>("OtpSettings:ResetDays", 1);

                // 3. Check daily/resetDays limit
                int dailyCount = await conn.ExecuteScalarAsync<int>(
                    "wms.usp_GetDailyOtpCount",
                    new { Email = email, Purpose = (byte)1, ResetDays = resetDays },
                    commandType: CommandType.StoredProcedure
                );

                if (dailyCount >= maxOtpsPerDay)
                {
                    _logger.LogWarning("[Auth] OTP limit ({Limit}) reached for {Email}.", maxOtpsPerDay, email);
                    return (false, $"OTP generation limit reached ({maxOtpsPerDay}/{maxOtpsPerDay}). Please try again later.", 0, 0);
                }

                // 4. Generate 6-digit OTP & SHA-256 hash
                string otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
                byte[] otpHash = SHA256.HashData(Encoding.UTF8.GetBytes(otp));

                // 5. Set expiration with a 15-second transit buffer so user gets full 60 seconds
                DateTime expiresAt = DateTime.UtcNow.AddSeconds(expirySeconds + 15);

                // 6. Store in wms.EmailOtpVerifications
                await conn.ExecuteAsync(
                    "wms.usp_SaveEmailOtp",
                    new
                    {
                        Email = email,
                        OtpHash = otpHash,
                        Purpose = (byte)1,
                        ExpiresAt = expiresAt
                    },
                    commandType: CommandType.StoredProcedure
                );

                // 7. Dispatch the OTP verification email
                try
                {
                    await _emailService.SendOtpEmailAsync(email, otp, expirySeconds);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[Auth] OTP email dispatch failed for {Email}: {Message}", email, ex.Message);
                }

                int remaining = maxOtpsPerDay - (dailyCount + 1);
                _logger.LogInformation("[Auth] OTP sent successfully to {Email}. Remaining daily OTPs: {Remaining}", email, remaining);
                return (true, "Verification code sent to your email.", remaining, expirySeconds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Auth] SendRegistrationOtp EXCEPTION for {Email}: {Message}", email, ex.Message);
                return (false, "An error occurred while sending verification code.", null, 0);
            }
        }

        // -------------------------------------------------------
        // Verify OTP for Registration
        // -------------------------------------------------------
        public async Task<(bool success, string message)> VerifyRegistrationOtpAsync(string email, string otp)
        {
            email = email?.Trim().ToLower() ?? "";
            otp = otp?.Trim() ?? "";
            _logger.LogInformation("[Auth] VerifyRegistrationOtp attempt for email: {Email}", email);

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(otp))
            {
                return (false, "Email and OTP code are required.");
            }

            try
            {
                using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();

                int maxAttempts = _config.GetValue<int>("OtpSettings:MaxAttemptsPerOtp", 2);

                var record = await conn.QueryFirstOrDefaultAsync<dynamic>(
                    "wms.usp_GetLatestEmailOtp",
                    new { Email = email, Purpose = (byte)1 },
                    commandType: CommandType.StoredProcedure
                );

                if (record == null)
                {
                    return (false, "No OTP request found for this email. Please request a new OTP.");
                }

                if ((bool)record.IsUsed)
                {
                    return (false, "This OTP has already been used. Please request a new OTP.");
                }

                int failedAttempts = (int)record.FailedAttempts;
                if (failedAttempts >= maxAttempts)
                {
                    return (false, "Maximum OTP verification attempts exceeded. Please request a new OTP.");
                }

                DateTime expiresAt = (DateTime)record.ExpiresAt;
                if (DateTime.UtcNow > expiresAt)
                {
                    return (false, "OTP has expired. Please request a new OTP.");
                }

                byte[] enteredHash = SHA256.HashData(Encoding.UTF8.GetBytes(otp));
                byte[] storedHash = (byte[])record.OtpHash;

                if (!CryptographicOperations.FixedTimeEquals(enteredHash, storedHash))
                {
                    int newFailedAttempts = await conn.ExecuteScalarAsync<int>(
                        "wms.usp_IncrementOtpFailedAttempts",
                        new { Id = (long)record.Id },
                        commandType: CommandType.StoredProcedure
                    );

                    _logger.LogWarning("[Auth] Incorrect OTP for {Email}. Failed attempts: {Count}/{Max}", email, newFailedAttempts, maxAttempts);

                    if (newFailedAttempts >= maxAttempts)
                    {
                        return (false, "Maximum OTP verification attempts exceeded. Please request a new OTP.");
                    }

                    int remainingAttempts = maxAttempts - newFailedAttempts;
                    return (false, $"Incorrect OTP. You have {remainingAttempts} attempt remaining.");
                }

                // Correct OTP -> mark as used
                await conn.ExecuteAsync(
                    "wms.usp_MarkEmailOtpUsed",
                    new { Id = (long)record.Id },
                    commandType: CommandType.StoredProcedure
                );

                _logger.LogInformation("[Auth] OTP verified successfully for {Email}", email);
                return (true, "Email verified successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Auth] VerifyRegistrationOtp EXCEPTION for {Email}: {Message}", email, ex.Message);
                return (false, "An error occurred while verifying the OTP code.");
            }
        }

        // -------------------------------------------------------
        // Map dynamic Dapper row → typed UserDto
        // -------------------------------------------------------
        private static UserDto MapToUserDto(dynamic u) => new UserDto
        {
            Id = (int)u.Id,
            Email = (string)u.Email,
            FirstName = (string)u.FirstName,
            LastName = (string?)u.LastName,
            AuthProvider = (string)u.AuthProvider,
            RoleId = (int)u.RoleId,
            RoleName = (string)u.RoleName,
            IsActive = (bool)u.IsActive,
            EmailVerified = (bool)u.EmailVerified,
            CountryCode = (string?)u.CountryCode,
            MobileNumber = (string?)u.MobileNumber
        };

        // -------------------------------------------------------
        // Generate JWT — claims include RoleId for API guards
        // -------------------------------------------------------
        private string GenerateJwtToken(UserDto user)
        {
            var jwt = _config.GetSection("Jwt");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Secret"]!));
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
                issuer: jwt["Issuer"],
                audience: jwt["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(expiryHours),
                signingCredentials: credentials
            );

            var tokenStr = new JwtSecurityTokenHandler().WriteToken(tokenObj);
            _logger.LogInformation("[Auth] JWT issued for UserId: {UserId}, Expires in {Hours}h", user.Id, expiryHours);
            return tokenStr;
        }
    }
}
