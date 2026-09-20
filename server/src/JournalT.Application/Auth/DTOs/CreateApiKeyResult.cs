namespace JournalT.Application.Auth.DTOs;

/// <summary>
/// Represents the outcome of an API key creation operation.
/// </summary>
public sealed class CreateApiKeyResult
{
    private CreateApiKeyResult() { }

    public bool Succeeded { get; private init; }
    public ApiKeyCreatedResponse? ApiKey { get; private init; }
    public string? Error { get; private init; }

    public static CreateApiKeyResult Success(ApiKeyCreatedResponse apiKey) =>
        new() { Succeeded = true, ApiKey = apiKey };

    public static CreateApiKeyResult Failure(string error) =>
        new() { Succeeded = false, Error = error };
}
