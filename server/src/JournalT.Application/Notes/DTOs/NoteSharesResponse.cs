namespace JournalT.Application.Notes.DTOs;

public sealed record NoteShareUserDto(
    Guid UserId,
    string UserName,
    DateTime SharedAtUtc
);

public sealed record NoteSharesResponse(
    Guid NoteId,
    Guid OwnerId,
    string OwnerUserName,
    bool IsOwner,
    IReadOnlyList<NoteShareUserDto> Shares
);

public sealed record ShareNoteRequest(
    string? UserName = null,
    Guid? UserId = null
);

public sealed class ShareNoteResult
{
    private ShareNoteResult() { }

    public bool Succeeded { get; private init; }
    public NoteSharesResponse? Shares { get; private init; }
    public string[] Errors { get; private init; } = [];
    public int StatusCode { get; private init; } = 200;

    public static ShareNoteResult Success(NoteSharesResponse shares, int statusCode = 200) =>
        new() { Succeeded = true, Shares = shares, StatusCode = statusCode };

    public static ShareNoteResult Success(int statusCode = 200) =>
        new() { Succeeded = true, StatusCode = statusCode };

    public static ShareNoteResult NotFound(string error = "Note not found.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 404 };

    public static ShareNoteResult Forbidden(string error = "You do not have permission to modify sharing for this note.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 403 };

    public static ShareNoteResult Failure(string error, int statusCode = 400) =>
        new() { Succeeded = false, Errors = [error], StatusCode = statusCode };

    public static ShareNoteResult Failure(IEnumerable<string> errors, int statusCode = 400) =>
        new() { Succeeded = false, Errors = errors.ToArray(), StatusCode = statusCode };
}
