namespace JournalT.Infrastructure.Tags;

using System.Text.Json;
using JournalT.Application.Common.Interfaces;
using JournalT.Application.Tags.DTOs;
using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;

public sealed class TagDefinitionService(
    IJournalTDbContext db,
    ICurrentUser currentUser) : ITagDefinitionService
{
    private readonly IJournalTDbContext _db = db;
    private readonly ICurrentUser _currentUser = currentUser;

    public async Task<TagDefinitionResult> CreateAsync(CreateTagDefinitionRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Category))
            return TagDefinitionResult.Failure("Tag category is required.");

        var category = request.Category.Trim().ToLowerInvariant();
        var userId = _currentUser.UserId;

        var exists = await _db.TagDefinitions
            .AnyAsync(t => t.UserId == userId && t.Category == category, ct);

        if (exists)
            return TagDefinitionResult.Failure($"Tag category '{category}' already exists.", 409);

        if (!ValidateAllowedValuesJson(request.AllowedValuesJson, out var jsonError))
            return TagDefinitionResult.Failure(jsonError!);

        var tagDef = new TagDefinition
        {
            UserId = userId,
            Category = category,
            AllowedValuesJson = string.IsNullOrWhiteSpace(request.AllowedValuesJson) ? null : request.AllowedValuesJson.Trim()
        };

        _db.TagDefinitions.Add(tagDef);
        await _db.SaveChangesAsync(ct);

        return TagDefinitionResult.Success(new TagDefinitionResponse(
            tagDef.Id,
            tagDef.Category,
            tagDef.AllowedValuesJson,
            tagDef.CreatedAtUtc,
            tagDef.UpdatedAtUtc
        ), 201);
    }

    public async Task<IReadOnlyList<TagDefinitionResponse>> ListAsync(CancellationToken ct = default)
    {
        var items = await _db.TagDefinitions
            .AsNoTracking()
            .Where(t => t.UserId == _currentUser.UserId)
            .OrderBy(t => t.Category)
            .Select(t => new TagDefinitionResponse(
                t.Id,
                t.Category,
                t.AllowedValuesJson,
                t.CreatedAtUtc,
                t.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return items;
    }

    public async Task<TagDefinitionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var tagDef = await _db.TagDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        if (tagDef is null) return null;

        return new TagDefinitionResponse(
            tagDef.Id,
            tagDef.Category,
            tagDef.AllowedValuesJson,
            tagDef.CreatedAtUtc,
            tagDef.UpdatedAtUtc
        );
    }

    public async Task<TagDefinitionResult> UpdateAsync(Guid id, UpdateTagDefinitionRequest request, CancellationToken ct = default)
    {
        var tagDef = await _db.TagDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        if (tagDef is null)
            return TagDefinitionResult.NotFound();

        if (!ValidateAllowedValuesJson(request.AllowedValuesJson, out var jsonError))
            return TagDefinitionResult.Failure(jsonError!);

        tagDef.AllowedValuesJson = string.IsNullOrWhiteSpace(request.AllowedValuesJson) ? null : request.AllowedValuesJson.Trim();
        await _db.SaveChangesAsync(ct);

        return TagDefinitionResult.Success(new TagDefinitionResponse(
            tagDef.Id,
            tagDef.Category,
            tagDef.AllowedValuesJson,
            tagDef.CreatedAtUtc,
            tagDef.UpdatedAtUtc
        ));
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var tagDef = await _db.TagDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        if (tagDef is null) return false;

        _db.TagDefinitions.Remove(tagDef);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static bool ValidateAllowedValuesJson(string? json, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(json)) return true;

        try
        {
            var values = JsonSerializer.Deserialize<string[]>(json);
            if (values is null || values.Length == 0)
            {
                error = "AllowedValuesJson must be a non-empty array of strings.";
                return false;
            }

            return true;
        }
        catch
        {
            error = "AllowedValuesJson must be a valid JSON array of strings.";
            return false;
        }
    }
}
