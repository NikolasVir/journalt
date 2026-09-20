namespace JournalT.Api.Controllers;

using System.Security.Claims;
using JournalT.Application.Auth.DTOs;
using JournalT.Application.Common.Interfaces;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, IAntiforgery antiforgery) : ControllerBase
{
    private readonly IAuthService _authService = authService;
    private readonly IAntiforgery _antiforgery = antiforgery;

    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult GetCsrfToken()
    {
        var token = AppendCsrfCookie();
        return Ok(new { token });
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        if (!_authService.RegistrationEnabled)
            return Forbid();

        var result = await _authService.RegisterAsync(request, ct);

        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        AppendCsrfCookie();
        return Ok(result.User);
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await _authService.LoginAsync(request, ct);

        if (!result.Succeeded)
            return Unauthorized(new { errors = result.Errors });

        AppendCsrfCookie();
        return Ok(result.User);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _authService.LogoutAsync();
        Response.Cookies.Delete("XSRF-TOKEN");
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (claim is null || !Guid.TryParse(claim, out var userId))
            return Unauthorized();

        var user = await _authService.GetUserByIdAsync(userId, ct);

        if (user is null)
            return Unauthorized();

        return Ok(user);
    }

    private string AppendCsrfCookie()
    {
        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);

        Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            SameSite = SameSiteMode.Strict,
            Secure = HttpContext.Request.IsHttps,
            Path = "/"
        });

        Response.Headers["X-XSRF-TOKEN"] = tokens.RequestToken!;
        return tokens.RequestToken!;
    }
}
