namespace JournalT.Application.Types.DTOs;

public sealed record UpdateTypeDefinitionRequest(
    string Name,
    string? Description = null,
    string? SchemaJson = null,
    string? SectionsJson = null
);
