namespace JournalT.Domain.Common;

public interface IAuditableEntity
{
    DateTime CreatedAtUtc { get; set; }
    DateTime UpdatedAtUtc { get; set; }
}
