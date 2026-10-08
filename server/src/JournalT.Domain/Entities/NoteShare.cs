namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class NoteShare : BaseEntity
{
    public Guid NoteId { get; set; }
    public Guid UserId { get; set; }

    public Note Note { get; set; } = null!;
}
