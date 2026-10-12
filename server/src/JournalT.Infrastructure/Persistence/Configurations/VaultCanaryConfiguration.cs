namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class VaultCanaryConfiguration : IEntityTypeConfiguration<VaultCanary>
{
    public void Configure(EntityTypeBuilder<VaultCanary> builder)
    {
        builder.ToTable("VaultCanaries");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.UserId)
            .IsRequired();

        builder.Property(c => c.PartitionToken)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(c => c.EncryptedCanary)
            .IsRequired();

        builder.Property(c => c.Nonce)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(c => c.AuthTag)
            .IsRequired()
            .HasMaxLength(64);

        builder.HasIndex(c => new { c.UserId, c.PartitionToken })
            .IsUnique();
    }
}
