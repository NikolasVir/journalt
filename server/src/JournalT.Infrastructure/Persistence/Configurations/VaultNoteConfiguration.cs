namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class VaultNoteConfiguration : IEntityTypeConfiguration<VaultNote>
{
    public void Configure(EntityTypeBuilder<VaultNote> builder)
    {
        builder.ToTable("VaultNotes");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.UserId)
            .IsRequired();

        builder.Property(n => n.PartitionToken)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(n => n.EncryptedPayload)
            .IsRequired();

        builder.Property(n => n.Nonce)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(n => n.AuthTag)
            .IsRequired()
            .HasMaxLength(64);

        builder.HasIndex(n => new { n.UserId, n.PartitionToken });
        builder.HasIndex(n => n.PartitionToken);
    }
}
