namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Auth.DTOs;

public interface IApiKeyService
{
    Task<CreateApiKeyResult> CreateAsync(Guid userId, CreateApiKeyRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ApiKeyResponse>> ListAsync(Guid userId, CancellationToken ct = default);

    /// <returns>True if a key was found and revoked; false if not found or not owned by userId.</returns>
    Task<bool> RevokeAsync(Guid id, Guid userId, CancellationToken ct = default);

    /// <returns>True if a key was found and revoked; false if not found or not owned by userId.</returns>
    Task<bool> RevokeByNameAsync(string name, Guid userId, CancellationToken ct = default);
}
