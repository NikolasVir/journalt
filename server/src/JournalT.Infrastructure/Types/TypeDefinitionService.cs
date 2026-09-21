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
        await _db.SaveChangesAsync(ct);

        return TypeDefinitionResult.Success(MapToResponse(newVersion), 201);
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

        return TypeDefinitionResult.Success(MapToResponse(clone), 201);
    }

    public async Task<TypeDefinitionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var typeDef = await _db.TypeDefinitions
            .AsNoTracking()
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
            .ToListAsync(ct);

        return list.Select(MapToResponse).ToList();
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

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var typeDef = await _db.TypeDefinitions
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _currentUser.UserId, ct);

        if (typeDef is null) return false;

        // TYPE-014: If existing notes use this type, deactivate instead of hard-deleting
        var inUse = await _db.Notes.AnyAsync(n => n.TypeId == id, ct);
        if (inUse)
        {
            typeDef.IsActive = false;
        }
        else
        {
            _db.TypeDefinitions.Remove(typeDef);
        }

        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static TypeDefinitionResponse MapToResponse(TypeDefinition t) =>
        new(t.Id, t.Name, t.Version, t.Description, t.SchemaJson, t.SectionsJson, t.IsActive, t.CreatedAtUtc);
}
