namespace JournalT.Application.Notes.DTOs;

public sealed class NoteResult
{
    private NoteResult() { }

    public bool Succeeded { get; private init; }
    public NoteResponse? Note { get; private init; }
    public string[] Errors { get; private init; } = [];
    public int StatusCode { get; private init; } = 200;

    public static NoteResult Success(NoteResponse note, int statusCode = 200) =>
        new() { Succeeded = true, Note = note, StatusCode = statusCode };

    public static NoteResult NotFound(string error = "Note not found.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 404 };

    public static NoteResult Failure(string error, int statusCode = 400) =>
        new() { Succeeded = false, Errors = [error], StatusCode = statusCode };

    public static NoteResult Failure(IEnumerable<string> errors, int statusCode = 400) =>
        new() { Succeeded = false, Errors = errors.ToArray(), StatusCode = statusCode };
}
