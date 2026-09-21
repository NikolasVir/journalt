namespace JournalT.Application.Types.DTOs;

public record CreateTypeDefinitionRequest(
    string Name,
    string? Description = null,
    string? SchemaJson = null,
    string? SectionsJson = null
);
