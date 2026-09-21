namespace JournalT.Application.Notes.DTOs;

public sealed record CreateNoteSourceRequest(
    string Title,
    string? Description = null,
    string? Url = null
);
