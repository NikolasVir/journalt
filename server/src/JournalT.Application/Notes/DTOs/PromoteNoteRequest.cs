namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

public sealed record PromoteNoteRequest(
    NoteLevel TargetLevel,
    Guid? TypeId = null,
    string? TypedMetadataJson = null,
    Guid? LibraryId = null,
    List<TagDto>? Tags = null
);
