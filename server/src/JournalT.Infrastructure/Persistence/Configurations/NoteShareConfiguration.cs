namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using JournalT.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class NoteShareConfiguration : IEntityTypeConfiguration<NoteShare>
{
    public void Configure(EntityTypeBuilder<NoteShare> builder)
    {
        builder.ToTable("NoteShares");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.UserId)
            .IsRequired();

        builder.HasOne(s => s.Note)
            .WithMany(n => n.Shares)
            .HasForeignKey(s => s.NoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.NoteId, s.UserId })
            .IsUnique();
        builder.HasIndex(s => s.UserId);
    }
}
