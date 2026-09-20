using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JournalT.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddApiKeyNameIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_ApiKeys_UserId_Name",
                table: "ApiKeys",
                columns: new[] { "UserId", "Name" },
                unique: true,
                filter: "\"IsRevoked\" = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ApiKeys_UserId_Name",
                table: "ApiKeys");
        }
    }
}
