using Microsoft.IdentityModel.Tokens;
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
        private readonly string _connectionString;
        private readonly ILogger<AuthService> _logger;

        public AuthService(IConfiguration config, ILogger<AuthService> logger)
        {
            _config = config;
            _connectionString = config.GetConnectionString("DefaultConnection") ?? 
                              config["DatabaseConnectionString"];
            _logger = logger;
        }

        /// <summary>
        /// Register a new local user with email and password
        /// </summary>
        public async Task<(bool success, string message, UserDto user, string token)> RegisterAsync(RegisterRequest request)
        {
            try
            {
                // Normalize email
                var normalizedEmail = request.Email.Trim().ToLower();

                // Validate input
                if (string.IsNullOrWhiteSpace(request.Email))
                    return (false, "Email is required", null, null);

                if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                    return (false, "Password must be at least 6 characters", null, null);

                if (string.IsNullOrWhiteSpace(request.FirstName))
                    return (false, "First name is required", null, null);

                // Check if email already exists
                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    const string checkEmailQuery = "SELECT TOP 1 Id, AuthProvider FROM wms.Users WHERE Email = @Email";
                    var existingUser = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        checkEmailQuery,
                        new { Email = normalizedEmail }
                    );

                    if (existingUser != null)
                    {
                        if (existingUser.AuthProvider == "Local")
                            return (false, "An account with this email already exists. Please log in with your email and password.", null, null);
                        else
                            return (false, $"This email is already registered with {existingUser.AuthProvider}. Please continue with {existingUser.AuthProvider}.", null, null);
                    }

                    // Hash the password using bcrypt
                    var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

                    // Get default role (3 = User)
                    int defaultRoleId = 3;

                    // Create new user
                    const string insertQuery = @"
                        INSERT INTO wms.Users (FirstName, LastName, Email, PasswordHash, AuthProvider, ProviderUserId, RoleId, IsActive, EmailVerified, CountryCode, MobileNumber, CreatedAt)
                        VALUES (@FirstName, @LastName, @Email, @PasswordHash, @AuthProvider, NULL, @RoleId, 1, 0, @CountryCode, @MobileNumber, GETUTCDATE());
                        SELECT CAST(SCOPE_IDENTITY() as int);";

                    var userId = await connection.QuerySingleAsync<int>(
                        insertQuery,
                        new
                        {
                            FirstName = request.FirstName,
                            LastName = request.LastName ?? "",
                            Email = normalizedEmail,
                            PasswordHash = passwordHash,
                            AuthProvider = "Local",
                            RoleId = defaultRoleId,
                            CountryCode = request.CountryCode ?? "",
                            MobileNumber = request.MobileNumber ?? ""
                        }
                    );

                    // Retrieve the created user
                    const string selectQuery = @"
                        SELECT u.Id, u.FirstName, u.LastName, u.Email, u.AuthProvider, u.RoleId, u.IsActive, u.EmailVerified, u.CountryCode, u.MobileNumber, r.Name AS RoleName
                        FROM wms.Users u
                        JOIN wms.Roles r ON r.Id = u.RoleId
                        WHERE u.Id = @UserId";

                    var user = await connection.QueryFirstOrDefaultAsync<dynamic>(selectQuery, new { UserId = userId });

                    if (user == null)
                        return (false, "Failed to create user", null, null);

                    var userDto = new UserDto
                    {
                        Id = user.Id,
                        Email = user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        AuthProvider = user.AuthProvider,
                        RoleId = user.RoleId,
                        RoleName = user.RoleName,
                        IsActive = user.IsActive,
                        EmailVerified = user.EmailVerified,
                        CountryCode = user.CountryCode,
                        MobileNumber = user.MobileNumber
                    };

                    var token = GenerateJwtToken(userDto);

                    return (true, "Registration successful", userDto, token);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Registration error: {ex.Message}");
                return (false, "An error occurred during registration", null, null);
            }
        }

        /// <summary>
        /// Authenticate user with email and password
        /// </summary>
        public async Task<(bool success, string message, UserDto user, string token)> LoginAsync(LoginRequest request)
        {
            try
            {
                // Normalize email
                var normalizedEmail = request.Email.Trim().ToLower();

                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    // Find user by email
                    const string selectQuery = @"
                        SELECT u.Id, u.FirstName, u.LastName, u.Email, u.PasswordHash, u.AuthProvider, u.RoleId, u.IsActive, u.EmailVerified, u.CountryCode, u.MobileNumber, r.Name AS RoleName
                        FROM wms.Users u
                        JOIN wms.Roles r ON r.Id = u.RoleId
                        WHERE u.Email = @Email";

                    var user = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        selectQuery,
                        new { Email = normalizedEmail }
                    );

                    if (user == null)
                        return (false, "Invalid email or password", null, null);

                    // Check if account is active
                    if (!user.IsActive)
                        return (false, "Your account has been deactivated. Please contact support.", null, null);

                    // Check auth provider
                    if (user.AuthProvider != "Local")
                        return (false, $"This account was registered using {user.AuthProvider}. Please continue with {user.AuthProvider}.", null, null);

                    // Verify password using bcrypt
                    if (string.IsNullOrEmpty(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                        return (false, "Invalid email or password", null, null);

                    var userDto = new UserDto
                    {
                        Id = user.Id,
                        Email = user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        AuthProvider = user.AuthProvider,
                        RoleId = user.RoleId,
                        RoleName = user.RoleName,
                        IsActive = user.IsActive,
                        EmailVerified = user.EmailVerified,
                        CountryCode = user.CountryCode,
                        MobileNumber = user.MobileNumber
                    };

                    var token = GenerateJwtToken(userDto);

                    return (true, "Login successful", userDto, token);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Login error: {ex.Message}");
                return (false, "An error occurred during login", null, null);
            }
        }

        /// <summary>
        /// Authenticate user with Google ID token
        /// </summary>
        public async Task<(bool success, string message, UserDto user, string token)> GoogleLoginAsync(GoogleTokenRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Token))
                    return (false, "Google token is required", null, null);

                // Validate Google token
                var googleSettings = _config.GetSection("GoogleAuth");
                var clientId = googleSettings["ClientId"];

                var settings = new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new List<string> { clientId }
                };
                var payload = await GoogleJsonWebSignature.ValidateAsync(request.Token, settings);

                // Extract user information
                var googleEmail = payload.Email?.ToLower().Trim();
                var googleSubId = payload.Subject; // Google's unique user ID
                var firstName = payload.GivenName ?? payload.Name ?? "User";
                var lastName = payload.FamilyName ?? "";

                if (string.IsNullOrEmpty(googleEmail))
                    return (false, "Google email not found in token", null, null);

                using (var connection = new SqlConnection(_connectionString))
                {
                    await connection.OpenAsync();

                    // First, try to find existing Google user by ProviderUserId
                    const string findGoogleUserQuery = @"
                        SELECT u.Id, u.FirstName, u.LastName, u.Email, u.AuthProvider, u.RoleId, u.IsActive, u.EmailVerified, u.CountryCode, u.MobileNumber, r.Name AS RoleName
                        FROM wms.Users u
                        JOIN wms.Roles r ON r.Id = u.RoleId
                        WHERE u.AuthProvider = 'Google' AND u.ProviderUserId = @ProviderUserId";

                    var existingGoogleUser = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        findGoogleUserQuery,
                        new { ProviderUserId = googleSubId }
                    );

                    if (existingGoogleUser != null)
                    {
                        // Verify account is active
                        if (!existingGoogleUser.IsActive)
                            return (false, "Your account has been deactivated. Please contact support.", null, null);

                        var userDto = new UserDto
                        {
                            Id = existingGoogleUser.Id,
                            Email = existingGoogleUser.Email,
                            FirstName = existingGoogleUser.FirstName,
                            LastName = existingGoogleUser.LastName,
                            AuthProvider = existingGoogleUser.AuthProvider,
                            RoleId = existingGoogleUser.RoleId,
                            RoleName = existingGoogleUser.RoleName,
                            IsActive = existingGoogleUser.IsActive,
                            EmailVerified = existingGoogleUser.EmailVerified,
                            CountryCode = existingGoogleUser.CountryCode,
                            MobileNumber = existingGoogleUser.MobileNumber
                        };

                        var token = GenerateJwtToken(userDto);
                        return (true, "Google login successful", userDto, token);
                    }

                    // Google user doesn't exist, check if email exists as Local account
                    const string findLocalUserQuery = @"
                        SELECT u.Id, u.FirstName, u.LastName, u.Email, u.AuthProvider, u.RoleId, u.IsActive, u.EmailVerified, u.CountryCode, u.MobileNumber, r.Name AS RoleName
                        FROM wms.Users u
                        JOIN wms.Roles r ON r.Id = u.RoleId
                        WHERE u.Email = @Email";

                    var existingLocalUser = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        findLocalUserQuery,
                        new { Email = googleEmail }
                    );

                    if (existingLocalUser != null)
                    {
                        return (false, "An account with this email already exists using email/password. Please sign in with your email and password.", null, null);
                    }

                    // Check if email exists as Google account with different ProviderUserId (conflict)
                    const string findGoogleEmailConflictQuery = @"
                        SELECT u.Id, u.FirstName, u.LastName, u.Email, u.AuthProvider, u.ProviderUserId, u.RoleId, u.IsActive, u.EmailVerified, u.CountryCode, u.MobileNumber, r.Name AS RoleName
                        FROM wms.Users u
                        JOIN wms.Roles r ON r.Id = u.RoleId
                        WHERE u.Email = @Email AND u.AuthProvider = 'Google'";

                    var emailConflict = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        findGoogleEmailConflictQuery,
                        new { Email = googleEmail }
                    );

                    if (emailConflict != null && emailConflict.ProviderUserId != googleSubId)
                    {
                        _logger.LogWarning($"Google provider conflict: Email {googleEmail} exists with different ProviderUserId");
                        return (false, "This email is associated with a different Google account. Please use the correct Google account.", null, null);
                    }

                    // Email doesn't exist - create new Google user
                    int defaultRoleId = 3; // User role

                    const string createGoogleUserQuery = @"
                        INSERT INTO wms.Users (FirstName, LastName, Email, PasswordHash, AuthProvider, ProviderUserId, RoleId, IsActive, EmailVerified, CountryCode, MobileNumber, CreatedAt)
                        VALUES (@FirstName, @LastName, @Email, NULL, 'Google', @ProviderUserId, @RoleId, 1, 1, NULL, NULL, GETUTCDATE());
                        SELECT CAST(SCOPE_IDENTITY() as int);";

                    var newUserId = await connection.QuerySingleAsync<int>(
                        createGoogleUserQuery,
                        new
                        {
                            FirstName = firstName,
                            LastName = lastName,
                            Email = googleEmail,
                            ProviderUserId = googleSubId,
                            RoleId = defaultRoleId
                        }
                    );

                    // Retrieve the newly created user
                    const string selectNewUserQuery = @"
                        SELECT u.Id, u.FirstName, u.LastName, u.Email, u.AuthProvider, u.RoleId, u.IsActive, u.EmailVerified, u.CountryCode, u.MobileNumber, r.Name AS RoleName
                        FROM wms.Users u
                        JOIN wms.Roles r ON r.Id = u.RoleId
                        WHERE u.Id = @UserId";

                    var newUser = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        selectNewUserQuery,
                        new { UserId = newUserId }
                    );

                    if (newUser == null)
                        return (false, "Failed to create user account", null, null);

                    var newUserDto = new UserDto
                    {
                        Id = newUser.Id,
                        Email = newUser.Email,
                        FirstName = newUser.FirstName,
                        LastName = newUser.LastName,
                        AuthProvider = newUser.AuthProvider,
                        RoleId = newUser.RoleId,
                        RoleName = newUser.RoleName,
                        IsActive = newUser.IsActive,
                        EmailVerified = newUser.EmailVerified,
                        CountryCode = newUser.CountryCode,
                        MobileNumber = newUser.MobileNumber
                    };

                    var newToken = GenerateJwtToken(newUserDto);
                    return (true, "Google registration successful", newUserDto, newToken);
                }
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError($"Google token validation error: {ex.Message}");
                
                // Provide specific error messages based on the exception
                if (ex.Message.Contains("Audience"))
                    return (false, "Google token does not match this application. Please try again with the correct Google account.", null, null);
                if (ex.Message.Contains("signature", StringComparison.OrdinalIgnoreCase))
                    return (false, "Google token signature is invalid. Please try logging in again.", null, null);
                if (ex.Message.Contains("expired", StringComparison.OrdinalIgnoreCase))
                    return (false, "Google token has expired. Please try logging in again.", null, null);
                
                return (false, $"Google authentication failed: {ex.Message}", null, null);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Google login error: {ex.Message}");
                return (false, $"Google authentication error: {ex.Message}", null, null);
            }
        }

        /// <summary>
        /// Generate JWT token for authenticated user
        /// </summary>
        private string GenerateJwtToken(UserDto user)
        {
            var jwtSettings = _config.GetSection("Jwt");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Secret"]));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Name, user.FirstName),
                new Claim("RoleId", user.RoleId.ToString()),
                new Claim(ClaimTypes.Role, user.RoleName)
            };

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(int.Parse(jwtSettings["ExpiryInHours"])),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
