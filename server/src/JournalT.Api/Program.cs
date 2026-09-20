using JournalT.Api.Antiforgery;
using JournalT.Api.Extensions;
using JournalT.Application.Common.Interfaces;
using JournalT.Infrastructure;
using JournalT.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidateCookieAntiforgeryFilter>();
});

// Antiforgery / CSRF protection for cookie-authenticated clients (e.g. Angular)
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = ".JournalT.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Auto-apply migrations so deleting journalt.db + dotnet run is enough to reset.
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<JournalTDbContext>();
    db.Database.Migrate();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
