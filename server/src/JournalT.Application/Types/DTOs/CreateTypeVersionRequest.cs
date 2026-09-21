namespace JournalT.Application.Types.DTOs;

public record CreateTypeVersionRequest(
    string? Description = null,
    string? SchemaJson = null,
    string? SectionsJson = null
);
