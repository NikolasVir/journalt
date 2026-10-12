namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class LibraryShare : BaseEntity
{
    public Guid LibraryId { get; set; }
    public Guid UserId { get; set; }

    public Library Library { get; set; } = null!;
}
