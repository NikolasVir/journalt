using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JournalT.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKnownTagValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "KnownValuesJson",
                table: "TagDefinitions",
                type: "TEXT",
                nullable: true);

            // Preserve values already used by open categories so they remain selectable
            // after the Journal editor stops accepting unmatched free text.
            migrationBuilder.Sql("""
                UPDATE TagDefinitions
                SET KnownValuesJson = (
                    SELECT json_group_array(known.Value)
                    FROM (
                        SELECT DISTINCT nt.Value COLLATE NOCASE
                        FROM NoteTags nt
                        INNER JOIN Notes n ON n.Id = nt.NoteId
                        WHERE nt.TagType = 'Typed'
                          AND n.UserId = TagDefinitions.UserId
                          AND nt.Category = TagDefinitions.Category
                        ORDER BY nt.Value COLLATE NOCASE
                    ) AS known
                )
                WHERE AllowedValuesJson IS NULL
                  AND EXISTS (
                      SELECT 1
                      FROM NoteTags nt
                      INNER JOIN Notes n ON n.Id = nt.NoteId
                      WHERE nt.TagType = 'Typed'
                        AND n.UserId = TagDefinitions.UserId
                        AND nt.Category = TagDefinitions.Category
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KnownValuesJson",
                table: "TagDefinitions");
        }
    }
}
