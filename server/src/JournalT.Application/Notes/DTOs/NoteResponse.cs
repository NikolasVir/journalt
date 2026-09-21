namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

public sealed record NoteResponse(
    Guid Id,
    Guid UserId,
    NoteLevel Level,
    string Title,
    string? Summary,
    string BodyMarkdown,
    string RenderedHtml,
    Guid? LibraryId,
    Guid? TypeId,
    int? TypeVersion,
    string? TypedMetadataJson,
    bool IsTodo,
    DateTime? TodoCompletedAtUtc,
    bool IsTrashed,
    DateTime? TrashedAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    IReadOnlyList<TagDto> Tags,
    IReadOnlyList<string> WikiLinks,
    IReadOnlyList<NoteSourceResponse>? Sources = null,
    IReadOnlyList<NoteRelationResponse>? OutboundRelations = null
);
