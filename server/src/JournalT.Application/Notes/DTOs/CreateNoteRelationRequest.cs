namespace JournalT.Application.Notes.DTOs;

public sealed record CreateNoteRelationRequest(
    Guid TargetNoteId,
    string Role,
    string? Context = null
);
