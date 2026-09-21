namespace JournalT.Application.Libraries.DTOs;

public sealed record CreateLibraryRequest(
    string Name,
    Guid? ParentLibraryId = null
);
