namespace JournalT.Infrastructure.Notes;

using System.Text.Json;
using JournalT.Application.Common.Interfaces;
using JournalT.Application.Common.Models;
using JournalT.Application.Markdown;
using JournalT.Application.Notes.DTOs;
using JournalT.Application.Types;
using JournalT.Domain.Entities;
using JournalT.Domain.Enums;
using JournalT.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

public sealed class NoteService(
    JournalTDbContext db,
    ICurrentUser currentUser,
    IMarkdownService markdownService,
    ITypeValidationService typeValidationService) : INoteService
{
    private readonly JournalTDbContext _db = db;
    private readonly ICurrentUser _currentUser = currentUser;
    private readonly IMarkdownService _markdownService = markdownService;
    private readonly ITypeValidationService _typeValidationService = typeValidationService;

    public async Task<NoteResult> CreateAsync(CreateNoteRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return NoteResult.Failure("Title is required.");

        var userId = _currentUser.UserId;

        // Format-level compatibility: only Notes can be lists (not Inbox or Journal)
        if (request.Format == NoteFormat.List && request.Level != NoteLevel.Note)
            return NoteResult.Failure("Only notes can have List format. Inbox and Journal items cannot be lists.");

        // Level-specific validation
        TypeDefinition? typeDef = null;
        if (request.Level == NoteLevel.Inbox)
        {
            if (request.TypeId.HasValue)
                return NoteResult.Failure("Inbox notes cannot specify a TypeId.");
        }
        else if (request.Level == NoteLevel.Note)
        {
            if (request.TypeId.HasValue)
                return NoteResult.Failure("Notes cannot specify a TypeId.");
        }
        else if (request.Level == NoteLevel.Journal)
        {
            if (!request.TypeId.HasValue)
                return NoteResult.Failure("Typed notes (Journal) require a TypeId.");

            typeDef = await _db.TypeDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == request.TypeId.Value && t.UserId == userId && t.IsActive, ct);

            if (typeDef is null)
                return NoteResult.Failure("Type definition not found or inactive.");

            var metadataJson = string.IsNullOrWhiteSpace(request.TypedMetadataJson) ? "{}" : request.TypedMetadataJson;
            var metadataValidation = _typeValidationService.ValidateNoteMetadata(metadataJson, typeDef.SchemaJson);
            if (!metadataValidation.IsValid)
                return NoteResult.Failure(metadataValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));

            if (!string.IsNullOrWhiteSpace(typeDef.SectionsJson))
            {
                var sectionValidation = _typeValidationService.ValidateNoteSections(
                    request.BodyMarkdown ?? string.Empty, typeDef.SectionsJson);
                if (!sectionValidation.IsValid)
                    return NoteResult.Failure(sectionValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));
            }
        }

        // Tag validation and canonicalization
        var (normalizedTags, tagValidationError) = await ValidateTagsAsync(userId, request.Level, request.Tags, ct);
        if (tagValidationError != null)
            return NoteResult.Failure(tagValidationError);

        // Library existence check
        if (request.LibraryId.HasValue)
        {
            var libraryExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.LibraryId.Value, ct);
            if (!libraryExists)
                return NoteResult.Failure("Library not found.");
        }

        var body = request.BodyMarkdown ?? string.Empty;
        var (renderedHtml, wikiLinks, wikiWarnings) = await RenderWithWikiLinkResolutionAsync(userId, body, ct);

        var note = new Note
        {
            UserId = userId,
            Level = request.Level,
            Title = request.Title.Trim(),
            Summary = string.IsNullOrWhiteSpace(request.Summary) ? null : request.Summary.Trim(),
            BodyMarkdown = body,
            RenderedHtml = renderedHtml,
            LibraryId = request.LibraryId,
            TypeId = request.Level == NoteLevel.Journal ? request.TypeId : null,
            TypeVersion = request.Level == NoteLevel.Journal ? typeDef!.Version : null,
            TypedMetadataJson = request.Level == NoteLevel.Journal ? (string.IsNullOrWhiteSpace(request.TypedMetadataJson) ? "{}" : request.TypedMetadataJson) : null,
            IsTodo = request.IsTodo,
            TodoCompletedAtUtc = null,
            IsTrashed = false,
            Format = request.Format,
        };

        if (normalizedTags != null && normalizedTags.Count > 0)
        {
            foreach (var tag in normalizedTags)
            {
                note.Tags.Add(new NoteTag
                {
                    NoteId = note.Id,
                    TagType = request.Level == NoteLevel.Note ? TagType.FreeForm : tag.TagType,
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim().ToLowerInvariant(),
                    Value = tag.Value,
                });
            }
        }

        _db.Notes.Add(note);
        await _db.SaveChangesAsync(ct);

        return NoteResult.Success(MapToResponse(note, wikiLinks, wikiWarnings, renderedHtml), 201);
    }


    public async Task<NoteResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.Notes
            .AsNoTracking()
            .Include(n => n.Tags)
            .Include(n => n.Sources)
            .Include(n => n.Shares)
            .Include(n => n.OutboundRelations.Where(r => !r.TargetNote.IsTrashed))
                .ThenInclude(r => r.TargetNote)
            .Include(n => n.InboundRelations.Where(r => !r.SourceNote.IsTrashed))
                .ThenInclude(r => r.SourceNote)
            .FirstOrDefaultAsync(n => n.Id == id && (n.UserId == userId || n.Shares.Any(s => s.UserId == userId)), ct);

        if (note is null) return null;

        // Re-resolve wiki-links on every read: the stored HTML freezes link
        // targets at save time, but notes can be created, renamed, untrashed,
        // or duplicated afterwards.
        var (freshHtml, wikiLinks, wikiWarnings) = await RenderWithWikiLinkResolutionAsync(note.UserId, note.BodyMarkdown, ct);

        List<string>? typeWarnings = null;
        if (note.Level == NoteLevel.Journal && note.TypeId.HasValue)
        {
            var typeDef = await _db.TypeDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == note.TypeId.Value && t.UserId == note.UserId, ct);

            if (typeDef == null)
            {
                typeWarnings = ["Associated type definition not found."];
            }
            else
            {
                var warnings = new List<string>();
                var metaValidation = _typeValidationService.ValidateNoteMetadata(note.TypedMetadataJson ?? "{}", typeDef.SchemaJson);
                if (!metaValidation.IsValid)
                {
                    warnings.AddRange(metaValidation.Errors.Select(e => $"Metadata {e.Path}: {e.Message}"));
                }

                if (!string.IsNullOrWhiteSpace(typeDef.SectionsJson))
                {
                    var secValidation = _typeValidationService.ValidateNoteSections(note.BodyMarkdown, typeDef.SectionsJson);
                    if (!secValidation.IsValid)
                    {
                        warnings.AddRange(secValidation.Errors.Select(e => e.Message));
                    }
                }

                if (warnings.Count > 0)
                {
                    typeWarnings = warnings;
                }
            }
        }

        var isOwner = note.UserId == userId;
        var isShared = note.Shares.Any();
        string? ownerUserName = null;
        if (!isOwner)
        {
            ownerUserName = await _db.Users
                .Where(u => u.Id == note.UserId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync(ct);
        }

        List<NoteShareUserDto>? sharesList = null;
        if (note.Shares.Any())
        {
            var shareUserIds = note.Shares.Select(s => s.UserId).ToList();
            var usersMap = await _db.Users
                .Where(u => shareUserIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.UserName ?? string.Empty, ct);

            sharesList = note.Shares
                .Select(s => new NoteShareUserDto(
                    s.UserId,
                    usersMap.TryGetValue(s.UserId, out var name) ? name : string.Empty,
                    s.CreatedAtUtc))
                .OrderBy(s => s.UserName)
                .ToList();
        }

        return MapToResponse(note, wikiLinks, wikiWarnings, freshHtml, typeWarnings, isOwner, isShared, ownerUserName, sharesList);
    }


    public async Task<PagedResult<NoteSummaryResponse>> ListAsync(NoteFilterParams filter, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId;
        var query = _db.Notes
            .AsNoTracking()
            .Where(n => n.UserId == currentUserId || n.Shares.Any(s => s.UserId == currentUserId));

        if (filter.IsTrashed.HasValue)
            query = query.Where(n => n.IsTrashed == filter.IsTrashed.Value);

        if (filter.Level.HasValue)
            query = query.Where(n => n.Level == filter.Level.Value);

        if (filter.LibraryId.HasValue)
            query = query.Where(n => n.LibraryId == filter.LibraryId.Value);

        if (filter.TypeId.HasValue)
            query = query.Where(n => n.TypeId == filter.TypeId.Value);

        if (filter.IsTodo.HasValue)
            query = query.Where(n => n.IsTodo == filter.IsTodo.Value);

        if (!string.IsNullOrWhiteSpace(filter.Tag))
        {
            var tagSearch = filter.Tag.Trim();
            query = query.Where(n => n.Tags.Any(t =>
                (t.Value != null && EF.Functions.Like(t.Value, $"%{tagSearch}%")) ||
                (t.Category != null && EF.Functions.Like(t.Category, $"%{tagSearch}%"))));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim();
            query = query.Where(n => EF.Functions.Like(n.Title, $"%{search}%") ||
                                     (n.Summary != null && EF.Functions.Like(n.Summary, $"%{search}%")) ||
                                     EF.Functions.Like(n.BodyMarkdown, $"%{search}%"));
        }

        var totalCount = await query.CountAsync(ct);
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var isAsc = string.Equals(filter.SortOrder, "asc", StringComparison.OrdinalIgnoreCase);
        var sortByCreated = string.Equals(filter.SortBy, "createdAt", StringComparison.OrdinalIgnoreCase);

        var orderedQuery = sortByCreated
            ? (isAsc ? query.OrderBy(n => n.CreatedAtUtc) : query.OrderByDescending(n => n.CreatedAtUtc))
            : (isAsc ? query.OrderBy(n => n.UpdatedAtUtc) : query.OrderByDescending(n => n.UpdatedAtUtc));

        var items = await orderedQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NoteSummaryResponse(
                n.Id,
                n.Level,
                n.Title,
                n.Summary,
                n.BodyMarkdown,
                n.RenderedHtml,
                n.LibraryId,
                n.TypeId,
                n.IsTodo,
                n.TodoCompletedAtUtc,
                n.IsTrashed,
                n.CreatedAtUtc,
                n.UpdatedAtUtc,
                n.Tags.Select(t => new TagDto(t.TagType, t.Category, t.Value)).ToList(),
                n.TypedMetadataJson,
                n.Format,
                n.UserId,
                n.UserId == currentUserId,
                n.Shares.Any(),
                null
            ))
            .ToListAsync(ct);

        var sharedOwnerIds = items.Where(i => !i.IsOwner).Select(i => i.UserId).Distinct().ToList();
        if (sharedOwnerIds.Count > 0)
        {
            var ownerNames = await _db.Users
                .AsNoTracking()
                .Where(u => sharedOwnerIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.UserName ?? string.Empty, ct);

            items = items.Select(i => i.IsOwner ? i : i with
            {
                OwnerUserName = ownerNames.TryGetValue(i.UserId, out var uname) ? uname : null
            }).ToList();
        }

        return new PagedResult<NoteSummaryResponse>(items, totalCount, page, pageSize);
    }


    /// <summary>
    /// Returns a lightweight projection of every wiki-eligible note so the Explore tree can render
    /// counts without loading note bodies. Journal notes are always members; a Note is a
    /// member only once filed into a library or referenced by a relation from another note, so
    /// unfiled scratch notes never dilute the tree. Inbox is excluded entirely.
    /// </summary>
    public async Task<IReadOnlyList<NoteWikiIndexItem>> GetWikiIndexAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        return await _db.Notes
            .AsNoTracking()
            .Where(n => (n.UserId == userId || n.Shares.Any(s => s.UserId == userId))
                     && !n.IsTrashed
                     && (n.Level == NoteLevel.Journal
                         || n.LibraryId != null
                         || n.InboundRelations.Any(r => !r.SourceNote.IsTrashed)))
            .OrderBy(n => n.Title)
            .Select(n => new NoteWikiIndexItem(
                n.Id,
                n.Level,
                n.Title,
                n.LibraryId,
                n.TypeId,
                n.UpdatedAtUtc,
                n.InboundRelations.Any(r => !r.SourceNote.IsTrashed)))
            .ToListAsync(ct);
    }

    public async Task<NoteResult> UpdateAsync(Guid id, UpdateNoteRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.Notes
            .Include(n => n.Tags)
            .Include(n => n.Sources)
            .Include(n => n.Shares)
            .Include(n => n.OutboundRelations)
                .ThenInclude(r => r.TargetNote)
            .FirstOrDefaultAsync(n => n.Id == id && (n.UserId == userId || n.Shares.Any(s => s.UserId == userId)), ct);

        if (note is null)
            return NoteResult.NotFound();

        if (note.IsTrashed)
            return NoteResult.Failure("Cannot edit a trashed note. Restore it first.");

        if (string.IsNullOrWhiteSpace(request.Title))
            return NoteResult.Failure("Title is required.");

        if (request.LibraryId.HasValue && request.LibraryId != note.LibraryId)
        {
            var libraryExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.LibraryId.Value, ct);
            if (!libraryExists)
                return NoteResult.Failure("Library not found.");
        }

        var (normalizedTags, tagValidationError) = await ValidateTagsAsync(note.UserId, note.Level, request.Tags, ct);
        if (tagValidationError != null)
            return NoteResult.Failure(tagValidationError);

        var body = request.BodyMarkdown ?? string.Empty;

        if (note.Level == NoteLevel.Journal)
        {
            var typeDef = await _db.TypeDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == note.TypeId && t.UserId == note.UserId, ct);

            if (typeDef != null)
            {
                var metadataJson = request.TypedMetadataJson ?? note.TypedMetadataJson ?? "{}";
                var metadataValidation = _typeValidationService.ValidateNoteMetadata(metadataJson, typeDef.SchemaJson);
                if (!metadataValidation.IsValid)
                    return NoteResult.Failure(metadataValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));

                if (!string.IsNullOrWhiteSpace(typeDef.SectionsJson))
                {
                    var sectionValidation = _typeValidationService.ValidateNoteSections(body, typeDef.SectionsJson);
                    if (!sectionValidation.IsValid)
                        return NoteResult.Failure(sectionValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));
                }
            }
        }

        var (renderedHtml, wikiLinks, wikiWarnings) = await RenderWithWikiLinkResolutionAsync(note.UserId, body, ct);

        note.Title = request.Title.Trim();
        note.Summary = string.IsNullOrWhiteSpace(request.Summary) ? null : request.Summary.Trim();
        note.BodyMarkdown = body;
        note.RenderedHtml = renderedHtml;
        note.LibraryId = request.LibraryId;

        if (note.Level == NoteLevel.Journal && request.TypedMetadataJson != null)
        {
            note.TypedMetadataJson = request.TypedMetadataJson;
        }

        if (request.IsTodo != note.IsTodo)
        {
            note.IsTodo = request.IsTodo;
            note.TodoCompletedAtUtc = request.IsTodo ? null : DateTime.UtcNow;
        }

        if (request.Tags != null)
        {
            var existingTags = await _db.NoteTags.Where(t => t.NoteId == note.Id).ToListAsync(ct);
            _db.NoteTags.RemoveRange(existingTags);

            var tagsToApply = normalizedTags ?? [];

            foreach (var tag in tagsToApply)
            {
                _db.NoteTags.Add(new NoteTag
                {
                    NoteId = note.Id,
                    TagType = note.Level == NoteLevel.Note ? TagType.FreeForm : tag.TagType,
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim().ToLowerInvariant(),
                    Value = tag.Value,
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        var isOwner = note.UserId == userId;
        var isShared = note.Shares.Any();
        string? ownerUserName = null;
        if (!isOwner)
        {
            ownerUserName = await _db.Users
                .Where(u => u.Id == note.UserId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync(ct);
        }

        return NoteResult.Success(MapToResponse(note, wikiLinks, wikiWarnings, renderedHtml, null, isOwner, isShared, ownerUserName));
    }


    public async Task<bool> TrashAsync(Guid id, CancellationToken ct = default)
    {
        var note = await _db.Notes
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == _currentUser.UserId && !n.IsTrashed, ct);

        if (note is null) return false;

        note.IsTrashed = true;
        note.TrashedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var note = await _db.Notes
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == _currentUser.UserId && n.IsTrashed, ct);

        if (note is null) return false;

        note.IsTrashed = false;
        note.TrashedAtUtc = null;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeletePermanentAsync(Guid id, CancellationToken ct = default)
    {
        var note = await _db.Notes
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == _currentUser.UserId, ct);

        if (note is null) return false;

        _db.Notes.Remove(note);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // Note Promotion
    public async Task<NoteResult> PromoteAsync(Guid id, PromoteNoteRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.Notes
            .Include(n => n.Tags)
            .Include(n => n.Sources)
            .Include(n => n.OutboundRelations)
                .ThenInclude(r => r.TargetNote)
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct);

        if (note is null)
            return NoteResult.NotFound();

        if (note.IsTrashed)
            return NoteResult.Failure("Cannot promote a trashed note. Restore it first.");

        // Unidirectional progression only
        if (request.TargetLevel <= note.Level)
            return NoteResult.Failure($"Cannot demote or promote to current level (current: {note.Level}, requested: {request.TargetLevel}).");

        // Format-level compatibility: only Notes can be lists (not Journal)
        if (note.Format == NoteFormat.List && request.TargetLevel == NoteLevel.Journal)
            return NoteResult.Failure("List notes cannot be promoted to Journal. Only Notes can be lists.");

        TypeDefinition? typeDef = null;
        if (request.TargetLevel == NoteLevel.Journal)
        {
            if (!request.TypeId.HasValue)
                return NoteResult.Failure("Promotion to Journal requires a TypeId.");

            typeDef = await _db.TypeDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == request.TypeId.Value && t.UserId == userId && t.IsActive, ct);

            if (typeDef is null)
                return NoteResult.Failure("Target Type definition not found or inactive.");

            var metadataJson = string.IsNullOrWhiteSpace(request.TypedMetadataJson) ? "{}" : request.TypedMetadataJson;
            var metadataValidation = _typeValidationService.ValidateNoteMetadata(metadataJson, typeDef.SchemaJson);
            if (!metadataValidation.IsValid)
                return NoteResult.Failure(metadataValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));

            if (!string.IsNullOrWhiteSpace(typeDef.SectionsJson))
            {
                var sectionValidation = _typeValidationService.ValidateNoteSections(note.BodyMarkdown, typeDef.SectionsJson);
                if (!sectionValidation.IsValid)
                    return NoteResult.Failure(sectionValidation.Errors.Select(e => $"{e.Path}: {e.Message}"));
            }

            note.TypeId = typeDef.Id;
            note.TypeVersion = typeDef.Version;
            note.TypedMetadataJson = metadataJson;
        }

        var tagsToValidate = request.Tags ?? note.Tags.Select(t => new TagDto(t.TagType, t.Category, t.Value)).ToList();
        var (normalizedTags, tagError) = await ValidateTagsAsync(userId, request.TargetLevel, tagsToValidate, ct);
        if (tagError != null)
            return NoteResult.Failure(tagError);

        if (request.LibraryId.HasValue)
        {
            var libraryExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.LibraryId.Value && l.UserId == userId, ct);
            if (!libraryExists)
                return NoteResult.Failure("Library not found.");
            note.LibraryId = request.LibraryId;
        }

        if (request.Tags != null)
        {
            var existingTags = await _db.NoteTags.Where(t => t.NoteId == note.Id).ToListAsync(ct);
            _db.NoteTags.RemoveRange(existingTags);

            foreach (var tag in normalizedTags ?? [])
            {
                _db.NoteTags.Add(new NoteTag
                {
                    NoteId = note.Id,
                    TagType = request.TargetLevel == NoteLevel.Note ? TagType.FreeForm : tag.TagType,
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim().ToLowerInvariant(),
                    Value = tag.Value,
                });
            }
        }

        note.Level = request.TargetLevel;
        await _db.SaveChangesAsync(ct);

        var (freshPromoteHtml, wikiLinks, wikiWarnings) = await RenderWithWikiLinkResolutionAsync(userId, note.BodyMarkdown, ct);
        return NoteResult.Success(MapToResponse(note, wikiLinks, wikiWarnings, freshPromoteHtml));
    }


    // Sources Management
    public async Task<NoteSourceResponse?> AddSourceAsync(Guid noteId, CreateNoteSourceRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return null;

        var userId = _currentUser.UserId;
        var noteExists = await _db.Notes
            .AnyAsync(n => n.Id == noteId && n.UserId == userId, ct);

        if (!noteExists) return null;

        var source = new NoteSource
        {
            NoteId = noteId,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Url = string.IsNullOrWhiteSpace(request.Url) ? null : request.Url.Trim()
        };

        _db.NoteSources.Add(source);
        await _db.SaveChangesAsync(ct);

        return new NoteSourceResponse(
            source.Id,
            source.NoteId,
            source.Title,
            source.Description,
            source.Url,
            source.CreatedAtUtc,
            source.UpdatedAtUtc
        );
    }

    public async Task<IReadOnlyList<NoteSourceResponse>> GetSourcesAsync(Guid noteId, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var sources = await _db.NoteSources
            .AsNoTracking()
            .Where(s => s.NoteId == noteId && s.Note.UserId == userId)
            .OrderBy(s => s.CreatedAtUtc)
            .Select(s => new NoteSourceResponse(
                s.Id,
                s.NoteId,
                s.Title,
                s.Description,
                s.Url,
                s.CreatedAtUtc,
                s.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return sources;
    }

    public async Task<bool> DeleteSourceAsync(Guid noteId, Guid sourceId, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var source = await _db.NoteSources
            .FirstOrDefaultAsync(s => s.Id == sourceId && s.NoteId == noteId && s.Note.UserId == userId, ct);

        if (source is null) return false;

        _db.NoteSources.Remove(source);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // Relations Management
    public async Task<NoteResult> AddRelationAsync(Guid noteId, CreateNoteRelationRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var sourceNote = await _db.Notes
            .FirstOrDefaultAsync(n => n.Id == noteId && n.UserId == userId, ct);

        if (sourceNote is null)
            return NoteResult.NotFound("Source note not found.");

        // Inbox notes cannot define explicit outbound relations
        if (sourceNote.Level == NoteLevel.Inbox)
            return NoteResult.Failure("Inbox notes cannot define explicit outbound relations. Promote the note first.");

        if (request.TargetNoteId == noteId)
            return NoteResult.Failure("A note cannot define a relation to itself.");

        if (string.IsNullOrWhiteSpace(request.Role))
            return NoteResult.Failure("Relation role is required.");

        // Target note must exist and belong to user
        var targetNote = await _db.Notes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == request.TargetNoteId && n.UserId == userId, ct);

        if (targetNote is null)
            return NoteResult.Failure("Target note not found or belongs to another user.");

        var role = request.Role.Trim().ToLowerInvariant();

        var relationExists = await _db.NoteRelations
            .AnyAsync(r => r.SourceNoteId == noteId && r.TargetNoteId == request.TargetNoteId && r.Role == role, ct);

        if (relationExists)
            return NoteResult.Failure("A relation with this role already exists between these two notes.", 409);

        var relation = new NoteRelation
        {
            SourceNoteId = noteId,
            TargetNoteId = request.TargetNoteId,
            Role = role,
            Context = string.IsNullOrWhiteSpace(request.Context) ? null : request.Context.Trim()
        };

        _db.NoteRelations.Add(relation);
        await _db.SaveChangesAsync(ct);

        var response = new NoteRelationResponse(
            relation.Id,
            relation.SourceNoteId,
            relation.TargetNoteId,
            targetNote.Title,
            relation.Role,
            relation.Context,
            relation.CreatedAtUtc,
            relation.UpdatedAtUtc
        );

        return NoteResult.Success(new NoteResponse(
            sourceNote.Id,
            sourceNote.UserId,
            sourceNote.Level,
            sourceNote.Title,
            sourceNote.Summary,
            sourceNote.BodyMarkdown,
            sourceNote.RenderedHtml,
            sourceNote.LibraryId,
            sourceNote.TypeId,
            sourceNote.TypeVersion,
            sourceNote.TypedMetadataJson,
            sourceNote.IsTodo,
            sourceNote.TodoCompletedAtUtc,
            sourceNote.IsTrashed,
            sourceNote.TrashedAtUtc,
            sourceNote.CreatedAtUtc,
            sourceNote.UpdatedAtUtc,
            [],
            [],
            sourceNote.Format,
            OutboundRelations: [response]
        ));
    }

    public async Task<IReadOnlyList<NoteRelationResponse>> GetRelationsAsync(Guid noteId, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var relations = await _db.NoteRelations
            .AsNoTracking()
            .Where(r => r.SourceNoteId == noteId && r.SourceNote.UserId == userId && !r.TargetNote.IsTrashed)
            .OrderBy(r => r.CreatedAtUtc)
            .Select(r => new NoteRelationResponse(
                r.Id,
                r.SourceNoteId,
                r.TargetNoteId,
                r.TargetNote.Title,
                r.Role,
                r.Context,
                r.CreatedAtUtc,
                r.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return relations;
    }

    public async Task<IReadOnlyList<NoteBacklinkResponse>> GetBacklinksAsync(Guid noteId, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var backlinks = await _db.NoteRelations
            .AsNoTracking()
            .Where(r => r.TargetNoteId == noteId && r.SourceNote.UserId == userId && !r.SourceNote.IsTrashed)
            .OrderBy(r => r.CreatedAtUtc)
            .Select(r => new NoteBacklinkResponse(
                r.Id,
                r.SourceNoteId,
                r.SourceNote.Title,
                r.Role,
                r.Context
            ))
            .ToListAsync(ct);

        return backlinks;
    }

    public async Task<bool> DeleteRelationAsync(Guid noteId, Guid relationId, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var relation = await _db.NoteRelations
            .FirstOrDefaultAsync(r => r.Id == relationId && r.SourceNoteId == noteId && r.SourceNote.UserId == userId, ct);

        if (relation is null) return false;

        _db.NoteRelations.Remove(relation);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // Phase 4: Todo Hub
    public async Task<NoteResponse?> ToggleTodoAsync(Guid id, CancellationToken ct = default)
    {
        var note = await _db.Notes
            .Include(n => n.Tags)
            .Include(n => n.Sources)
            .Include(n => n.Shares)
            .Include(n => n.OutboundRelations)
                .ThenInclude(r => r.TargetNote)
            .FirstOrDefaultAsync(n => n.Id == id && (n.UserId == _currentUser.UserId || n.Shares.Any(s => s.UserId == _currentUser.UserId)) && !n.IsTrashed, ct);

        if (note is null) return null;

        if (note.IsTodo)
        {
            note.IsTodo = false;
            note.TodoCompletedAtUtc = DateTime.UtcNow;
        }
        else
        {
            note.IsTodo = true;
            note.TodoCompletedAtUtc = null;
        }

        await _db.SaveChangesAsync(ct);
        var (freshTodoHtml, wikiLinks, wikiWarnings) = await RenderWithWikiLinkResolutionAsync(_currentUser.UserId, note.BodyMarkdown, ct);

        var isOwner = note.UserId == _currentUser.UserId;
        var isShared = note.Shares.Any();
        string? ownerUserName = null;
        if (!isOwner)
        {
            ownerUserName = await _db.Users
                .Where(u => u.Id == note.UserId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync(ct);
        }

        return MapToResponse(note, wikiLinks, wikiWarnings, freshTodoHtml, null, isOwner, isShared, ownerUserName);
    }


    public async Task<TodoSummaryResponse> GetTodoSummaryAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var pendingQuery = _db.Notes
            .AsNoTracking()
            .Where(n => (n.UserId == userId || n.Shares.Any(s => s.UserId == userId)) && !n.IsTrashed && n.IsTodo && (n.Level == NoteLevel.Note || n.Level == NoteLevel.Journal));

        var completedQuery = _db.Notes
            .AsNoTracking()
            .Where(n => (n.UserId == userId || n.Shares.Any(s => s.UserId == userId)) && !n.IsTrashed && !n.IsTodo && n.TodoCompletedAtUtc != null && (n.Level == NoteLevel.Note || n.Level == NoteLevel.Journal));

        var pendingCount = await pendingQuery.CountAsync(ct);
        var completedCount = await completedQuery.CountAsync(ct);

        var pendingNotes = await pendingQuery
            .OrderByDescending(n => n.UpdatedAtUtc)
            .Take(50)
            .Select(n => new NoteSummaryResponse(
                n.Id, n.Level, n.Title, n.Summary, n.BodyMarkdown, n.RenderedHtml, n.LibraryId, n.TypeId, n.IsTodo, n.TodoCompletedAtUtc, n.IsTrashed, n.CreatedAtUtc, n.UpdatedAtUtc,
                n.Tags.Select(t => new TagDto(t.TagType, t.Category, t.Value)).ToList(), n.TypedMetadataJson, n.Format, n.UserId, n.UserId == userId, n.Shares.Any(), null))
            .ToListAsync(ct);

        var completedNotes = await completedQuery
            .OrderByDescending(n => n.TodoCompletedAtUtc)
            .Take(20)
            .Select(n => new NoteSummaryResponse(
                n.Id, n.Level, n.Title, n.Summary, n.BodyMarkdown, n.RenderedHtml, n.LibraryId, n.TypeId, n.IsTodo, n.TodoCompletedAtUtc, n.IsTrashed, n.CreatedAtUtc, n.UpdatedAtUtc,
                n.Tags.Select(t => new TagDto(t.TagType, t.Category, t.Value)).ToList(), n.TypedMetadataJson, n.Format, n.UserId, n.UserId == userId, n.Shares.Any(), null))
            .ToListAsync(ct);

        return new TodoSummaryResponse(pendingCount, completedCount, pendingNotes, completedNotes);
    }

    private async Task<(List<TagDto>? Tags, string? Error)> ValidateTagsAsync(
        Guid userId,
        NoteLevel level,
        List<TagDto>? tags,
        CancellationToken ct)
    {
        if (tags is null || tags.Count == 0)
            return (null, null);

        var normalizedTags = tags
            .Select(tag => tag with
            {
                Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim().ToLowerInvariant(),
                Value = string.IsNullOrWhiteSpace(tag.Value) ? null : tag.Value.Trim()
            })
            .ToList();

        if (normalizedTags.Any(tag => tag.TagType == TagType.FreeForm && tag.Value is null))
            return (null, "Free-form tag values cannot be empty.");

        if (level == NoteLevel.Note && normalizedTags.Any(t => t.TagType == TagType.Typed))
            return (null, "Notes only support free-form tags.");

        if (level == NoteLevel.Journal && normalizedTags.Any(t => t.TagType != TagType.Typed))
            return (null, "Journal notes only support registered typed tags.");

        if (normalizedTags
            .GroupBy(t => new { t.TagType, t.Category, Value = t.Value?.ToLowerInvariant() ?? "<category-only>" })
            .Any(group => group.Count() > 1))
        {
            return (null, "A tag cannot be selected more than once.");
        }

        var typedTags = normalizedTags
            .Select((tag, index) => (Tag: tag, Index: index))
            .Where(item => item.Tag.TagType == TagType.Typed)
            .ToList();

        if (typedTags.Count == 0)
            return (normalizedTags, null);

        var categories = typedTags
            .Select(item => item.Tag.Category)
            .Where(category => !string.IsNullOrEmpty(category))
            .Distinct()
            .ToList();

        var definitions = await _db.TagDefinitions
            .AsNoTracking()
            .Where(definition => definition.UserId == userId && categories.Contains(definition.Category))
            .ToDictionaryAsync(definition => definition.Category, ct);

        foreach (var item in typedTags)
        {
            var tag = item.Tag;
            var category = tag.Category;
            if (string.IsNullOrEmpty(category) || !definitions.TryGetValue(category, out var definition))
                return (null, $"Tag category '{tag.Category}' is not defined.");

            if (tag.Value is null)
            {
                if (!string.IsNullOrWhiteSpace(definition.AllowedValuesJson))
                    return (null, $"Tag category '{category}' is closed and requires a value.");

                normalizedTags[item.Index] = tag with { Value = null };
                continue;
            }

            var valuesJson = definition.AllowedValuesJson ?? definition.KnownValuesJson;
            IReadOnlyList<string> values;
            try
            {
                values = string.IsNullOrWhiteSpace(valuesJson)
                    ? []
                    : JsonSerializer.Deserialize<string[]>(valuesJson) ?? [];
            }
            catch
            {
                return (null, $"Tag category '{category}' has an invalid value registry.");
            }

            var canonicalValue = values.FirstOrDefault(value =>
                string.Equals(value.Trim(), tag.Value, StringComparison.OrdinalIgnoreCase));
            if (canonicalValue is null)
            {
                return (null, string.IsNullOrWhiteSpace(definition.AllowedValuesJson)
                    ? $"Tag value '{tag.Value}' is not registered for category '{category}'."
                    : $"Tag value '{tag.Value}' is not in the vocabulary for category '{category}'. Allowed: {string.Join(", ", values)}");
            }

            normalizedTags[item.Index] = tag with { Value = canonicalValue.Trim() };
        }

        return (normalizedTags, null);
    }

    private async Task<(string RenderedHtml, IReadOnlyList<string> WikiLinks, IReadOnlyList<WikiLinkWarning> Warnings)> RenderWithWikiLinkResolutionAsync(
        Guid userId, string bodyMarkdown, CancellationToken ct)
    {
        var wikiLinks = _markdownService.ExtractWikiLinks(bodyMarkdown);
        Dictionary<string, Guid>? resolvedLinks = null;
        var warnings = new List<WikiLinkWarning>();

        if (wikiLinks.Count > 0)
        {
            resolvedLinks = [];
            foreach (var title in wikiLinks)
            {
                var matchingNotes = await _db.Notes
                    .AsNoTracking()
                    .Where(n => n.UserId == userId && !n.IsTrashed && n.Title == title)
                    .Select(n => n.Id)
                    .Take(2)
                    .ToListAsync(ct);

                if (matchingNotes.Count == 1)
                {
                    resolvedLinks[title] = matchingNotes[0];
                }
                else if (matchingNotes.Count == 0)
                {
                    // target note does not exist — report as unresolved warning
                    warnings.Add(new WikiLinkWarning(title, "not_found"));
                }
                else
                {
                    // ambiguous title (multiple notes share the same title)
                    warnings.Add(new WikiLinkWarning(title, "ambiguous"));
                }
            }
        }

        var renderResult = _markdownService.Render(bodyMarkdown, resolvedLinks);
        return (renderResult.RenderedHtml, wikiLinks, warnings);
    }

    public async Task<string> RenderPreviewAsync(string markdown, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(markdown))
            return string.Empty;

        var (renderedHtml, _, _) = await RenderWithWikiLinkResolutionAsync(_currentUser.UserId, markdown, ct);
        return renderedHtml;
    }

    private static NoteResponse MapToResponse(
        Note note,
        IReadOnlyList<string> wikiLinks,
        IReadOnlyList<WikiLinkWarning>? warnings = null,
        string? renderedHtml = null,
        IReadOnlyList<string>? typeValidationWarnings = null,
        bool isOwner = true,
        bool isShared = false,
        string? ownerUserName = null,
        IReadOnlyList<NoteShareUserDto>? shares = null) =>
        new(
            note.Id,
            note.UserId,
            note.Level,
            note.Title,
            note.Summary,
            note.BodyMarkdown,
            renderedHtml ?? note.RenderedHtml,
            note.LibraryId,
            note.TypeId,
            note.TypeVersion,
            note.TypedMetadataJson,
            note.IsTodo,
            note.TodoCompletedAtUtc,
            note.IsTrashed,
            note.TrashedAtUtc,
            note.CreatedAtUtc,
            note.UpdatedAtUtc,
            note.Tags.Select(t => new TagDto(t.TagType, t.Category, t.Value)).ToList(),
            wikiLinks,
            note.Format,
            Sources: note.Sources.Select(s => new NoteSourceResponse(
                s.Id, s.NoteId, s.Title, s.Description, s.Url, s.CreatedAtUtc, s.UpdatedAtUtc)).ToList(),
            OutboundRelations: note.OutboundRelations.Select(r => new NoteRelationResponse(
                r.Id, r.SourceNoteId, r.TargetNoteId, r.TargetNote?.Title ?? string.Empty, r.Role, r.Context, r.CreatedAtUtc, r.UpdatedAtUtc)).ToList(),
            Backlinks: note.InboundRelations.Select(r => new NoteBacklinkResponse(
                r.Id, r.SourceNoteId, r.SourceNote?.Title ?? string.Empty, r.Role, r.Context)).ToList(),
            UnresolvedWikiLinks: warnings ?? [],
            TypeValidationWarnings: typeValidationWarnings,
            IsOwner: isOwner,
            IsShared: isShared,
            OwnerUserName: ownerUserName,
            Shares: shares
        );

    public async Task<IReadOnlyList<string>> GetDistinctTagsAsync(CancellationToken ct = default)
    {
        return await _db.NoteTags
            .AsNoTracking()
            .Where(t => !string.IsNullOrWhiteSpace(t.Value))
            .Select(t => t.Value!)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(ct);
    }

    // Note Sharing
    public async Task<NoteSharesResponse?> GetSharesAsync(Guid noteId, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId;
        var note = await _db.Notes
            .AsNoTracking()
            .Include(n => n.Shares)
            .FirstOrDefaultAsync(n => n.Id == noteId && (n.UserId == currentUserId || n.Shares.Any(s => s.UserId == currentUserId)), ct);

        if (note is null)
            return null;

        var owner = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == note.UserId, ct);

        var ownerName = owner?.UserName ?? "Unknown";
        var isOwner = note.UserId == currentUserId;

        var shareUserIds = note.Shares.Select(s => s.UserId).ToList();
        var sharedUsers = await _db.Users
            .AsNoTracking()
            .Where(u => shareUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.UserName ?? "Unknown", ct);

        var sharesList = note.Shares
            .Select(s => new NoteShareUserDto(
                s.UserId,
                sharedUsers.TryGetValue(s.UserId, out var name) ? name : "Unknown",
                s.CreatedAtUtc))
            .OrderBy(s => s.UserName)
            .ToList();

        return new NoteSharesResponse(note.Id, note.UserId, ownerName, isOwner, sharesList);
    }

    public async Task<ShareNoteResult> ShareNoteAsync(Guid noteId, ShareNoteRequest request, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId;

        var note = await _db.Notes
            .Include(n => n.Shares)
            .FirstOrDefaultAsync(n => n.Id == noteId, ct);

        if (note is null)
            return ShareNoteResult.NotFound("Note not found.");

        if (note.UserId != currentUserId)
            return ShareNoteResult.Forbidden("Only the note owner can share this note.");

        if (note.IsTrashed)
            return ShareNoteResult.Failure("Cannot share a trashed note.");

        if (!request.UserId.HasValue && string.IsNullOrWhiteSpace(request.UserName))
            return ShareNoteResult.Failure("User is required.");

        var targetUserQuery = _db.Users.AsNoTracking().Where(u => u.IsActive);
        var targetUser = request.UserId.HasValue
            ? await targetUserQuery.FirstOrDefaultAsync(u => u.Id == request.UserId.Value, ct)
            : await targetUserQuery.FirstOrDefaultAsync(u => u.NormalizedUserName == request.UserName!.Trim().ToUpperInvariant(), ct);

        if (targetUser is null)
            return ShareNoteResult.Failure("User not found.");

        if (targetUser.Id == currentUserId)
            return ShareNoteResult.Failure("You cannot share a note with yourself.");

        if (note.Shares.Any(s => s.UserId == targetUser.Id))
            return ShareNoteResult.Failure("Note is already shared with this user.");

        var share = new NoteShare
        {
            NoteId = noteId,
            UserId = targetUser.Id,
        };

        _db.NoteShares.Add(share);
        await _db.SaveChangesAsync(ct);

        var sharesResponse = await GetSharesAsync(noteId, ct);
        return ShareNoteResult.Success(sharesResponse!);
    }

    public async Task<ShareNoteResult> RemoveShareAsync(Guid noteId, Guid targetUserId, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId;

        var note = await _db.Notes
            .Include(n => n.Shares)
            .FirstOrDefaultAsync(n => n.Id == noteId, ct);

        if (note is null)
            return ShareNoteResult.NotFound("Note not found.");

        var isOwner = note.UserId == currentUserId;
        var isSelf = targetUserId == currentUserId;

        if (!isOwner && !isSelf)
            return ShareNoteResult.Forbidden("You do not have permission to modify sharing for this note.");

        var share = note.Shares.FirstOrDefault(s => s.UserId == targetUserId);
        if (share is null)
            return ShareNoteResult.Failure("Share not found.");

        _db.NoteShares.Remove(share);
        await _db.SaveChangesAsync(ct);

        return ShareNoteResult.Success();
    }
}
