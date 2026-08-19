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
        // Validate request
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { success = false, message = "Email and password are required." });

        var (success, message, user, token) = await _authService.RegisterAsync(request);

        if (!success)
            return BadRequest(new { success = false, message });

        return Ok(new { success = true, message, user, token });
    }

    /// <summary>
    /// Login with email/password
    /// POST /api/auth/login
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Validate request
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { success = false, message = "Email and password are required." });

        var (success, message, user, token) = await _authService.LoginAsync(request);

        if (!success)
            return Unauthorized(new { success = false, message });

        return Ok(new { success = true, message, user, token });
    }

    /// <summary>
    /// Google OAuth login/registration
    /// POST /api/auth/google
    /// </summary>
    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { success = false, message = "Google token is required." });

        var (success, message, user, token) = await _authService.GoogleLoginAsync(request);

        if (!success)
            return BadRequest(new { success = false, message });

        return Ok(new { success = true, message, user, token });
    }
}

