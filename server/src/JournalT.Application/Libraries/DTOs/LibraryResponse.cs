namespace JournalT.Application.Libraries.DTOs;

public sealed record LibraryResponse(
    Guid Id,
    Guid? ParentLibraryId,
    string Name,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    bool IsOwner = true,
    bool IsShared = false,
    string? OwnerUserName = null,
    Guid? OwnerId = null
);
