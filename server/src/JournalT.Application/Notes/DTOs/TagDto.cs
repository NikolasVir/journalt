namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

public sealed record TagDto(
    TagType TagType,
    string? Category,
    string? Value
);
