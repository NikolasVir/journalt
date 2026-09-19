namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class TypeDefinitionConfiguration : IEntityTypeConfiguration<TypeDefinition>
{
    public void Configure(EntityTypeBuilder<TypeDefinition> builder)
    {
        builder.ToTable("TypeDefinitions");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.UserId)
            .IsRequired();

        builder.Property(t => t.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(t => t.Version)
            .IsRequired();

        builder.Property(t => t.Description)
            .HasMaxLength(1000);

        builder.Property(t => t.SchemaJson)
            .IsRequired();

        builder.HasIndex(t => new { t.UserId, t.Name, t.Version })
            .IsUnique();
    }
}
