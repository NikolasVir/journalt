namespace JournalT.Infrastructure;

using JournalT.Application.Auth;
using JournalT.Application.Common.Interfaces;
using JournalT.Infrastructure.Identity.ApiKeys;
using JournalT.Infrastructure.Identity;
using JournalT.Infrastructure.Persistence;
using JournalT.Infrastructure.Persistence.Interceptors;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

using JournalT.Application.Markdown;
using JournalT.Application.Types;
using JournalT.Infrastructure.Markdown;
using JournalT.Infrastructure.Libraries;
using JournalT.Infrastructure.Notes;
using JournalT.Infrastructure.Tags;
using JournalT.Infrastructure.Types;
using JournalT.Infrastructure.Validation;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AuthOptions>(configuration.GetSection(AuthOptions.SectionName));
        services.AddPersistence(configuration);
        services.AddIdentityServices(configuration);
        services.AddApiKeyServices();
        services.AddSingleton<IMarkdownService, MarkdownService>();
        services.AddSingleton<ITypeValidationService, TypeValidationService>();
        services.AddScoped<INoteService, NoteService>();
        services.AddScoped<ILibraryService, LibraryService>();
        services.AddScoped<ITagDefinitionService, TagDefinitionService>();
        services.AddScoped<ITypeDefinitionService, TypeDefinitionService>();
        services.AddScoped<IVaultService, Vault.VaultService>();
        return services;
    }

    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<AuditableEntityInterceptor>();

        var connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? "Data Source=journalt.db";

        services.AddDbContext<JournalTDbContext>((sp, options) =>
        {
            var interceptor = sp.GetRequiredService<AuditableEntityInterceptor>();
            options.UseSqlite(connectionString)
                   .AddInterceptors(interceptor)
                   .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        services.AddScoped<IJournalTDbContext>(sp => sp.GetRequiredService<JournalTDbContext>());

        return services;
    }

    public static IServiceCollection AddIdentityServices(this IServiceCollection services, IConfiguration? configuration = null)
    {
        var isProduction = configuration is not null && string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Production", StringComparison.OrdinalIgnoreCase);

        services.AddIdentity<AppUser, IdentityRole<Guid>>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Password.RequireUppercase = true;
            options.Password.RequiredLength = 9;

            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
        })
        .AddEntityFrameworkStores<JournalTDbContext>();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = isProduction ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;

            // Return 401/403 instead of redirecting to a login page (API-friendly)
            options.Events.OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        services.AddScoped<IAuthService, AuthService>();

        return services;
    }

    public static IServiceCollection AddApiKeyServices(this IServiceCollection services)
    {
        services.AddAuthentication()
            .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthHandler>("ApiKey", _ => { });

        services.AddScoped<IApiKeyService, ApiKeyService>();

        return services;
    }
}
