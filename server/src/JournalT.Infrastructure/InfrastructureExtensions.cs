namespace JournalT.Infrastructure;

using JournalT.Application.Common.Interfaces;
using JournalT.Infrastructure.Identity;
using JournalT.Infrastructure.Persistence;
using JournalT.Infrastructure.Persistence.Interceptors;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddPersistence(configuration);
        services.AddIdentityServices();
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
                   .AddInterceptors(interceptor);
        });

        services.AddScoped<IJournalTDbContext>(sp => sp.GetRequiredService<JournalTDbContext>());

        return services;
    }

    public static IServiceCollection AddIdentityServices(this IServiceCollection services)
    {
        services.AddIdentityCore<AppUser>(options =>
        {
            options.Password.RequireDigit = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireUppercase = false;
            options.Password.RequiredLength = 6;
        })
        .AddRoles<IdentityRole<Guid>>()
        .AddEntityFrameworkStores<JournalTDbContext>()
        .AddSignInManager();

        return services;
    }
}
