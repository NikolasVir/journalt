namespace JournalT.Api.Controllers;

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
            .Select(u => new UserSummaryResponse(u.Id, u.UserName!))
            .ToListAsync(ct);

        return Ok(users);
    }
}
