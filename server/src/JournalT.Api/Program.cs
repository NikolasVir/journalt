using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using JournalT.Api.Antiforgery;
using JournalT.Api.Extensions;
using JournalT.Application.Common.Interfaces;
using JournalT.Infrastructure;
using JournalT.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Suppress Kestrel server header
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
});

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
builder.Services.AddSignalR();
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidateCookieAntiforgeryFilter>();
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// Rate limiting for public and sensitive endpoints
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("AuthRateLimit", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });
});

// Antiforgery / CSRF protection for cookie-authenticated clients (e.g. Angular)
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = ".JournalT.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsProduction()
        ? CookieSecurePolicy.Always
        : CookieSecurePolicy.SameAsRequest;
});

// Add Infrastructure (SQLite DbContext, Identity, etc.)
builder.Services.AddInfrastructure(builder.Configuration);

// Current user abstraction — resolved from HttpContext claims in the API layer
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpContextCurrentUser>();

// Dual-scheme authorization: cookie or API key
// - DefaultPolicy: applies to [Authorize] without arguments
// - FallbackPolicy: applies to all endpoints with no auth attribute (deny-by-default)
var dualSchemePolicy = new AuthorizationPolicyBuilder(
        IdentityConstants.ApplicationScheme, "ApiKey")
    .RequireAuthenticatedUser()
    .Build();

builder.Services.AddAuthorizationBuilder()
    .SetDefaultPolicy(dualSchemePolicy)
    .SetFallbackPolicy(dualSchemePolicy);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

// Configure forwarded headers for reverse proxies (Nginx, Traefik, Caddy, Cloudflare)
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Security headers
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "SAMEORIGIN");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    await next();
});

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
}

// Auto-apply SQLite migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<JournalTDbContext>();
    db.Database.Migrate();
}

app.UseHttpsRedirection();

// Serve static files for Angular client with cache headers on immutable assets
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var fileName = ctx.File.Name;
        if (fileName.EndsWith(".js") || fileName.EndsWith(".css") || fileName.EndsWith(".woff2") || fileName.EndsWith(".png") || fileName.EndsWith(".svg"))
        {
            ctx.Context.Response.Headers.Append("Cache-Control", "public, max-age=31536000, immutable");
        }
    }
});

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapHub<JournalT.Api.Hubs.CollaborationHub>("/hubs/collaboration");
app.MapControllers();

// Database snapshot / backup endpoint
app.MapPost("/api/maintenance/backup", async (JournalTDbContext db, IConfiguration config, ICurrentUser currentUser) =>
{
    var customPath = config["Backup:StoragePath"];
    string backupDir;
    if (!string.IsNullOrWhiteSpace(customPath))
    {
        backupDir = customPath;
    }
    else
    {
        var dbPath = db.Database.GetDbConnection().DataSource;
        var dbDir = Path.GetDirectoryName(dbPath);
        backupDir = Path.Combine(string.IsNullOrEmpty(dbDir) ? AppContext.BaseDirectory : dbDir, "backups");
    }

    Directory.CreateDirectory(backupDir);
    var backupFileName = $"journalt-backup-{DateTime.UtcNow:yyyyMMddHHmmss}.db";
    var backupPath = Path.Combine(backupDir, backupFileName);

#pragma warning disable EF1002 // backupPath is constructed server-side from configured directory and UTC timestamp
    await db.Database.ExecuteSqlRawAsync($"VACUUM INTO '{backupPath}';");
#pragma warning restore EF1002

    return Results.Ok(new { message = "Backup created successfully.", fileName = backupFileName, timestampUtc = DateTime.UtcNow });
});

// SPA fallback: non-API routes return index.html; unmapped /api routes return 404 ProblemDetails
app.MapFallback(async context =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsync("{\"type\":\"https://tools.ietf.org/html/rfc9110#section-15.5.5\",\"title\":\"Not Found\",\"status\":404,\"detail\":\"The requested API endpoint was not found.\"}");
        return;
    }

    var webRoot = builder.Environment.WebRootPath ?? Path.Combine(AppContext.BaseDirectory, "wwwroot");
    var indexPath = Path.Combine(webRoot, "index.html");
    if (File.Exists(indexPath))
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexPath);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
    }
}).AllowAnonymous();

app.Run();
