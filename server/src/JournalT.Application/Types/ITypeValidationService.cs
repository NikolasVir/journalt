namespace JournalT.Application.Types;

using JournalT.Application.Common.Models;

public interface ITypeValidationService
{
    ValidationResult ValidateTypeDefinition(string schemaJson, string? sectionsJson);
    ValidationResult ValidateNoteMetadata(string metadataJson, string schemaJson);
    ValidationResult ValidateNoteSections(string bodyMarkdown, string? sectionsJson);
}
