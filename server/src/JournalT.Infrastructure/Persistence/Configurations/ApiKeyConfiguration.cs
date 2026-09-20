namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class ApiKeyConfiguration : IEntityTypeConfiguration<ApiKey>
{
    public void Configure(EntityTypeBuilder<ApiKey> builder)
    {
        builder.ToTable("ApiKeys");

        builder.HasKey(k => k.Id);

        builder.Property(k => k.UserId)
            .IsRequired();

        builder.Property(k => k.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(k => k.KeyPrefix)
            .IsRequired()
            .HasMaxLength(16);

        builder.Property(k => k.KeyHash)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasIndex(k => k.KeyHash)
            .IsUnique();

        builder.HasIndex(k => k.UserId);

        // Partial unique index: name must be unique per user among active keys only.
        // Allows reusing a name after a key is revoked.
        builder.HasIndex(k => new { k.UserId, k.Name })
            .IsUnique()
            .HasFilter("\"IsRevoked\" = 0");
    }
}
