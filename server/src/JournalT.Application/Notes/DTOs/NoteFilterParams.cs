namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

public sealed record NoteFilterParams(
    NoteLevel? Level = null,
    Guid? LibraryId = null,
    Guid? TypeId = null,
    string? Tag = null,
    bool? IsTrashed = false,
    bool? IsTodo = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 50
);
