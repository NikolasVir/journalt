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

            if (request.Tags != null && request.Tags.Any(t => t.TagType == TagType.Typed))
                return NoteResult.Failure("Quick notes only support FreeForm tags.");
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

        // Library existence check
        if (request.LibraryId.HasValue)
        {
            var libraryExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.LibraryId.Value && l.UserId == userId, ct);
            if (!libraryExists)
                return NoteResult.Failure("Library not found.");
        }

        var body = request.BodyMarkdown ?? string.Empty;
        var renderResult = _markdownService.Render(body);

        var note = new Note
        {
            UserId = userId,
            Level = request.Level,
            Title = request.Title.Trim(),
            Summary = string.IsNullOrWhiteSpace(request.Summary) ? null : request.Summary.Trim(),
            BodyMarkdown = body,
            RenderedHtml = renderResult.RenderedHtml,
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
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim(),
                    Value = tag.Value.Trim(),
                });
            }
        }

        _db.Notes.Add(note);
        await _db.SaveChangesAsync(ct);

        var wikiLinks = _markdownService.ExtractWikiLinks(note.BodyMarkdown);
        return NoteResult.Success(MapToResponse(note, wikiLinks), 201);
    }

    public async Task<NoteResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var note = await _db.Notes
            .AsNoTracking()
            .Include(n => n.Tags)
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == _currentUser.UserId, ct);

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

        if (filter.IsTodo.HasValue)
            query = query.Where(n => n.IsTodo == filter.IsTodo.Value);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim();
            query = query.Where(n => EF.Functions.Like(n.Title, $"%{search}%") ||
                                     (n.Summary != null && EF.Functions.Like(n.Summary, $"%{search}%")));
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
        var note = await _db.Notes
            .Include(n => n.Tags)
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == _currentUser.UserId, ct);

        if (note is null)
            return NoteResult.NotFound();

        if (note.IsTrashed)
            return NoteResult.Failure("Cannot edit a trashed note. Restore it first.");

        if (string.IsNullOrWhiteSpace(request.Title))
            return NoteResult.Failure("Title is required.");

        if (request.LibraryId.HasValue && request.LibraryId != note.LibraryId)
        {
            var libraryExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.LibraryId.Value && l.UserId == _currentUser.UserId, ct);
            if (!libraryExists)
                return NoteResult.Failure("Library not found.");
        }

        var body = request.BodyMarkdown ?? string.Empty;

        if (note.Level == NoteLevel.Journal)
        {
            var typeDef = await _db.TypeDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == note.TypeId && t.UserId == _currentUser.UserId, ct);

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
        else if (note.Level == NoteLevel.Quick)
        {
            if (request.Tags != null && request.Tags.Any(t => t.TagType == TagType.Typed))
                return NoteResult.Failure("Quick notes only support FreeForm tags.");
        }

        var renderResult = _markdownService.Render(body);

        note.Title = request.Title.Trim();
        note.Summary = string.IsNullOrWhiteSpace(request.Summary) ? null : request.Summary.Trim();
        note.BodyMarkdown = body;
        note.RenderedHtml = renderResult.RenderedHtml;
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
            note.Tags.Clear();
            foreach (var tag in request.Tags)
            {
                note.Tags.Add(new NoteTag
                {
                    NoteId = note.Id,
                    TagType = note.Level == NoteLevel.Quick ? TagType.FreeForm : tag.TagType,
                    Category = string.IsNullOrWhiteSpace(tag.Category) ? null : tag.Category.Trim(),
                    Value = tag.Value.Trim(),
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        var wikiLinks = _markdownService.ExtractWikiLinks(note.BodyMarkdown);
        return NoteResult.Success(MapToResponse(note, wikiLinks));
    }

    public async Task<bool> TrashAsync(Guid id, CancellationToken ct = default)
    {
        var rows = await _db.Notes
            .Where(n => n.Id == id && n.UserId == _currentUser.UserId && !n.IsTrashed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(n => n.IsTrashed, true)
                .SetProperty(n => n.TrashedAtUtc, DateTime.UtcNow), ct);

        return rows > 0;
    }

    public async Task<bool> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var rows = await _db.Notes
            .Where(n => n.Id == id && n.UserId == _currentUser.UserId && n.IsTrashed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(n => n.IsTrashed, false)
                .SetProperty(n => n.TrashedAtUtc, (DateTime?)null), ct);

        return rows > 0;
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
            wikiLinks
        );
}
