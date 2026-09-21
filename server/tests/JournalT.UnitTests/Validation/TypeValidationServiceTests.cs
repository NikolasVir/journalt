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
                "rating": { "type": "integer", "minimum": 1, "maximum": 5 },
                "status": { "type": "string", "enum": ["draft", "published"] }
            },
            "required": ["author", "status"],
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
    public void ValidateTypeDefinition_ValidSchemaAndSections_ReturnsSuccess()
    {
        var result = _sut.ValidateTypeDefinition(SimpleSchema, SimpleSections);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ValidateTypeDefinition_MalformedSchema_ReturnsError()
    {
        var result = _sut.ValidateTypeDefinition("{ invalid json", null);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "InvalidJsonSchema");
    }

    [Fact]
    public void ValidateTypeDefinition_EmptySchema_ReturnsError()
    {
        var result = _sut.ValidateTypeDefinition("", null);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "EmptySchema");
    }

    [Fact]
    public void ValidateTypeDefinition_InvalidSectionLevel_ReturnsError()
    {
        var invalidSections = """
            [
                { "heading": "Too Deep", "level": 7, "required": true }
            ]
            """;

        var result = _sut.ValidateTypeDefinition(SimpleSchema, invalidSections);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "InvalidSectionLevel");
    }

    [Fact]
    public void ValidateNoteMetadata_ConformingPayload_ReturnsSuccess()
    {
        var metadata = """
            {
                "author": "Alice",
                "rating": 5,
                "status": "published"
            }
            """;

        var result = _sut.ValidateNoteMetadata(metadata, SimpleSchema);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ValidateNoteMetadata_MissingRequiredProperty_ReturnsError()
    {
        var metadata = """
            {
                "author": "Alice"
            }
            """;

        var result = _sut.ValidateNoteMetadata(metadata, SimpleSchema);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "required");
    }

    [Fact]
    public void ValidateNoteMetadata_UnknownPropertyRejected()
    {
        var metadata = """
            {
                "author": "Alice",
                "status": "draft",
                "unknownField": "unexpected"
            }
            """;

        var result = _sut.ValidateNoteMetadata(metadata, SimpleSchema);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "additionalProperties");
    }

    [Fact]
    public void ValidateNoteMetadata_InvalidType_ReturnsError()
    {
        var metadata = """
            {
                "author": 12345,
                "status": "draft"
            }
            """;

        var result = _sut.ValidateNoteMetadata(metadata, SimpleSchema);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "type");
    }

    [Fact]
    public void ValidateNoteSections_ValidMarkdownBody_ReturnsSuccess()
    {
        var body = """
            ## Summary
            This is the overview.

            ## Details
            Point 1.

            ## Details
            Point 2.

            ## Action Items
            - Do this.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ValidateNoteSections_MissingRequiredSection_ReturnsError()
    {
        var body = """
            ## Summary
            Only summary provided.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "MissingRequiredSection" && e.Message.Contains("Action Items"));
    }

    [Fact]
    public void ValidateNoteSections_DuplicateNonRepeatableSection_ReturnsError()
    {
        var body = """
            ## Summary
            First summary.

            ## Summary
            Second summary.

            ## Action Items
            Tasks.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "DuplicateSection" && e.Message.Contains("Summary"));
    }

    [Fact]
    public void ValidateNoteSections_OutOfOrderSection_ReturnsError()
    {
        var body = """
            ## Action Items
            Tasks before summary.

            ## Summary
            Summary at the end.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "SectionOutOfOrder");
    }

    [Fact]
    public void ValidateNoteMetadata_NestedObjectAndArray_EnforcesSchemaRules()
    {
        const string nestedSchema = """
            {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "properties": {
                    "contact": {
                        "type": "object",
                        "properties": {
                            "email": { "type": "string" }
                        },
                        "required": ["email"],
                        "additionalProperties": false
                    },
                    "tags": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1
                    }
                },
                "required": ["contact", "tags"],
                "additionalProperties": false
            }
            """;

        var validMetadata = """
            {
                "contact": { "email": "test@example.com" },
                "tags": ["tech", "dotnet"]
            }
            """;

        var invalidMetadata = """
            {
                "contact": { "email": "test@example.com", "phone": "123" },
                "tags": []
            }
            """;

        var validResult = _sut.ValidateNoteMetadata(validMetadata, nestedSchema);
        var invalidResult = _sut.ValidateNoteMetadata(invalidMetadata, nestedSchema);

        Assert.True(validResult.IsValid);
        Assert.False(invalidResult.IsValid);
        Assert.Contains(invalidResult.Errors, e => e.ErrorCode == "additionalProperties"); // "phone" rejected
        Assert.Contains(invalidResult.Errors, e => e.ErrorCode == "minItems"); // empty tags rejected
    }

    [Fact]
    public void ValidateNoteSections_CaseInsensitiveAndFreeformSubheadings_Passes()
    {
        var body = """
            ## summary
            Overview.

            ### Custom Subheading Not In Definition
            This should be allowed and ignored by section checks.

            ## ACTION ITEMS
            Task 1.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ValidateNoteSections_HeadingsInsideCodeBlocks_IgnoredByValidator()
    {
        var body = """
            ```markdown
            ## Summary
            ## Action Items
            ```
            No actual headings outside the code block.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.False(result.IsValid);
        Assert.Equal(2, result.Errors.Count);
        Assert.Contains(result.Errors, e => e.ErrorCode == "MissingRequiredSection" && e.Message.Contains("Summary"));
        Assert.Contains(result.Errors, e => e.ErrorCode == "MissingRequiredSection" && e.Message.Contains("Action Items"));
    }

    [Fact]
    public void ValidateNoteSections_HeadingWithInlineFormattingAndTrailingHashes_Matches()
    {
        var body = """
            ## **Summary** ##
            Overview.

            ## `Action Items`
            Tasks.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ValidateNoteSections_SkippedOptionalSectionInMiddle_Passes()
    {
        var body = """
            ## Summary
            Overview.

            ## Action Items
            Details was skipped because it is optional.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ValidateNoteSections_InterleavedRepeatableSection_FailsSequenceOrder()
    {
        var body = """
            ## Details
            First details.

            ## Summary
            Summary in middle.

            ## Details
            Details again.

            ## Action Items
            Tasks.
            """;

        var result = _sut.ValidateNoteSections(body, SimpleSections);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "SectionOutOfOrder" && e.Message.Contains("Summary"));
    }

    [Fact]
    public void ValidateNoteMetadata_MalformedJsonWithCommentsOrTrailingCommas_FailsWithInvalidJson()
    {
        var metadataWithComments = """
            {
                // This comment is invalid in strict JSON
                "author": "Alice",
                "status": "draft",
            }
            """;

        var result = _sut.ValidateNoteMetadata(metadataWithComments, SimpleSchema);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorCode == "InvalidJson");
    }

    [Fact]
    public void ValidateNoteSections_MultipleMissingRequiredSections_ReportsAllErrors()
    {
        var emptyBody = "Just random text without any headings.";

        var result = _sut.ValidateNoteSections(emptyBody, SimpleSections);

        Assert.False(result.IsValid);
        Assert.Equal(2, result.Errors.Count);
        Assert.Contains(result.Errors, e => e.ErrorCode == "MissingRequiredSection" && e.Message.Contains("Summary"));
        Assert.Contains(result.Errors, e => e.ErrorCode == "MissingRequiredSection" && e.Message.Contains("Action Items"));
    }
}
