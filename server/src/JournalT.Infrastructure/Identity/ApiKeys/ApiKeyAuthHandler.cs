namespace JournalT.Infrastructure.Identity.ApiKeys;

using System.Security.Claims;
using System.Text.Encodings.Web;
using JournalT.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

public class ApiKeyAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    JournalTDbContext db,
    IServiceScopeFactory scopeFactory)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    private readonly JournalTDbContext _db = db;
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Api-Key", out var keyValues))
            return AuthenticateResult.NoResult(); // Let cookie scheme try next

        var plaintext = keyValues.ToString();
        if (string.IsNullOrWhiteSpace(plaintext))
            return AuthenticateResult.NoResult();

        var hash = ApiKeyService.ComputeHash(plaintext);
        var now = DateTime.UtcNow;

        var apiKey = await _db.ApiKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(k =>
                k.KeyHash == hash &&
                !k.IsRevoked &&
                (k.ExpiresAtUtc == null || k.ExpiresAtUtc > now));

        if (apiKey is null)
            return AuthenticateResult.Fail("Invalid API key.");

        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == apiKey.UserId);

        if (user is null || !user.IsActive)
            return AuthenticateResult.Fail("User not found or inactive.");

        // Non-critical bookkeeping — does not block the request
        var keyId = apiKey.Id;
        _ = Task.Run(async () =>
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var scopedDb = scope.ServiceProvider.GetRequiredService<JournalTDbContext>();
            await scopedDb.ApiKeys
                .Where(k => k.Id == keyId)
                .ExecuteUpdateAsync(s => s.SetProperty(k => k.LastUsedAtUtc, DateTime.UtcNow));
        });

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.UserName!),
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }
}
