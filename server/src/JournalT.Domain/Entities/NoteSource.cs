namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class NoteSource : BaseEntity
{
    public Guid NoteId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Url { get; set; }

    public Note Note { get; set; } = null!;
}
