namespace JournalT.Application.Types.DTOs;

/// <summary>Requests migration of specific notes to a target type version.</summary>
public sealed record TypeMigrationRequest(
    Guid TargetTypeVersionId,
    IReadOnlyList<Guid> NoteIds   // empty = migrate ALL eligible notes (bulk)
);
