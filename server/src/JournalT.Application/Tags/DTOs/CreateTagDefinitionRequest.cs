namespace JournalT.Application.Tags.DTOs;

public sealed record CreateTagDefinitionRequest(
    string Category,
    string? AllowedValuesJson = null,
    string? KnownValuesJson = null
);
