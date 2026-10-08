namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

public sealed record CreateNoteRequest(
    string Title,
    NoteLevel Level = NoteLevel.Inbox,
    string? BodyMarkdown = null,
    string? Summary = null,
    Guid? LibraryId = null,
    Guid? TypeId = null,
    string? TypedMetadataJson = null,
    bool IsTodo = false,
    List<TagDto>? Tags = null,
    NoteFormat Format = NoteFormat.Markdown
);
