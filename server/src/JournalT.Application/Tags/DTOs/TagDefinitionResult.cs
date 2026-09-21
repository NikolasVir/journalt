namespace JournalT.Application.Tags.DTOs;

public sealed class TagDefinitionResult
{
    private TagDefinitionResult() { }

    public bool Succeeded { get; private init; }
    public TagDefinitionResponse? TagDefinition { get; private init; }
    public string[] Errors { get; private init; } = [];
    public int StatusCode { get; private init; } = 200;

    public static TagDefinitionResult Success(TagDefinitionResponse tagDefinition, int statusCode = 200) =>
        new() { Succeeded = true, TagDefinition = tagDefinition, StatusCode = statusCode };

    public static TagDefinitionResult NotFound(string error = "Tag definition not found.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 404 };

    public static TagDefinitionResult Failure(string error, int statusCode = 400) =>
        new() { Succeeded = false, Errors = [error], StatusCode = statusCode };

    public static TagDefinitionResult Failure(IEnumerable<string> errors, int statusCode = 400) =>
        new() { Succeeded = false, Errors = errors.ToArray(), StatusCode = statusCode };
}
