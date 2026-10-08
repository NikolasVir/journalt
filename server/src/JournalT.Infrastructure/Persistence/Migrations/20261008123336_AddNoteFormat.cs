using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JournalT.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteFormat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Format",
                table: "Notes",
                type: "TEXT",
                maxLength: 20,
                nullable: false,
                defaultValue: "Markdown");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Format",
                table: "Notes");
        }
    }
}
