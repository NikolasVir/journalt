namespace JournalT.Application.Types.DTOs;

public sealed class TypeMigrationResult
{
    private TypeMigrationResult() { }

    public bool Succeeded { get; private init; }
    public IReadOnlyList<Guid> MigratedNoteIds { get; private init; } = [];
    public IReadOnlyList<string> Errors { get; private init; } = [];
    public int StatusCode { get; private init; } = 200;

    public static TypeMigrationResult Success(IReadOnlyList<Guid> migratedIds) =>
        new() { Succeeded = true, MigratedNoteIds = migratedIds };

    public static TypeMigrationResult Failure(string error, int statusCode = 400) =>
        new() { Succeeded = false, Errors = [error], StatusCode = statusCode };

    public static TypeMigrationResult NotFound(string error = "Type definition not found.") =>
        new() { Succeeded = false, Errors = [error], StatusCode = 404 };
}
