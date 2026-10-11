namespace JournalT.Application.Libraries.DTOs;

public sealed record LibraryTreeResponse(
    Guid Id,
    Guid? ParentLibraryId,
    string Name,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    IReadOnlyList<LibraryTreeResponse> Children,
    int NotesCount = 0
);
