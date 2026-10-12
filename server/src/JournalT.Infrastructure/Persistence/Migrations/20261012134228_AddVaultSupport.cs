using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JournalT.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVaultSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VaultCanaries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PartitionToken = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    EncryptedCanary = table.Column<string>(type: "TEXT", nullable: false),
                    Nonce = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    AuthTag = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VaultCanaries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VaultNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PartitionToken = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    EncryptedPayload = table.Column<string>(type: "TEXT", nullable: false),
                    Nonce = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    AuthTag = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    IsPinned = table.Column<bool>(type: "INTEGER", nullable: false),
                    PinnedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VaultNotes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VaultCanaries_UserId_PartitionToken",
                table: "VaultCanaries",
                columns: new[] { "UserId", "PartitionToken" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VaultNotes_PartitionToken",
                table: "VaultNotes",
                column: "PartitionToken");

            migrationBuilder.CreateIndex(
                name: "IX_VaultNotes_UserId_PartitionToken",
                table: "VaultNotes",
                columns: new[] { "UserId", "PartitionToken" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VaultCanaries");

            migrationBuilder.DropTable(
                name: "VaultNotes");
        }
    }
}
