namespace JournalT.Application.Auth.DTOs;

/// <summary>
/// Safe representation of an API key for list/display. Never contains the secret or hash.
/// </summary>
public sealed record ApiKeyResponse(
    Guid Id,
    string Name,
    string KeyPrefix,
    DateTime? ExpiresAtUtc,
    DateTime? LastUsedAtUtc);
