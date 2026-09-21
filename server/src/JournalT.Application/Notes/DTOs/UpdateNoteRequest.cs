namespace JournalT.Application.Notes.DTOs;

public sealed record UpdateNoteRequest(
    string Title,
    string? BodyMarkdown = null,
    string? Summary = null,
    Guid? LibraryId = null,
    string? TypedMetadataJson = null,
    bool IsTodo = false,
    List<TagDto>? Tags = null
);
