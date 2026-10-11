namespace JournalT.Application.Libraries.DTOs;

public sealed class LibraryResult
{
    private LibraryResult() { }

    public bool Succeeded { get; private init; }
    public LibraryResponse? Library { get; private init; }
    public string[] Errors { get; private init; } = [];
    public int StatusCode { get; private init; } = 200;

    public static LibraryResult Success(LibraryResponse? library = null, int statusCode = 200) =>
        new() { Succeeded = true, Library = library, StatusCode = statusCode };

    public static LibraryResult NotFound(string error = "Library not found.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 404 };

    public static LibraryResult Conflict(string error) =>
        new() { Succeeded = false, Errors = [error], StatusCode = 409 };

    public static LibraryResult Failure(string error, int statusCode = 400) =>
        new() { Succeeded = false, Errors = [error], StatusCode = statusCode };

    public static LibraryResult Failure(IEnumerable<string> errors, int statusCode = 400) =>
        new() { Succeeded = false, Errors = errors.ToArray(), StatusCode = statusCode };
}
