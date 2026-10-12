namespace JournalT.Application.Libraries.DTOs;

public sealed record LibraryShareUserDto(
    Guid UserId,
    string UserName,
    DateTime SharedAtUtc
);

public sealed record LibrarySharesResponse(
    Guid LibraryId,
    Guid OwnerId,
    string OwnerUserName,
    bool IsOwner,
    IReadOnlyList<LibraryShareUserDto> Shares
);

public sealed record ShareLibraryRequest(
    string? UserName = null,
    Guid? UserId = null
);

public sealed class ShareLibraryResult
{
    private ShareLibraryResult() { }

    public bool Succeeded { get; private init; }
    public LibrarySharesResponse? Shares { get; private init; }
    public string[] Errors { get; private init; } = [];
    public int StatusCode { get; private init; } = 200;

    public static ShareLibraryResult Success(LibrarySharesResponse shares, int statusCode = 200) =>
        new() { Succeeded = true, Shares = shares, StatusCode = statusCode };

    public static ShareLibraryResult Success(int statusCode = 200) =>
        new() { Succeeded = true, StatusCode = statusCode };

    public static ShareLibraryResult NotFound(string error = "Library not found.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 404 };

    public static ShareLibraryResult Forbidden(string error = "You do not have permission to modify sharing for this library.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 403 };

    public static ShareLibraryResult Conflict(string error = "Library is already shared with this user.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 409 };

    public static ShareLibraryResult Failure(string error, int statusCode = 400) =>
        new() { Succeeded = false, Errors = [error], StatusCode = statusCode };

    public static ShareLibraryResult Failure(IEnumerable<string> errors, int statusCode = 400) =>
        new() { Succeeded = false, Errors = errors.ToArray(), StatusCode = statusCode };
}
