namespace JournalT.Application.Types.DTOs;

public record SectionDefinition(
    string Heading,
    int Level = 2,
    bool Required = true,
    bool AllowMultiple = false
);
