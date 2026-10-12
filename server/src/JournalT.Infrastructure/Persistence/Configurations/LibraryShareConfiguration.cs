namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using JournalT.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class LibraryShareConfiguration : IEntityTypeConfiguration<LibraryShare>
{
    public void Configure(EntityTypeBuilder<LibraryShare> builder)
    {
        builder.ToTable("LibraryShares");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.UserId)
            .IsRequired();

        builder.HasOne(s => s.Library)
            .WithMany(l => l.Shares)
            .HasForeignKey(s => s.LibraryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.LibraryId, s.UserId })
            .IsUnique();
        builder.HasIndex(s => s.UserId);
    }
}
