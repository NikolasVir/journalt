namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;
using JournalT.Domain.Enums;

public class Note : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid? LibraryId { get; set; }
    public NoteLevel Level { get; set; }
    public Guid? TypeId { get; set; }
    public int? TypeVersion { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string BodyMarkdown { get; set; } = string.Empty;
    public string RenderedHtml { get; set; } = string.Empty;
    public string? TypedMetadataJson { get; set; }
    public bool IsTodo { get; set; }
    public DateTime? TodoCompletedAtUtc { get; set; }
    public bool IsTrashed { get; set; }
    public DateTime? TrashedAtUtc { get; set; }

    public Library? Library { get; set; }
    public TypeDefinition? Type { get; set; }
    public ICollection<NoteTag> Tags { get; set; } = [];
    public ICollection<NoteRelation> OutboundRelations { get; set; } = [];
    public ICollection<NoteRelation> InboundRelations { get; set; } = [];
    public ICollection<NoteSource> Sources { get; set; } = [];
}
