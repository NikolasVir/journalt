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
    public DbSet<NoteRelation> NoteRelations => Set<NoteRelation>();
    public DbSet<NoteSource> NoteSources => Set<NoteSource>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Rename AspNetUsers to Users to match schema/db.md
        builder.Entity<AppUser>().ToTable("Users");

        // Apply entity configurations from current assembly
        builder.ApplyConfigurationsFromAssembly(typeof(JournalTDbContext).Assembly);
    }
}
