namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class NoteTagConfiguration : IEntityTypeConfiguration<NoteTag>
{
    public void Configure(EntityTypeBuilder<NoteTag> builder)
    {
        builder.ToTable("NoteTags");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.TagType)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(t => t.Category)
            .HasMaxLength(100);

        builder.Property(t => t.Value)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasOne(t => t.Note)
            .WithMany(n => n.Tags)
            .HasForeignKey(t => t.NoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.NoteId);
        builder.HasIndex(t => new { t.TagType, t.Category, t.Value });
    }
}
