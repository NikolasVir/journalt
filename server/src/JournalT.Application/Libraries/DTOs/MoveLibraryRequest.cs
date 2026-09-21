namespace JournalT.Application.Libraries.DTOs;

public sealed record MoveLibraryRequest(
    Guid? NewParentLibraryId
);
