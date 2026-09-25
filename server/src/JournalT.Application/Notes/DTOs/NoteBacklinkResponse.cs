namespace JournalT.Application.Notes.DTOs;

/// <summary>
/// An inbound typed relation: another note points at this one.
/// </summary>
public sealed record NoteBacklinkResponse(
    Guid RelationId,
    Guid SourceNoteId,
    string SourceNoteTitle,
    string Role,
    string? Context
);
