namespace JournalT.Application.Auth.DTOs;

/// <summary>
/// Represents the outcome of an authentication operation.
/// Uses factory methods to prevent invalid states.
/// </summary>
public sealed class AuthResult
{
    private AuthResult() { }

    public bool Succeeded { get; private init; }
    public UserResponse? User { get; private init; }
    public string[] Errors { get; private init; } = [];

    public static AuthResult Success(UserResponse user) =>
        new() { Succeeded = true, User = user };

    public static AuthResult Failure(params string[] errors) =>
        new() { Succeeded = false, Errors = errors };
}
