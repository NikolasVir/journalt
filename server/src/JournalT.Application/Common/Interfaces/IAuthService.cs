namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Auth.DTOs;

public interface IAuthService
{
    bool RegistrationEnabled { get; }

    Task<AuthResult> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResult> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task LogoutAsync();
    Task<UserResponse?> GetUserByIdAsync(Guid userId, CancellationToken ct = default);
    Task<AuthResult> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default);
}
