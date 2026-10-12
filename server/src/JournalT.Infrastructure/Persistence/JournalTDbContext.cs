namespace JournalT.Infrastructure.Persistence;

using JournalT.Application.Common.Interfaces;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

public class JournalTDbContext : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>, IJournalTDbContext
{
    public JournalTDbContext(DbContextOptions<JournalTDbContext> options)
        : base(options)
    {
    }

    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Library> Libraries => Set<Library>();
    public DbSet<TypeDefinition> TypeDefinitions => Set<TypeDefinition>();
    public DbSet<NoteTag> NoteTags => Set<NoteTag>();
    public DbSet<TagDefinition> TagDefinitions => Set<TagDefinition>();
    public DbSet<NoteRelation> NoteRelations => Set<NoteRelation>();
    public DbSet<NoteSource> NoteSources => Set<NoteSource>();
    public DbSet<NoteShare> NoteShares => Set<NoteShare>();
    public DbSet<LibraryShare> LibraryShares => Set<LibraryShare>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<VaultNote> VaultNotes => Set<VaultNote>();
    public DbSet<VaultCanary> VaultCanaries => Set<VaultCanary>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Rename AspNetUsers to Users to match schema/db.md
        builder.Entity<AppUser>().ToTable("Users");

        // Apply entity configurations from current assembly
        builder.ApplyConfigurationsFromAssembly(typeof(JournalTDbContext).Assembly);
    }
}
