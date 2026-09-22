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
public class AuthController(
    IAuthService authService,
    IAntiforgery antiforgery,
    ICurrentUser currentUser) : ControllerBase
{
    private readonly IAuthService _authService = authService;
    private readonly IAntiforgery _antiforgery = antiforgery;
    private readonly ICurrentUser _currentUser = currentUser;

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
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError(string.Empty, error);

            return ValidationProblem();
        }

        AppendCsrfCookie();
        return Ok(result.User);
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await _authService.LoginAsync(request, ct);

        if (!result.Succeeded)
            return Problem(detail: result.Errors.FirstOrDefault(), statusCode: StatusCodes.Status401Unauthorized);

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
        var user = await _authService.GetUserByIdAsync(_currentUser.UserId, ct);

        if (user is null)
            return Unauthorized();

        AppendCsrfCookie();
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
