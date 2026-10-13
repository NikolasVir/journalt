namespace JournalT.Api.Controllers;

using System.Text.RegularExpressions;
using JournalT.Application.Auth.DTOs;
using JournalT.Application.Common.Interfaces;
using JournalT.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(JournalTDbContext db, ICurrentUser currentUser) : ControllerBase
{
    private readonly JournalTDbContext _db = db;
    private readonly ICurrentUser _currentUser = currentUser;

    [HttpGet]
    public async Task<IActionResult> ListUsers([FromQuery] string? search, CancellationToken ct)
    {
        var currentUserId = _currentUser.UserId;
        var query = _db.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.Id != currentUserId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(u => EF.Functions.Like(u.UserName, $"%{s}%"));
        }

        var users = await query
            .OrderBy(u => u.UserName)
            .Take(50)
            .Select(u => new UserSummaryResponse(u.Id, u.UserName!, u.AvatarUrl))
            .ToListAsync(ct);

        return Ok(users);
    }

    [HttpPut("me/avatar")]
    public async Task<IActionResult> UpdateAvatar([FromBody] UpdateAvatarRequest request, CancellationToken ct)
    {
        var currentUserId = _currentUser.UserId;
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == currentUserId, ct);
        if (user is null || !user.IsActive)
            return Unauthorized();

        if (!string.IsNullOrWhiteSpace(request.AvatarUrl))
        {
            var url = request.AvatarUrl.Trim();
            var isDataUri = url.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase);
            var isHttpUri = Uri.TryCreate(url, UriKind.Absolute, out var parsed) &&
                            (parsed.Scheme == Uri.UriSchemeHttp || parsed.Scheme == Uri.UriSchemeHttps);
            if (!isDataUri && !isHttpUri)
                return BadRequest(new { message = "Invalid avatar URL. Must be an http/https URL or data:image URI." });

            user.AvatarUrl = url;
        }
        else
        {
            user.AvatarUrl = null;
        }

        user.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new UserResponse(user.Id, user.UserName!, user.AvatarUrl, user.AccentColor));
    }

    [HttpPut("me/accent")]
    public async Task<IActionResult> UpdateAccent([FromBody] UpdateAccentRequest request, CancellationToken ct)
    {
        var currentUserId = _currentUser.UserId;
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == currentUserId, ct);
        if (user is null || !user.IsActive)
            return Unauthorized();

        var color = request.AccentColor?.Trim();
        if (string.IsNullOrWhiteSpace(color))
        {
            user.AccentColor = null;
        }
        else
        {
            if (!Regex.IsMatch(color, "^#[0-9a-fA-F]{6}$"))
                return BadRequest(new { message = "Invalid accent color. Must be a #rrggbb hex value." });

            user.AccentColor = color.ToLowerInvariant();
        }

        user.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new UserResponse(user.Id, user.UserName!, user.AvatarUrl, user.AccentColor));
    }
}
