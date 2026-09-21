namespace JournalT.Infrastructure.Notes;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Common.Models;
using JournalT.Application.Markdown;
using JournalT.Application.Notes.DTOs;
using JournalT.Application.Types;
using JournalT.Domain.Entities;
using JournalT.Domain.Enums;
using Microsoft.EntityFrameworkCore;

public sealed class NoteService(
    IJournalTDbContext db,
    ICurrentUser currentUser,
    IMarkdownService markdownService,
    ITypeValidationService typeValidationService) : INoteService
{
    private readonly IJournalTDbContext _db = db;
    private readonly ICurrentUser _currentUser = currentUser;
    private readonly IMarkdownService _markdownService = markdownService;
    private readonly ITypeValidationService _typeValidationService = typeValidationService;

    public async Task<NoteResult> CreateAsync(CreateNoteRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return NoteResult.Failure("Title is required.");

        var userId = _currentUser.UserId;

        // Level-specific validation
        TypeDefinition? typeDef = null;
        if (request.Level == NoteLevel.Inbox)
        {
            if (request.TypeId.HasValue)
                return NoteResult.Failure("Inbox notes cannot specify a TypeId.");
        }
        else if (request.Level == NoteLevel.Quick)
        {
            if (request.TypeId.HasValue)
                return NoteResult.Failure("Quick notes cannot specify a TypeId.");
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

        // Tag validation (TYPE-004 & QUICK-003)
        var tagValidationError = await ValidateTagsAsync(userId, request.Level, request.Tags, ct);
        if (tagValidationError != null)
            return NoteResult.Failure(tagValidationError);

        // Library existence check
        if (request.LibraryId.HasValue)
        {
            var libraryExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.LibraryId.Value && l.UserId == userId, ct);
            if (!libraryExists)
                return NoteResult.Failure("Library not found.");
        }

        var body = request.BodyMarkdown ?? string.Empty;
        var (renderedHtml, wikiLinks) = await RenderWithWikiLinkResolutionAsync(userId, body, ct);

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
        };

        if (request.Tags != null && request.Tags.Count > 0)
        {
            foreach (var tag in request.Tags)
            {
                note.Tags.Add(new NoteTag
                {
                    NoteId = note.Id,
                    TagType = request.Level == NoteLevel.Quick ? TagType.FreeForm : tag.TagType,
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim().ToLowerInvariant(),
                    Value = tag.Value.Trim(),
                });
            }
        }

        _db.Notes.Add(note);
        await _db.SaveChangesAsync(ct);

        return NoteResult.Success(MapToResponse(note, wikiLinks), 201);
    }

    public async Task<NoteResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.Notes
            .AsNoTracking()
            .Include(n => n.Tags)
            .Include(n => n.Sources)
            .Include(n => n.OutboundRelations.Where(r => !r.TargetNote.IsTrashed))
                .ThenInclude(r => r.TargetNote)
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct);

        if (note is null) return null;

        var wikiLinks = _markdownService.ExtractWikiLinks(note.BodyMarkdown);
        return MapToResponse(note, wikiLinks);
    }

    public async Task<PagedResult<NoteSummaryResponse>> ListAsync(NoteFilterParams filter, CancellationToken ct = default)
    {
        var query = _db.Notes
            .AsNoTracking()
            .Where(n => n.UserId == _currentUser.UserId);

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
                EF.Functions.Like(t.Value, $"%{tagSearch}%") ||
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

        var items = await query
            .OrderByDescending(n => n.UpdatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NoteSummaryResponse(
                n.Id,
                n.Level,
                n.Title,
                n.Summary,
                n.LibraryId,
                n.TypeId,
                n.IsTodo,
                n.IsTrashed,
                n.CreatedAtUtc,
                n.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return new PagedResult<NoteSummaryResponse>(items, totalCount, page, pageSize);
    }

    public async Task<NoteResult> UpdateAsync(Guid id, UpdateNoteRequest request, CancellationToken ct = default)
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
            return NoteResult.Failure("Cannot edit a trashed note. Restore it first.");

        if (string.IsNullOrWhiteSpace(request.Title))
            return NoteResult.Failure("Title is required.");

        if (request.LibraryId.HasValue && request.LibraryId != note.LibraryId)
        {
            var libraryExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.LibraryId.Value && l.UserId == userId, ct);
            if (!libraryExists)
                return NoteResult.Failure("Library not found.");
        }

        var tagValidationError = await ValidateTagsAsync(userId, note.Level, request.Tags, ct);
        if (tagValidationError != null)
            return NoteResult.Failure(tagValidationError);

        var body = request.BodyMarkdown ?? string.Empty;

        if (note.Level == NoteLevel.Journal)
        {
            var typeDef = await _db.TypeDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == note.TypeId && t.UserId == userId, ct);

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

        var (renderedHtml, wikiLinks) = await RenderWithWikiLinkResolutionAsync(userId, body, ct);

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

            foreach (var tag in request.Tags)
            {
                _db.NoteTags.Add(new NoteTag
                {
                    NoteId = note.Id,
                    TagType = note.Level == NoteLevel.Quick ? TagType.FreeForm : tag.TagType,
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim().ToLowerInvariant(),
                    Value = tag.Value.Trim(),
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        return NoteResult.Success(MapToResponse(note, wikiLinks));
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

    // Phase 3: Note Promotion (NOTE-006, NOTE-007, NOTE-008, NOTE-009)
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

        // NOTE-009: Unidirectional progression only
        if (request.TargetLevel <= note.Level)
            return NoteResult.Failure($"Cannot demote or promote to current level (current: {note.Level}, requested: {request.TargetLevel}).");

        TypeDefinition? typeDef = null;
        if (request.TargetLevel == NoteLevel.Journal)
        {
            if (!request.TypeId.HasValue)
                return NoteResult.Failure("Promotion to Journal requires a TypeId (NOTE-004).");

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
        var tagError = await ValidateTagsAsync(userId, request.TargetLevel, tagsToValidate, ct);
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

            foreach (var tag in request.Tags)
            {
                _db.NoteTags.Add(new NoteTag
                {
                    NoteId = note.Id,
                    TagType = request.TargetLevel == NoteLevel.Quick ? TagType.FreeForm : tag.TagType,
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim().ToLowerInvariant(),
                    Value = tag.Value.Trim(),
                });
            }
        }

        note.Level = request.TargetLevel;
        await _db.SaveChangesAsync(ct);

        var wikiLinks = _markdownService.ExtractWikiLinks(note.BodyMarkdown);
        return NoteResult.Success(MapToResponse(note, wikiLinks));
    }

    // Phase 3: Sources Management (SRC-001)
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

    // Phase 3: Relations Management (INBOX-003, VAL-003, TYPE-008)
    public async Task<NoteResult> AddRelationAsync(Guid noteId, CreateNoteRelationRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var sourceNote = await _db.Notes
            .FirstOrDefaultAsync(n => n.Id == noteId && n.UserId == userId, ct);

        if (sourceNote is null)
            return NoteResult.NotFound("Source note not found.");

        // INBOX-003: Inbox Notes shall not define explicit outbound relations
        if (sourceNote.Level == NoteLevel.Inbox)
            return NoteResult.Failure("Inbox notes cannot define explicit outbound relations (INBOX-003). Promote the note first.");

        if (request.TargetNoteId == noteId)
            return NoteResult.Failure("A note cannot define a relation to itself.");

        if (string.IsNullOrWhiteSpace(request.Role))
            return NoteResult.Failure("Relation role is required.");

        // VAL-003: Target note must exist and belong to user
        var targetNote = await _db.Notes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == request.TargetNoteId && n.UserId == userId, ct);

        if (targetNote is null)
            return NoteResult.Failure("Target note not found or belongs to another user (VAL-003).");

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
            .Include(n => n.OutboundRelations)
                .ThenInclude(r => r.TargetNote)
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == _currentUser.UserId && !n.IsTrashed, ct);

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
        var wikiLinks = _markdownService.ExtractWikiLinks(note.BodyMarkdown);
        return MapToResponse(note, wikiLinks);
    }

    public async Task<TodoSummaryResponse> GetTodoSummaryAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var pendingQuery = _db.Notes
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsTrashed && n.IsTodo && (n.Level == NoteLevel.Quick || n.Level == NoteLevel.Journal));

        var completedQuery = _db.Notes
            .AsNoTracking()
            .Where(n => n.UserId == userId && !n.IsTrashed && !n.IsTodo && n.TodoCompletedAtUtc != null && (n.Level == NoteLevel.Quick || n.Level == NoteLevel.Journal));

        var pendingCount = await pendingQuery.CountAsync(ct);
        var completedCount = await completedQuery.CountAsync(ct);

        var pendingNotes = await pendingQuery
            .OrderByDescending(n => n.UpdatedAtUtc)
            .Take(50)
            .Select(n => new NoteSummaryResponse(n.Id, n.Level, n.Title, n.Summary, n.LibraryId, n.TypeId, n.IsTodo, n.IsTrashed, n.CreatedAtUtc, n.UpdatedAtUtc))
            .ToListAsync(ct);

        var completedNotes = await completedQuery
            .OrderByDescending(n => n.TodoCompletedAtUtc)
            .Take(20)
            .Select(n => new NoteSummaryResponse(n.Id, n.Level, n.Title, n.Summary, n.LibraryId, n.TypeId, n.IsTodo, n.IsTrashed, n.CreatedAtUtc, n.UpdatedAtUtc))
            .ToListAsync(ct);

        return new TodoSummaryResponse(pendingCount, completedCount, pendingNotes, completedNotes);
    }

    private async Task<string?> ValidateTagsAsync(Guid userId, NoteLevel level, List<TagDto>? tags, CancellationToken ct)
    {
        if (tags is null || tags.Count == 0) return null;

        if (level == NoteLevel.Quick && tags.Any(t => t.TagType == TagType.Typed))
            return "Quick notes only support FreeForm tags (QUICK-003).";

        var typedTags = tags.Where(t => t.TagType == TagType.Typed).ToList();
        if (typedTags.Count > 0)
        {
            var categories = typedTags
                .Select(t => t.Category?.Trim().ToLowerInvariant())
                .Where(c => !string.IsNullOrEmpty(c))
                .Distinct()
                .ToList();

            var definitions = await _db.TagDefinitions
                .AsNoTracking()
                .Where(td => td.UserId == userId && categories.Contains(td.Category))
                .ToDictionaryAsync(td => td.Category, ct);

            foreach (var tag in typedTags)
            {
                var cat = tag.Category?.Trim().ToLowerInvariant();
                if (string.IsNullOrEmpty(cat) || !definitions.TryGetValue(cat, out var def))
                    return $"Tag category '{tag.Category}' is not defined.";

                if (!string.IsNullOrWhiteSpace(def.AllowedValuesJson))
                {
                    try
                    {
                        var allowed = System.Text.Json.JsonSerializer.Deserialize<string[]>(def.AllowedValuesJson);
                        if (allowed != null && !allowed.Contains(tag.Value.Trim(), StringComparer.OrdinalIgnoreCase))
                        {
                            return $"Tag value '{tag.Value}' is not in the allowed vocabulary for category '{cat}'. Allowed: {string.Join(", ", allowed)}";
                        }
                    }
                    catch { }
                }
            }
        }

        return null;
    }

    private async Task<(string RenderedHtml, IReadOnlyList<string> WikiLinks)> RenderWithWikiLinkResolutionAsync(
        Guid userId, string bodyMarkdown, CancellationToken ct)
    {
        var wikiLinks = _markdownService.ExtractWikiLinks(bodyMarkdown);
        Dictionary<string, Guid>? resolvedLinks = null;

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
            }
        }

        var renderResult = _markdownService.Render(bodyMarkdown, resolvedLinks);
        return (renderResult.RenderedHtml, wikiLinks);
    }

    private static NoteResponse MapToResponse(Note note, IReadOnlyList<string> wikiLinks) =>
        new(
            note.Id,
            note.UserId,
            note.Level,
            note.Title,
            note.Summary,
            note.BodyMarkdown,
            note.RenderedHtml,
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
            Sources: note.Sources.Select(s => new NoteSourceResponse(
                s.Id, s.NoteId, s.Title, s.Description, s.Url, s.CreatedAtUtc, s.UpdatedAtUtc)).ToList(),
            OutboundRelations: note.OutboundRelations.Select(r => new NoteRelationResponse(
                r.Id, r.SourceNoteId, r.TargetNoteId, r.TargetNote?.Title ?? string.Empty, r.Role, r.Context, r.CreatedAtUtc, r.UpdatedAtUtc)).ToList()
        );
}
