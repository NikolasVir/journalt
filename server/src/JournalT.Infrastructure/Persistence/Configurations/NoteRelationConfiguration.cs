namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class NoteRelationConfiguration : IEntityTypeConfiguration<NoteRelation>
{
    public void Configure(EntityTypeBuilder<NoteRelation> builder)
    {
        builder.ToTable("NoteRelations");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Role)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(r => r.Context)
            .HasMaxLength(1000);

        builder.HasOne(r => r.SourceNote)
            .WithMany(n => n.OutboundRelations)
            .HasForeignKey(r => r.SourceNoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.TargetNote)
            .WithMany(n => n.InboundRelations)
            .HasForeignKey(r => r.TargetNoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => new { r.SourceNoteId, r.TargetNoteId, r.Role })
            .IsUnique();
    }
}
