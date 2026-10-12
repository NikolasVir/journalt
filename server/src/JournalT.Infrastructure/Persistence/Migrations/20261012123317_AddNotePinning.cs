using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JournalT.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotePinning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPinned",
                table: "Notes",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PinnedAtUtc",
                table: "Notes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notes_UserId_IsPinned_IsTrashed",
                table: "Notes",
                columns: new[] { "UserId", "IsPinned", "IsTrashed" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Notes_UserId_IsPinned_IsTrashed",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "IsPinned",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "PinnedAtUtc",
                table: "Notes");
        }
    }
}
