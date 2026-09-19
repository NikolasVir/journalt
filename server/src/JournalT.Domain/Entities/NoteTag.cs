namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;
using JournalT.Domain.Enums;

public class NoteTag : BaseEntity
{
    public Guid NoteId { get; set; }
    public TagType TagType { get; set; }
    public string? Category { get; set; }
    public string Value { get; set; } = string.Empty;

    public Note Note { get; set; } = null!;
}
