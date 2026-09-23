namespace JournalT.Application.Tags.DTOs;

public sealed record TagDefinitionResponse(
    Guid Id,
    string Category,
    string? AllowedValuesJson,
    string? KnownValuesJson,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
