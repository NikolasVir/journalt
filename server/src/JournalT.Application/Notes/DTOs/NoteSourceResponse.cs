namespace JournalT.Application.Notes.DTOs;

public sealed record NoteSourceResponse(
    Guid Id,
    Guid NoteId,
    string Title,
    string? Description,
    string? Url,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
