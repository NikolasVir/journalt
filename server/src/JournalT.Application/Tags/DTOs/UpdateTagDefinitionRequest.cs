namespace JournalT.Application.Tags.DTOs;

public sealed record UpdateTagDefinitionRequest(
    string? AllowedValuesJson = null
);
