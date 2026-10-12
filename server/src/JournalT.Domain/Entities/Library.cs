namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class Library : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid? ParentLibraryId { get; set; }
    public string Name { get; set; } = string.Empty;

    public Library? ParentLibrary { get; set; }
    public ICollection<Library> SubLibraries { get; set; } = [];
    public ICollection<Note> Notes { get; set; } = [];
    public ICollection<LibraryShare> Shares { get; set; } = [];
}
