namespace JournalT.Application.Notes.DTOs;

public sealed record NoteRelationResponse(
    Guid Id,
    Guid SourceNoteId,
    Guid TargetNoteId,
    string TargetNoteTitle,
    string Role,
    string? Context,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
