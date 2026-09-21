namespace JournalT.UnitTests.Validation;

using JournalT.Infrastructure.Validation;

public class TypeValidationServiceTests
{
    private readonly TypeValidationService _sut = new();

    private const string SimpleSchema = """
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "author": { "type": "string" },
                "rating": { "type": "integer", "minimum": 1, "maximum": 5 }
            },
            "required": ["author"],
            "additionalProperties": false
        }
        """;

    private const string SimpleSections = """
        [
            { "heading": "Summary", "level": 2, "required": true, "allowMultiple": false },
            { "heading": "Details", "level": 2, "required": false, "allowMultiple": true },
            { "heading": "Action Items", "level": 2, "required": true, "allowMultiple": false }
        ]
        """;

    [Fact]
    public void ValidateTypeDefinitionAndMetadata_ValidPayload_Succeeds()
    {
        var typeResult = _sut.ValidateTypeDefinition(SimpleSchema, SimpleSections);
        Assert.True(typeResult.IsValid);

        var validMetadata = "{\"author\": \"Alice\", \"rating\": 5}";
        var metaResult = _sut.ValidateNoteMetadata(validMetadata, SimpleSchema);
        Assert.True(metaResult.IsValid);

        var validBody = """
            ## Summary
            Overview here.
            ## Details
            Extra info.
            ## Action Items
            - Task 1
            """;
        var sectionResult = _sut.ValidateNoteSections(validBody, SimpleSections);
        Assert.True(sectionResult.IsValid);
    }

    [Fact]
    public void ValidateNoteMetadata_RejectsMissingRequiredInvalidTypeAndExtraProperties()
    {
        // Missing required property
        var missingRequired = "{\"rating\": 4}";
        var r1 = _sut.ValidateNoteMetadata(missingRequired, SimpleSchema);
        Assert.False(r1.IsValid);
        Assert.Contains(r1.Errors, e => e.ErrorCode == "required");

        // Invalid type
        var invalidType = "{\"author\": 12345}";
        var r2 = _sut.ValidateNoteMetadata(invalidType, SimpleSchema);
        Assert.False(r2.IsValid);
        Assert.Contains(r2.Errors, e => e.ErrorCode == "type");

        // Additional properties forbidden
        var extraProps = "{\"author\": \"Alice\", \"unexpected\": \"value\"}";
        var r3 = _sut.ValidateNoteMetadata(extraProps, SimpleSchema);
        Assert.False(r3.IsValid);
        Assert.Contains(r3.Errors, e => e.ErrorCode == "additionalProperties");
    }

    [Fact]
    public void ValidateNoteSections_EnforcesOrderAndRejectsMissingOrDuplicateRequiredSections()
    {
        // Missing required section
        var missingSection = "## Summary\nOnly summary.";
        var r1 = _sut.ValidateNoteSections(missingSection, SimpleSections);
        Assert.False(r1.IsValid);
        Assert.Contains(r1.Errors, e => e.ErrorCode == "MissingRequiredSection" && e.Message.Contains("Action Items"));

        // Duplicate non-repeatable section
        var duplicateSection = """
            ## Summary
            First.
            ## Summary
            Second.
            ## Action Items
            Tasks.
            """;
        var r2 = _sut.ValidateNoteSections(duplicateSection, SimpleSections);
        Assert.False(r2.IsValid);
        Assert.Contains(r2.Errors, e => e.ErrorCode == "DuplicateSection");

        // Out of order
        var outOfOrder = """
            ## Action Items
            Tasks before summary.
            ## Summary
            Summary at end.
            """;
        var r3 = _sut.ValidateNoteSections(outOfOrder, SimpleSections);
        Assert.False(r3.IsValid);
        Assert.Contains(r3.Errors, e => e.ErrorCode == "SectionOutOfOrder");
    }

    [Fact]
    public void ValidateNoteSections_HeadingsInsideCodeBlocks_Ignored()
    {
        var body = """
            ```markdown
            ## Summary
            ## Action Items
            ```
            Text without real markdown headings.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "MissingRequiredSection");
    }
}
