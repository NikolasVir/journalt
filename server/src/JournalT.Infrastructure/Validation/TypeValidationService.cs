namespace JournalT.Infrastructure.Validation;

using System.Text.Json;
using JournalT.Application.Common.Models;
using JournalT.Application.Types;
using JournalT.Application.Types.DTOs;
using Json.Schema;
using Markdig;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;

public class TypeValidationService : ITypeValidationService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ValidationResult ValidateTypeDefinition(string schemaJson, string? sectionsJson)
    {
        var errors = new List<ValidationError>();

        if (string.IsNullOrWhiteSpace(schemaJson))
        {
            errors.Add(new("SchemaJson", "SchemaJson cannot be empty.", "EmptySchema"));
        }
        else
        {
            try
            {
                var schema = JsonSchema.FromText(schemaJson);
                using var dummyDoc = JsonDocument.Parse("{}");
                _ = schema.Evaluate(dummyDoc.RootElement);
            }
            catch (Exception ex)
            {
                errors.Add(new("SchemaJson", $"Invalid JSON Schema: {ex.Message}", "InvalidJsonSchema"));
            }
        }

        if (!string.IsNullOrWhiteSpace(sectionsJson))
        {
            try
            {
                var sections = JsonSerializer.Deserialize<List<SectionDefinition>>(sectionsJson, JsonOptions);
                if (sections == null || sections.Count == 0)
                {
                    errors.Add(new("SectionsJson", "Sections configuration cannot be an empty array if provided.", "EmptySections"));
                }
                else
                {
                    for (var i = 0; i < sections.Count; i++)
                    {
                        if (string.IsNullOrWhiteSpace(sections[i].Heading))
                            errors.Add(new($"SectionsJson[{i}].Heading", "Section heading cannot be empty.", "EmptySectionHeading"));
                        if (sections[i].Level is < 1 or > 6)
                            errors.Add(new($"SectionsJson[{i}].Level", "Section level must be between 1 and 6.", "InvalidSectionLevel"));
                    }
                }
            }
            catch (Exception ex)
            {
                errors.Add(new("SectionsJson", $"Invalid sections JSON: {ex.Message}", "InvalidSectionsJson"));
            }
        }

        return errors.Count > 0 ? ValidationResult.Failure(errors) : ValidationResult.Success();
    }

    public ValidationResult ValidateNoteMetadata(string metadataJson, string schemaJson)
    {
        if (string.IsNullOrWhiteSpace(metadataJson))
            return ValidationResult.Failure("$", "Metadata cannot be empty.", "EmptyMetadata");

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(metadataJson);
        }
        catch (Exception ex)
        {
            return ValidationResult.Failure("$", $"Invalid JSON format: {ex.Message}", "InvalidJson");
        }

        using (doc)
        {
            JsonSchema schema;
            try
            {
                schema = JsonSchema.FromText(schemaJson);
            }
            catch (Exception ex)
            {
                return ValidationResult.Failure("$", $"Invalid Type schema: {ex.Message}", "InvalidSchema");
            }

            var results = schema.Evaluate(doc.RootElement, new EvaluationOptions { OutputFormat = OutputFormat.List });
            if (results.IsValid) return ValidationResult.Success();

            var errors = new List<ValidationError>();
            CollectSchemaErrors(results, errors);
            return errors.Count > 0 ? ValidationResult.Failure(errors) : ValidationResult.Success();
        }
    }

    public ValidationResult ValidateNoteSections(string bodyMarkdown, string? sectionsJson)
    {
        if (string.IsNullOrWhiteSpace(sectionsJson)) return ValidationResult.Success();

        List<SectionDefinition>? definedSections;
        try
        {
            definedSections = JsonSerializer.Deserialize<List<SectionDefinition>>(sectionsJson, JsonOptions);
        }
        catch
        {
            return ValidationResult.Failure("sections", "Failed to parse section definitions.", "InvalidSectionsDefinition");
        }

        if (definedSections == null || definedSections.Count == 0) return ValidationResult.Success();

        var document = Markdown.Parse(bodyMarkdown ?? string.Empty);
        var documentHeadings = document.Descendants<HeadingBlock>()
            .Select(h => (Heading: GetHeadingText(h), h.Level))
            .ToList();

        var errors = new List<ValidationError>();

        // Check required presence and repeatability
        foreach (var def in definedSections)
        {
            var count = documentHeadings.Count(dh => string.Equals(dh.Heading, def.Heading, StringComparison.OrdinalIgnoreCase) && dh.Level == def.Level);

            if (def.Required && count == 0)
                errors.Add(new($"sections/{def.Heading}", $"Required section '{def.Heading}' (level {def.Level}) is missing.", "MissingRequiredSection"));

            if (!def.AllowMultiple && count > 1)
                errors.Add(new($"sections/{def.Heading}", $"Section '{def.Heading}' cannot appear multiple times (found {count}).", "DuplicateSection"));
        }

        // Check sequence ordering
        var lastIndex = -1;
        foreach (var dh in documentHeadings)
        {
            var defIndex = definedSections.FindIndex(def => string.Equals(def.Heading, dh.Heading, StringComparison.OrdinalIgnoreCase) && def.Level == dh.Level);
            if (defIndex < 0) continue;

            if (defIndex < lastIndex)
                errors.Add(new($"sections/{dh.Heading}", $"Section '{dh.Heading}' appears out of order.", "SectionOutOfOrder"));
            else
                lastIndex = defIndex;
        }

        return errors.Count > 0 ? ValidationResult.Failure(errors) : ValidationResult.Success();
    }

    private static void CollectSchemaErrors(EvaluationResults results, List<ValidationError> errors)
    {
        if (results.Errors != null)
        {
            var path = results.InstanceLocation.ToString();
            var errorPath = string.IsNullOrEmpty(path) ? "$" : path;
            foreach (var (keyword, errorMsg) in results.Errors)
                errors.Add(new(errorPath, errorMsg, keyword));
        }

        if (results.Details != null)
        {
            foreach (var detail in results.Details)
                CollectSchemaErrors(detail, errors);
        }
    }

    private static string GetHeadingText(HeadingBlock h) =>
        h.Inline == null ? string.Empty : string.Concat(h.Inline.Select(ExtractText)).Trim();

    private static string ExtractText(Inline inline) => inline switch
    {
        LiteralInline l => l.Content.ToString(),
        CodeInline c => c.Content,
        ContainerInline ci => string.Concat(ci.Select(ExtractText)),
        _ => inline.ToString() ?? string.Empty
    };
}
