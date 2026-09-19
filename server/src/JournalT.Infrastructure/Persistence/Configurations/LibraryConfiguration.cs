namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class LibraryConfiguration : IEntityTypeConfiguration<Library>
{
    public void Configure(EntityTypeBuilder<Library> builder)
    {
        builder.ToTable("Libraries");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(l => l.UserId)
            .IsRequired();

        // Parent cannot be deleted if children exist
        builder.HasOne(l => l.ParentLibrary)
            .WithMany(l => l.SubLibraries)
            .HasForeignKey(l => l.ParentLibraryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Name uniqueness per parent per user
        builder.HasIndex(l => new { l.UserId, l.ParentLibraryId, l.Name })
            .IsUnique();
    }
}
