namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class NoteRelation : BaseEntity
{
    public Guid SourceNoteId { get; set; }
    public Guid TargetNoteId { get; set; }
    public string Role { get; set; } = string.Empty;
    public string? Context { get; set; }

    public Note SourceNote { get; set; } = null!;
    public Note TargetNote { get; set; } = null!;
}
