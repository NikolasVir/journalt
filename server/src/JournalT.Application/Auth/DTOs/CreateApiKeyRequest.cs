namespace JournalT.Application.Auth.DTOs;

public sealed record CreateApiKeyRequest(string Name, DateTime? ExpiresAtUtc = null);
