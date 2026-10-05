namespace JournalT.Infrastructure.Types;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Types;
using JournalT.Application.Types.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

public class TypeDefinitionService(
    JournalTDbContext db,
    ICurrentUser currentUser,
    ITypeValidationService validationService) : ITypeDefinitionService
{
    private readonly JournalTDbContext _db = db;
    private readonly ICurrentUser _currentUser = currentUser;
    private readonly ITypeValidationService _validationService = validationService;

    public async Task<TypeDefinitionResult> CreateAsync(CreateTypeDefinitionRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return TypeDefinitionResult.Failure("Type name is required.");

        var userId = _currentUser.UserId;
        var trimmedName = request.Name.Trim();

        // Validate Schema and Sections
        var schema = string.IsNullOrWhiteSpace(request.SchemaJson) ? "{}" : request.SchemaJson;
        var validation = _validationService.ValidateTypeDefinition(schema, request.SectionsJson);
        if (!validation.IsValid)
            return TypeDefinitionResult.Failure(validation.Errors.Select(e => $"{e.Path}: {e.Message}"));

        var exists = await _db.TypeDefinitions
            .AnyAsync(t => t.UserId == userId && t.Name.ToLower() == trimmedName.ToLower(), ct);

        if (exists)
            return TypeDefinitionResult.Conflict($"A type definition named '{trimmedName}' already exists.");

        var typeDef = new TypeDefinition
        {
            UserId = userId,
            Name = trimmedName,
            Version = 1,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            SchemaJson = schema,
            SectionsJson = string.IsNullOrWhiteSpace(request.SectionsJson) ? null : request.SectionsJson.Trim(),
            IsActive = true
        };

        _db.TypeDefinitions.Add(typeDef);
        await _db.SaveChangesAsync(ct);

        return TypeDefinitionResult.Success(MapToResponse(typeDef), 201);
    }

    public async Task<TypeDefinitionResult> UpdateAsync(Guid id, UpdateTypeDefinitionRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var existing = await _db.TypeDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct);

        if (existing is null)
            return TypeDefinitionResult.NotFound();

        var trimmedName = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmedName))
            return TypeDefinitionResult.Failure("Type name is required.");

        var nameExists = await _db.TypeDefinitions
            .AnyAsync(t => t.UserId == userId && t.Id != id && t.Name.ToLower() == trimmedName.ToLower(), ct);
        if (nameExists)
            return TypeDefinitionResult.Conflict($"A type definition named '{trimmedName}' already exists.");

        var schema = string.IsNullOrWhiteSpace(request.SchemaJson) ? "{}" : request.SchemaJson;
        var sections = string.IsNullOrWhiteSpace(request.SectionsJson) ? null : request.SectionsJson.Trim();

        var validation = _validationService.ValidateTypeDefinition(schema, sections);
        if (!validation.IsValid)
            return TypeDefinitionResult.Failure(validation.Errors.Select(e => $"{e.Path}: {e.Message}"));

        existing.Name = trimmedName;
        existing.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        existing.SchemaJson = schema;
        existing.SectionsJson = sections;
        existing.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        var notesCount = await _db.Notes.CountAsync(n => n.TypeId == id, ct);
        return TypeDefinitionResult.Success(MapToResponse(existing, notesCount));
    }

    public async Task<TypeDefinitionResult> CreateNewVersionAsync(Guid id, CreateTypeVersionRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var existing = await _db.TypeDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct);

        if (existing is null)
            return TypeDefinitionResult.NotFound();

        var schema = string.IsNullOrWhiteSpace(request.SchemaJson) ? existing.SchemaJson : request.SchemaJson;
        var sections = request.SectionsJson ?? existing.SectionsJson;

        var validation = _validationService.ValidateTypeDefinition(schema, sections);
        if (!validation.IsValid)
            return TypeDefinitionResult.Failure(validation.Errors.Select(e => $"{e.Path}: {e.Message}"));

        var currentMaxVersion = await _db.TypeDefinitions
            .Where(t => t.UserId == userId && t.Name.ToLower() == existing.Name.ToLower())
            .MaxAsync(t => t.Version, ct);

        var newVersion = new TypeDefinition
        {
            UserId = userId,
            Name = existing.Name,
            Version = currentMaxVersion + 1,
            Description = request.Description ?? existing.Description,
            SchemaJson = schema,
            SectionsJson = sections,
            IsActive = true
        };

        _db.TypeDefinitions.Add(newVersion);

        // Automatically replace the old version:
        // 1. Migrate all notes pointing to previous versions of this type
        var oldVersionIds = await _db.TypeDefinitions
            .Where(t => t.UserId == userId && t.Name.ToLower() == existing.Name.ToLower() && t.Id != newVersion.Id)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var notesToMigrate = await _db.Notes
            .Where(n => n.UserId == userId && n.TypeId.HasValue && oldVersionIds.Contains(n.TypeId.Value))
            .ToListAsync(ct);

        foreach (var note in notesToMigrate)
        {
            note.TypeId = newVersion.Id;
            note.TypeVersion = newVersion.Version;
        }

        // 2. Remove the old version(s) so the new version cleanly replaces them
        var oldVersions = await _db.TypeDefinitions
            .Where(t => t.UserId == userId && t.Name.ToLower() == existing.Name.ToLower() && t.Id != newVersion.Id)
            .ToListAsync(ct);

        _db.TypeDefinitions.RemoveRange(oldVersions);

        await _db.SaveChangesAsync(ct);

        return TypeDefinitionResult.Success(MapToResponse(newVersion, notesToMigrate.Count), 201);
    }

    public async Task<TypeDefinitionResult> CloneAsync(Guid id, CloneTypeRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.NewName))
            return TypeDefinitionResult.Failure("New type name is required.");

        var userId = _currentUser.UserId;
        var trimmedName = request.NewName.Trim();

        var source = await _db.TypeDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct);

        if (source is null)
            return TypeDefinitionResult.NotFound();

        var exists = await _db.TypeDefinitions
            .AnyAsync(t => t.UserId == userId && t.Name.ToLower() == trimmedName.ToLower(), ct);

        if (exists)
            return TypeDefinitionResult.Conflict($"A type definition named '{trimmedName}' already exists.");

        var clone = new TypeDefinition
        {
            UserId = userId,
            Name = trimmedName,
            Version = 1,
            Description = source.Description,
            SchemaJson = source.SchemaJson,
            SectionsJson = source.SectionsJson,
            IsActive = true
        };

        _db.TypeDefinitions.Add(clone);
        await _db.SaveChangesAsync(ct);

        return TypeDefinitionResult.Success(MapToResponse(clone, 0), 201);
    }

    public async Task<TypeDefinitionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var typeDef = await _db.TypeDefinitions
            .AsNoTracking()
            .Include(t => t.Notes)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        return typeDef is not null ? MapToResponse(typeDef) : null;
    }

    public async Task<IReadOnlyList<TypeDefinitionResponse>> ListAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        var query = _db.TypeDefinitions
            .AsNoTracking()
            .Where(t => t.UserId == _currentUser.UserId);

        if (!includeInactive)
            query = query.Where(t => t.IsActive);

        var list = await query
            .OrderBy(t => t.Name)
            .ThenByDescending(t => t.Version)
            .Select(t => new TypeDefinitionResponse(
                t.Id,
                t.Name,
                t.Version,
                t.Description,
                t.SchemaJson,
                t.SectionsJson,
                t.IsActive,
                t.CreatedAtUtc,
                t.Notes.Count
            ))
            .ToListAsync(ct);

        return list;
    }

    public async Task<bool> ToggleActiveAsync(Guid id, CancellationToken ct = default)
    {
        var typeDef = await _db.TypeDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        if (typeDef is null) return false;

        typeDef.IsActive = !typeDef.IsActive;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<TypeDefinitionResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var typeDef = await _db.TypeDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        if (typeDef is null) return TypeDefinitionResult.NotFound();

        // Types that have notes cannot be deleted
        var inUse = await _db.Notes.AnyAsync(n => n.TypeId == id, ct);
        if (inUse)
        {
            return TypeDefinitionResult.Conflict("Types that have notes cannot be deleted.");
        }

        _db.TypeDefinitions.Remove(typeDef);
        await _db.SaveChangesAsync(ct);
        return TypeDefinitionResult.Success(null!, 204);
    }

    // Migration preview — shows which notes pass/fail the target version schema
    public async Task<IReadOnlyList<TypeMigrationPreviewItem>> PreviewMigrationAsync(
        Guid sourceTypeId, Guid targetTypeVersionId, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var targetType = await _db.TypeDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == targetTypeVersionId && t.UserId == userId, ct);

        if (targetType is null)
            return [];

        // Only notes currently on the source type (any version other than the target)
        var notes = await _db.Notes
            .AsNoTracking()
            .Where(n => n.UserId == userId && n.TypeId == sourceTypeId && n.Id != targetTypeVersionId && !n.IsTrashed)
            .Select(n => new { n.Id, n.Title, n.TypeVersion, n.TypedMetadataJson, n.BodyMarkdown })
            .ToListAsync(ct);

        var results = new List<TypeMigrationPreviewItem>(notes.Count);

        foreach (var note in notes)
        {
            var errors = new List<string>();

            var metadataJson = string.IsNullOrWhiteSpace(note.TypedMetadataJson) ? "{}" : note.TypedMetadataJson;
            var metaValidation = _validationService.ValidateNoteMetadata(metadataJson, targetType.SchemaJson);
            if (!metaValidation.IsValid)
                errors.AddRange(metaValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));

            var sectionsValid = true;
            if (!string.IsNullOrWhiteSpace(targetType.SectionsJson))
            {
                var secValidation = _validationService.ValidateNoteSections(
                    note.BodyMarkdown ?? string.Empty, targetType.SectionsJson);
                if (!secValidation.IsValid)
                {
                    sectionsValid = false;
                    errors.AddRange(secValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));
                }
            }

            results.Add(new TypeMigrationPreviewItem(
                NoteId: note.Id,
                NoteTitle: note.Title,
                CurrentTypeVersion: note.TypeVersion ?? 0,
                TargetTypeVersion: targetType.Version,
                MetadataValid: metaValidation.IsValid,
                SectionsValid: sectionsValid,
                ValidationErrors: errors
            ));
        }

        return results;
    }

    // Apply migration — updates TypeId+TypeVersion on approved notes
    public async Task<TypeMigrationResult> MigrateNotesAsync(
        Guid sourceTypeId, TypeMigrationRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var targetType = await _db.TypeDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == request.TargetTypeVersionId && t.UserId == userId, ct);

        if (targetType is null)
            return TypeMigrationResult.NotFound("Target type version not found.");

        // Verify target type belongs to the same logical type name as source
        var sourceType = await _db.TypeDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == sourceTypeId && t.UserId == userId, ct);

        if (sourceType is null)
            return TypeMigrationResult.NotFound("Source type not found.");

        if (!string.Equals(sourceType.Name, targetType.Name, StringComparison.OrdinalIgnoreCase))
            return TypeMigrationResult.Failure("Target type version must belong to the same type name as the source.");

        // Determine which notes to migrate
        var query = _db.Notes
            .Where(n => n.UserId == userId && n.TypeId == sourceTypeId && !n.IsTrashed);

        if (request.NoteIds != null && request.NoteIds.Count > 0)
            query = query.Where(n => request.NoteIds.Contains(n.Id));

        var notes = await query.ToListAsync(ct);

        if (notes.Count == 0)
            return TypeMigrationResult.Success([]);

        var migratedIds = new List<Guid>(notes.Count);
        var errors = new List<string>();

        foreach (var note in notes)
        {
            var metadataJson = string.IsNullOrWhiteSpace(note.TypedMetadataJson) ? "{}" : note.TypedMetadataJson;
            var metaValidation = _validationService.ValidateNoteMetadata(metadataJson, targetType.SchemaJson);
            if (!metaValidation.IsValid)
            {
                errors.Add($"Note '{note.Title}' ({note.Id}): metadata invalid under target schema — " +
                    string.Join("; ", metaValidation.Errors.Select(e => $"{e.Path}: {e.Message}")));
                continue;
            }

            if (!string.IsNullOrWhiteSpace(targetType.SectionsJson))
            {
                var secValidation = _validationService.ValidateNoteSections(
                    note.BodyMarkdown ?? string.Empty, targetType.SectionsJson);
                if (!secValidation.IsValid)
                {
                    errors.Add($"Note '{note.Title}' ({note.Id}): sections invalid under target schema — " +
                        string.Join("; ", secValidation.Errors.Select(e => $"{e.Path}: {e.Message}")));
                    continue;
                }
            }

            note.TypeId = targetType.Id;
            note.TypeVersion = targetType.Version;
            migratedIds.Add(note.Id);
        }

        await _db.SaveChangesAsync(ct);

        // Return success even when some notes were skipped due to validation — partial success is intentional
        return TypeMigrationResult.Success(migratedIds);
    }

    private static TypeDefinitionResponse MapToResponse(TypeDefinition t, int? notesCount = null) =>
        new(t.Id, t.Name, t.Version, t.Description, t.SchemaJson, t.SectionsJson, t.IsActive, t.CreatedAtUtc, notesCount ?? t.Notes?.Count ?? 0);
}

