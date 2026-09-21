namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class TagDefinition : BaseEntity
{
    public Guid UserId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string? AllowedValuesJson { get; set; }
}
