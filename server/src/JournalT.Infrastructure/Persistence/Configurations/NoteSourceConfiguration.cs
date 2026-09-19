namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class NoteSourceConfiguration : IEntityTypeConfiguration<NoteSource>
{
    public void Configure(EntityTypeBuilder<NoteSource> builder)
    {
        builder.ToTable("NoteSources");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Title)
            .IsRequired()
            .HasMaxLength(300);

        builder.Property(s => s.Description)
            .HasMaxLength(2000);

        builder.Property(s => s.Url)
            .HasMaxLength(2048);

        builder.HasOne(s => s.Note)
            .WithMany(n => n.Sources)
            .HasForeignKey(s => s.NoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.NoteId);
    }
}
