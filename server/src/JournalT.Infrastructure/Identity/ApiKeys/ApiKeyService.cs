namespace JournalT.Infrastructure.Identity.ApiKeys;

using System.Security.Cryptography;
using System.Text;
using JournalT.Application.Auth.DTOs;
using JournalT.Application.Common.Interfaces;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

public class ApiKeyService(JournalTDbContext db) : IApiKeyService
{
    private readonly JournalTDbContext _db = db;

    public async Task<CreateApiKeyResult> CreateAsync(Guid userId, CreateApiKeyRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return CreateApiKeyResult.Failure("API key name is required.");

        var nameTrimmed = request.Name.Trim();

        var exists = await _db.ApiKeys
            .AnyAsync(k => k.UserId == userId && k.Name == nameTrimmed && !k.IsRevoked, ct);

        if (exists)
            return CreateApiKeyResult.Failure($"An active API key named '{nameTrimmed}' already exists.");

        var rawBytes = RandomNumberGenerator.GetBytes(32);
        var plaintext = "jrt_" + Base64UrlEncode(rawBytes);
        var prefix = plaintext[..8];
        var hash = ComputeHash(plaintext);

        var apiKey = new ApiKey
        {
            UserId = userId,
            Name = nameTrimmed,
            KeyPrefix = prefix,
            KeyHash = hash,
            ExpiresAtUtc = request.ExpiresAtUtc,
        };

        _db.ApiKeys.Add(apiKey);
        await _db.SaveChangesAsync(ct);

        var response = new ApiKeyCreatedResponse(apiKey.Id, apiKey.Name, apiKey.KeyPrefix, plaintext, apiKey.ExpiresAtUtc);
        return CreateApiKeyResult.Success(response);
    }

    public async Task<IReadOnlyList<ApiKeyResponse>> ListAsync(Guid userId, CancellationToken ct = default) =>
        await _db.ApiKeys
            .Where(k => k.UserId == userId && !k.IsRevoked)
            .OrderByDescending(k => k.CreatedAtUtc)
            .Select(k => new ApiKeyResponse(k.Id, k.Name, k.KeyPrefix, k.ExpiresAtUtc, k.LastUsedAtUtc))
            .ToListAsync(ct);

    public async Task<bool> RevokeAsync(Guid id, Guid userId, CancellationToken ct = default)
    {
        var rows = await _db.ApiKeys
            .Where(k => k.Id == id && k.UserId == userId && !k.IsRevoked)
            .ExecuteUpdateAsync(s => s.SetProperty(k => k.IsRevoked, true), ct);

        return rows > 0;
    }

    public async Task<bool> RevokeByNameAsync(string name, Guid userId, CancellationToken ct = default)
    {
        var rows = await _db.ApiKeys
            .Where(k => k.Name == name && k.UserId == userId && !k.IsRevoked)
            .ExecuteUpdateAsync(s => s.SetProperty(k => k.IsRevoked, true), ct);

        return rows > 0;
    }

    /// <summary>SHA-256 hex of the plaintext key. Internal so the auth handler can reuse it.</summary>
    internal static string ComputeHash(string plaintext)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToHexStringLower(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
