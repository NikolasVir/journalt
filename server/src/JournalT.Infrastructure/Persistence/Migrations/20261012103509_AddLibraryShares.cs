using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JournalT.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryShares : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LibraryShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    LibraryId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryShares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LibraryShares_Libraries_LibraryId",
                        column: x => x.LibraryId,
                        principalTable: "Libraries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LibraryShares_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LibraryShares_LibraryId_UserId",
                table: "LibraryShares",
                columns: new[] { "LibraryId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LibraryShares_UserId",
                table: "LibraryShares",
                column: "UserId");

            // Seed existing dev shares for 'Κοινά' libraries if present
            migrationBuilder.Sql(@"
                INSERT INTO LibraryShares (Id, LibraryId, UserId, CreatedAtUtc, UpdatedAtUtc)
                SELECT 
                    'A11CE001-B0B0-4A08-BEA6-111111111111',
                    '1BC5F080-BE00-4B7C-BDB9-C49C3E88C0A9',
                    '33F48570-4BF1-44FA-8637-A742B4EA203C',
                    datetime('now'),
                    datetime('now')
                WHERE EXISTS (SELECT 1 FROM Libraries WHERE Id = '1BC5F080-BE00-4B7C-BDB9-C49C3E88C0A9')
                  AND EXISTS (SELECT 1 FROM Users WHERE Id = '33F48570-4BF1-44FA-8637-A742B4EA203C')
                  AND NOT EXISTS (SELECT 1 FROM LibraryShares WHERE LibraryId = '1BC5F080-BE00-4B7C-BDB9-C49C3E88C0A9' AND UserId = '33F48570-4BF1-44FA-8637-A742B4EA203C');
            ");

            migrationBuilder.Sql(@"
                INSERT INTO LibraryShares (Id, LibraryId, UserId, CreatedAtUtc, UpdatedAtUtc)
                SELECT 
                    'A11CE002-B0B0-4A08-BEA6-222222222222',
                    'E8693FF8-9805-4010-966C-1FA29C94CCA9',
                    '00632B64-8D05-449B-8194-1782E795EBAD',
                    datetime('now'),
                    datetime('now')
                WHERE EXISTS (SELECT 1 FROM Libraries WHERE Id = 'E8693FF8-9805-4010-966C-1FA29C94CCA9')
                  AND EXISTS (SELECT 1 FROM Users WHERE Id = '00632B64-8D05-449B-8194-1782E795EBAD')
                  AND NOT EXISTS (SELECT 1 FROM LibraryShares WHERE LibraryId = 'E8693FF8-9805-4010-966C-1FA29C94CCA9' AND UserId = '00632B64-8D05-449B-8194-1782E795EBAD');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LibraryShares");
        }
    }
}
