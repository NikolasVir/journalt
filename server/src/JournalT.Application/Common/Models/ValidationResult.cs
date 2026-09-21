namespace JournalT.Application.Common.Models;

public record ValidationError(string Path, string Message, string ErrorCode);

public class ValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public List<ValidationError> Errors { get; } = [];

    public static ValidationResult Success() => new();

    public static ValidationResult Failure(IEnumerable<ValidationError> errors)
    {
        var result = new ValidationResult();
        result.Errors.AddRange(errors);
        return result;
    }

    public static ValidationResult Failure(string path, string message, string errorCode) =>
        Failure([new(path, message, errorCode)]);

    public IDictionary<string, string[]> ToDictionary() =>
        Errors.GroupBy(e => e.Path)
              .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray());
}
