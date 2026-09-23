namespace JournalT.Infrastructure.Tags;

using System.Text.Json;
using JournalT.Application.Common.Interfaces;
using JournalT.Application.Tags.DTOs;
using JournalT.Domain.Entities;
using JournalT.Domain.Enums;
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

        var isClosed = !string.IsNullOrWhiteSpace(request.AllowedValuesJson);
        if (!TryNormalizeValues(isClosed ? request.AllowedValuesJson : request.KnownValuesJson, out var values, out var jsonError))
            return TagDefinitionResult.Failure(jsonError!);

        var tagDef = new TagDefinition
        {
            UserId = userId,
            Category = category,
            AllowedValuesJson = isClosed ? SerializeValues(values) : null,
            KnownValuesJson = isClosed ? null : SerializeValues(values)
        };

        _db.TagDefinitions.Add(tagDef);
        await _db.SaveChangesAsync(ct);

        return TagDefinitionResult.Success(MapToResponse(tagDef), 201);
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
                t.KnownValuesJson,
                t.CreatedAtUtc,
                t.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return items;
    }

    public async Task<IReadOnlyList<TagOptionsResponse>> ListOptionsAsync(CancellationToken ct = default)
    {
        var definitions = await _db.TagDefinitions
            .AsNoTracking()
            .Where(t => t.UserId == _currentUser.UserId)
            .OrderBy(t => t.Category)
            .Select(t => new { t.Id, t.Category, t.AllowedValuesJson, t.KnownValuesJson })
            .ToListAsync(ct);

        return definitions
            .Select(t =>
            {
                var isClosed = !string.IsNullOrWhiteSpace(t.AllowedValuesJson);
                var values = DeserializeValues(isClosed ? t.AllowedValuesJson : t.KnownValuesJson);
                return new TagOptionsResponse(t.Id, t.Category, isClosed, values);
            })
            .ToList();
    }

    public async Task<TagDefinitionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var tagDef = await _db.TagDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        return tagDef is null ? null : MapToResponse(tagDef);
    }

    public async Task<TagDefinitionResult> UpdateAsync(Guid id, UpdateTagDefinitionRequest request, CancellationToken ct = default)
    {
        var tagDef = await _db.TagDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        if (tagDef is null)
            return TagDefinitionResult.NotFound();

        var isClosed = !string.IsNullOrWhiteSpace(request.AllowedValuesJson);
        if (!TryNormalizeValues(isClosed ? request.AllowedValuesJson : request.KnownValuesJson, out var values, out var jsonError))
            return TagDefinitionResult.Failure(jsonError!);

        var oldValues = DeserializeValues(isClosed ? tagDef.AllowedValuesJson : tagDef.KnownValuesJson);
        var removedValues = oldValues
            .Where(old => !values.Contains(old, StringComparer.OrdinalIgnoreCase))
            .ToList();

        foreach (var removedValue in removedValues)
        {
            if (await IsValueInUseAsync(tagDef.Category, removedValue, ct))
            {
                return TagDefinitionResult.Failure(
                    $"Tag value '{removedValue}' is still used by notes and cannot be removed.",
                    409);
            }
        }

        if (tagDef.AllowedValuesJson is null && isClosed)
        {
            var usedValues = await GetUsedValuesAsync(tagDef.Category, ct);
            var missingValues = usedValues
                .Where(value => !values.Contains(value, StringComparer.OrdinalIgnoreCase))
                .ToList();

            if (missingValues.Count > 0)
            {
                return TagDefinitionResult.Failure(
                    $"Cannot close category '{tagDef.Category}' because existing notes use values not in the vocabulary: {string.Join(", ", missingValues)}.",
                    409);
            }
        }

        tagDef.AllowedValuesJson = isClosed ? SerializeValues(values) : null;
        tagDef.KnownValuesJson = isClosed ? null : SerializeValues(values);
        await _db.SaveChangesAsync(ct);

        return TagDefinitionResult.Success(MapToResponse(tagDef));
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var tagDef = await _db.TagDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct);

        if (tagDef is null) return false;

        var inUse = await _db.NoteTags
            .AnyAsync(t => t.TagType == TagType.Typed && t.Category == tagDef.Category && t.Note.UserId == userId, ct);
        if (inUse)
            return false;

        _db.TagDefinitions.Remove(tagDef);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<bool> IsValueInUseAsync(string category, string value, CancellationToken ct)
    {
        var normalizedValue = value.ToLowerInvariant();
        return await _db.NoteTags.AnyAsync(
            t => t.TagType == TagType.Typed &&
                  t.Category == category &&
                  t.Value != null &&
                  t.Value.ToLower() == normalizedValue &&
                  t.Note.UserId == _currentUser.UserId,
            ct);
    }

    private async Task<IReadOnlyList<string>> GetUsedValuesAsync(string category, CancellationToken ct)
    {
        var values = await _db.NoteTags
            .AsNoTracking()
            .Where(t => t.TagType == TagType.Typed && t.Category == category && t.Value != null && t.Note.UserId == _currentUser.UserId)
            .Select(t => t.Value!)
            .Distinct()
            .ToListAsync(ct);

        return values;
    }

    private static bool TryNormalizeValues(string? json, out IReadOnlyList<string> values, out string? error)
    {
        values = [];
        error = null;

        if (string.IsNullOrWhiteSpace(json))
            return true;

        try
        {
            var parsed = JsonSerializer.Deserialize<string[]>(json);
            if (parsed is null || parsed.Length == 0)
            {
                error = "ValuesJson must be a non-empty JSON array of strings.";
                return false;
            }

            var normalized = parsed
                .Select(value => value?.Trim() ?? string.Empty)
                .ToList();

            if (normalized.Any(string.IsNullOrEmpty))
            {
                error = "Tag values cannot be empty.";
                return false;
            }

            if (normalized.Distinct(StringComparer.OrdinalIgnoreCase).Count() != normalized.Count)
            {
                error = "Tag values must be unique, ignoring case.";
                return false;
            }

            values = normalized;
            return true;
        }
        catch
        {
            error = "ValuesJson must be a valid JSON array of strings.";
            return false;
        }
    }

    private static IReadOnlyList<string> DeserializeValues(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string? SerializeValues(IReadOnlyList<string> values) =>
        values.Count == 0 ? null : JsonSerializer.Serialize(values);

    private static TagDefinitionResponse MapToResponse(TagDefinition tagDef) =>
        new(
            tagDef.Id,
            tagDef.Category,
            tagDef.AllowedValuesJson,
            tagDef.KnownValuesJson,
            tagDef.CreatedAtUtc,
            tagDef.UpdatedAtUtc
        );
}
