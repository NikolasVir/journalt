namespace JournalT.Application.Types.DTOs;

public record TypeDefinitionResult(
    bool Succeeded,
    TypeDefinitionResponse? TypeDefinition = null,
    int StatusCode = 200,
    string[] Errors = null!
)
{
    public string[] Errors { get; init; } = Errors ?? [];

    public static TypeDefinitionResult Success(TypeDefinitionResponse typeDef, int statusCode = 200) =>
        new(true, typeDef, statusCode);

    public static TypeDefinitionResult Failure(string error, int statusCode = 400) =>
        new(false, null, statusCode, [error]);

    public static TypeDefinitionResult Failure(IEnumerable<string> errors, int statusCode = 400) =>
        new(false, null, statusCode, errors.ToArray());

    public static TypeDefinitionResult NotFound(string error = "Type definition not found.") =>
        new(false, null, 404, [error]);

    public static TypeDefinitionResult Conflict(string error) =>
        new(false, null, 409, [error]);
}
