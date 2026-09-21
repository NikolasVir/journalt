namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class TypeDefinition : BaseEntity
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    public string? Description { get; set; }
    public string SchemaJson { get; set; } = "{}";
    public string? SectionsJson { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Note> Notes { get; set; } = [];
}
