namespace JournalT.UnitTests.Identity;

using JournalT.Application.Auth;
using JournalT.Application.Auth.DTOs;
using JournalT.Infrastructure.Identity;
using JournalT.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

public class AuthServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _serviceProvider;
    private readonly JournalTDbContext _db;
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly AuthService _sut;

    public AuthServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<JournalTDbContext>(o => o.UseSqlite(_connection));
        services.AddIdentity<AppUser, IdentityRole<Guid>>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Password.RequireUppercase = true;
            options.Password.RequiredLength = 9;
        })
        .AddEntityFrameworkStores<JournalTDbContext>()
        .AddDefaultTokenProviders();

        services.AddHttpContextAccessor();

        var authOptions = Options.Create(new AuthOptions { RegistrationEnabled = true });

        _serviceProvider = services.BuildServiceProvider();

        var contextAccessor = _serviceProvider.GetRequiredService<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext
        {
            RequestServices = _serviceProvider
        };
        contextAccessor.HttpContext = httpContext;

        _db = _serviceProvider.GetRequiredService<JournalTDbContext>();
        _db.Database.EnsureCreated();

        _userManager = _serviceProvider.GetRequiredService<UserManager<AppUser>>();
        _signInManager = _serviceProvider.GetRequiredService<SignInManager<AppUser>>();

        _sut = new AuthService(_userManager, _signInManager, authOptions);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
        _serviceProvider.Dispose();
    }

    [Fact]
    public async Task RegisterAndGetUserById_IncludesAvatarUrl()
    {
        var reg = await _sut.RegisterAsync(new RegisterRequest("alice", "Password123!"));
        Assert.True(reg.Succeeded);
        Assert.NotNull(reg.User);

        // Update avatar directly on user
        var user = await _userManager.FindByIdAsync(reg.User.Id.ToString());
        Assert.NotNull(user);
        user.AvatarUrl = "https://example.com/avatar.png";
        await _userManager.UpdateAsync(user);

        var fetched = await _sut.GetUserByIdAsync(reg.User.Id);
        Assert.NotNull(fetched);
        Assert.Equal("https://example.com/avatar.png", fetched.AvatarUrl);
    }

    [Fact]
    public async Task ChangePasswordAsync_ValidCredentials_Succeeds()
    {
        var reg = await _sut.RegisterAsync(new RegisterRequest("bob", "OldPassword123!"));
        Assert.True(reg.Succeeded);

        var changeResult = await _sut.ChangePasswordAsync(
            reg.User!.Id,
            new ChangePasswordRequest("OldPassword123!", "NewPassword456!"));

        Assert.True(changeResult.Succeeded);

        // Verify login with new password works
        var loginNew = await _sut.LoginAsync(new LoginRequest("bob", "NewPassword456!"));
        Assert.True(loginNew.Succeeded);

        // Verify login with old password fails
        var loginOld = await _sut.LoginAsync(new LoginRequest("bob", "OldPassword123!"));
        Assert.False(loginOld.Succeeded);
    }

    [Fact]
    public async Task ChangePasswordAsync_WrongCurrentPassword_Fails()
    {
        var reg = await _sut.RegisterAsync(new RegisterRequest("charlie", "CorrectPassword1!"));
        Assert.True(reg.Succeeded);

        var changeResult = await _sut.ChangePasswordAsync(
            reg.User!.Id,
            new ChangePasswordRequest("WrongPassword!", "NewPassword456!"));

        Assert.False(changeResult.Succeeded);
        Assert.NotEmpty(changeResult.Errors);
    }

    [Theory]
    [InlineData("Pass1!")] // < 9 chars
    [InlineData("Password!!")] // No digit
    [InlineData("PASSWORD123!")] // No lowercase
    [InlineData("password123!")] // No uppercase
    [InlineData("Password123")] // No non-alphanumeric
    public async Task ChangePasswordAsync_ViolatesComplexity_Fails(string invalidNewPassword)
    {
        var reg = await _sut.RegisterAsync(new RegisterRequest("david", "OldPassword123!"));
        Assert.True(reg.Succeeded);

        var result = await _sut.ChangePasswordAsync(
            reg.User!.Id,
            new ChangePasswordRequest("OldPassword123!", invalidNewPassword));

        Assert.False(result.Succeeded);
        Assert.NotEmpty(result.Errors);
    }
}
