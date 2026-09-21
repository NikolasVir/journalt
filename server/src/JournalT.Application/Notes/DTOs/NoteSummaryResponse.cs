namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

public sealed record NoteSummaryResponse(
    Guid Id,
    NoteLevel Level,
    string Title,
    string? Summary,
    Guid? LibraryId,
    Guid? TypeId,
    bool IsTodo,
    bool IsTrashed,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
