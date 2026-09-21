namespace JournalT.Infrastructure.Persistence.Configurations;

using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class TagDefinitionConfiguration : IEntityTypeConfiguration<TagDefinition>
{
    public void Configure(EntityTypeBuilder<TagDefinition> builder)
    {
        builder.ToTable("TagDefinitions");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.UserId)
            .IsRequired();

        builder.Property(t => t.Category)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasIndex(t => new { t.UserId, t.Category })
            .IsUnique();
    }
}
