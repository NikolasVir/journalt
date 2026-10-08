namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

public sealed record NoteSummaryResponse(
    Guid Id,
    NoteLevel Level,
    string Title,
    string? Summary,
    string? BodyMarkdown,
    string? RenderedHtml,
    Guid? LibraryId,
    Guid? TypeId,
    bool IsTodo,
    DateTime? TodoCompletedAtUtc,
    bool IsTrashed,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    IReadOnlyList<TagDto>? Tags = null,
    string? TypedMetadataJson = null,
    NoteFormat Format = NoteFormat.Markdown,
    Guid UserId = default,
    bool IsOwner = true,
    bool IsShared = false,
    string? OwnerUserName = null
);
