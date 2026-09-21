namespace JournalT.Application.Libraries.DTOs;

public sealed record LibraryResponse(
    Guid Id,
    Guid? ParentLibraryId,
    string Name,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
