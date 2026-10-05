namespace JournalT.Application.Types.DTOs;

public record TypeDefinitionResponse(
    Guid Id,
    string Name,
    int Version,
    string? Description,
    string SchemaJson,
    string? SectionsJson,
    bool IsActive,
    DateTime CreatedAtUtc,
    int NotesCount = 0
);

