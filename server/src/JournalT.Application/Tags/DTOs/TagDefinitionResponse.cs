namespace JournalT.Application.Tags.DTOs;

public sealed record TagDefinitionResponse(
    Guid Id,
    string Category,
    string? AllowedValuesJson,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
