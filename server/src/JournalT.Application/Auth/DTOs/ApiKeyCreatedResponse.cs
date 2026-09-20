namespace JournalT.Application.Auth.DTOs;

/// <summary>
/// Returned once on creation. PlaintextKey is never stored and cannot be recovered.
/// </summary>
public sealed record ApiKeyCreatedResponse(
    Guid Id,
    string Name,
    string KeyPrefix,
    string PlaintextKey,
    DateTime? ExpiresAtUtc);
