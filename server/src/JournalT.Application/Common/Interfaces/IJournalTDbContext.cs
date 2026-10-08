namespace JournalT.Application.Common.Interfaces;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;

public interface IJournalTDbContext
{
    DbSet<Note> Notes { get; }
    DbSet<Library> Libraries { get; }
    DbSet<TypeDefinition> TypeDefinitions { get; }
    DbSet<NoteTag> NoteTags { get; }
    DbSet<TagDefinition> TagDefinitions { get; }
    DbSet<NoteRelation> NoteRelations { get; }
    DbSet<NoteSource> NoteSources { get; }
    DbSet<NoteShare> NoteShares { get; }
    DbSet<ApiKey> ApiKeys { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
