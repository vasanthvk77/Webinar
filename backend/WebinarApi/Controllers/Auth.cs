using Microsoft.AspNetCore.Mvc;
using WebinarApi.Models;
using WebinarApi.Services;

namespace WebinarApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// Register a new local user with email/password
    /// POST /api/auth/register
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        _logger.LogInformation("[AuthController] POST /api/auth/register — Email: {Email}", request.Email);

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            _logger.LogWarning("[AuthController] Register request rejected — missing email or password.");
            return BadRequest(new { success = false, message = "Email and password are required." });
        }

        var (success, message, user, token) = await _authService.RegisterAsync(request);

        if (!success)
        {
            _logger.LogWarning("[AuthController] Register responded 400 — {Message}", message);
            return BadRequest(new { success = false, message });
        }

        _logger.LogInformation("[AuthController] Register responded 200 — UserId: {UserId}", user?.Id);
        return Ok(new { success = true, message, user, token });
    }

    /// <summary>
    /// Login with email/password
    /// POST /api/auth/login
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        _logger.LogInformation("[AuthController] POST /api/auth/login — Email: {Email}", request.Email);

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            _logger.LogWarning("[AuthController] Login request rejected — missing email or password.");
            return BadRequest(new { success = false, message = "Email and password are required." });
        }

        var (success, message, user, token) = await _authService.LoginAsync(request);

        if (!success)
        {
            _logger.LogWarning("[AuthController] Login responded 401 — {Message}", message);
            return Unauthorized(new { success = false, message });
        }

        _logger.LogInformation("[AuthController] Login responded 200 — UserId: {UserId}, Role: {Role}", user?.Id, user?.RoleName);
        return Ok(new { success = true, message, user, token });
    }

    /// <summary>
    /// Google OAuth login/registration
    /// POST /api/auth/google
    /// </summary>
    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleTokenRequest request)
    {
        _logger.LogInformation("[AuthController] POST /api/auth/google — Google token received.");

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            _logger.LogWarning("[AuthController] Google login rejected — token is empty.");
            return BadRequest(new { success = false, message = "Google token is required." });
        }

        var (success, message, user, token) = await _authService.GoogleLoginAsync(request);

        if (!success)
        {
            _logger.LogWarning("[AuthController] Google login responded 400 — {Message}", message);
            return BadRequest(new { success = false, message });
        }

        _logger.LogInformation("[AuthController] Google login responded 200 — UserId: {UserId}", user?.Id);
        return Ok(new { success = true, message, user, token });
    }
}
