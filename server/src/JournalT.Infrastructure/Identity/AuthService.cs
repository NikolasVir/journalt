namespace JournalT.Infrastructure.Identity;

using JournalT.Application.Auth;
using JournalT.Application.Auth.DTOs;
using JournalT.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

public class AuthService(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    IOptions<AuthOptions> authOptions) : IAuthService
{
    private readonly UserManager<AppUser> _userManager = userManager;
    private readonly SignInManager<AppUser> _signInManager = signInManager;
    private readonly AuthOptions _authOptions = authOptions.Value;

    public bool RegistrationEnabled => _authOptions.RegistrationEnabled;

    public async Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var user = new AppUser
        {
            UserName = request.UserName,
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return AuthResult.Failure(result.Errors.Select(e => e.Description).ToArray());

        await _signInManager.SignInAsync(user, isPersistent: false);

        return AuthResult.Success(new UserResponse(user.Id, user.UserName!, user.AvatarUrl));
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _userManager.FindByNameAsync(request.UserName);

        // Intentionally vague error to prevent user enumeration
        if (user is null || !user.IsActive)
            return AuthResult.Failure("Invalid username or password.");

        var result = await _signInManager.PasswordSignInAsync(
            user, request.Password, request.RememberMe, lockoutOnFailure: true);

        if (result.IsLockedOut)
            return AuthResult.Failure("Account is temporarily locked. Try again later.");

        if (!result.Succeeded)
            return AuthResult.Failure("Invalid username or password.");

        return AuthResult.Success(new UserResponse(user.Id, user.UserName!, user.AvatarUrl));
    }

    public async Task LogoutAsync()
    {
        await _signInManager.SignOutAsync();
    }

    public async Task<UserResponse?> GetUserByIdAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());

        if (user is null || !user.IsActive)
            return null;

        return new UserResponse(user.Id, user.UserName!, user.AvatarUrl);
    }

    public async Task<AuthResult> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null || !user.IsActive)
            return AuthResult.Failure("User not found.");

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return AuthResult.Failure(result.Errors.Select(e => e.Description).ToArray());

        await _signInManager.RefreshSignInAsync(user);
        return AuthResult.Success(new UserResponse(user.Id, user.UserName!, user.AvatarUrl));
    }
}
