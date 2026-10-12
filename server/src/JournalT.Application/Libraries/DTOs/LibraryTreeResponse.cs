namespace JournalT.Application.Libraries.DTOs;

public sealed record LibraryTreeResponse(
    Guid Id,
    Guid? ParentLibraryId,
    string Name,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    IReadOnlyList<LibraryTreeResponse> Children,
    int NotesCount = 0,
    bool IsOwner = true,
    bool IsShared = false,
    string? OwnerUserName = null,
    Guid? OwnerId = null
);
