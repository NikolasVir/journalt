namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using JournalT.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.ToTable("Notes");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.UserId)
            .IsRequired();

        builder.Property(n => n.Title)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(n => n.Summary)
            .HasMaxLength(2000);

        builder.Property(n => n.BodyMarkdown)
            .IsRequired()
            .HasDefaultValue(string.Empty);

        builder.Property(n => n.RenderedHtml)
            .IsRequired()
            .HasDefaultValue(string.Empty);

        builder.Property(n => n.Level)
            .IsRequired()
            .HasConversion(
                v => v.ToString(),
                v => v == "Quick" ? NoteLevel.Note : Enum.Parse<NoteLevel>(v, true))
            .HasMaxLength(20);

        builder.HasOne(n => n.Library)
            .WithMany(l => l.Notes)
            .HasForeignKey(n => n.LibraryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(n => n.Type)
            .WithMany(t => t.Notes)
            .HasForeignKey(n => n.TypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(n => new { n.UserId, n.Level, n.IsTrashed });
        builder.HasIndex(n => new { n.UserId, n.LibraryId });
        builder.HasIndex(n => new { n.UserId, n.IsTodo, n.IsTrashed });
    }
}
