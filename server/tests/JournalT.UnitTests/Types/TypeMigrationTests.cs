namespace JournalT.UnitTests.Types;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Types.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Persistence;
using JournalT.Infrastructure.Types;
using JournalT.Infrastructure.Validation;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

/// <summary>Unit tests for the type migration assistant (preview + apply).</summary>
public class TypeMigrationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly JournalTDbContext _db;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly TypeDefinitionService _sut;

    public TypeMigrationTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<JournalTDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new JournalTDbContext(options);
        _db.Database.EnsureCreated();

        var currentUser = new TestCurrentUser(_userId);
        var validationService = new TypeValidationService();
        _sut = new TypeDefinitionService(_db, currentUser, validationService);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private async Task<TypeDefinition> SeedTypeAsync(string name, int version = 1,
        string schemaJson = "{}", string? sectionsJson = null)
    {
        var td = new TypeDefinition
        {
            UserId = _userId,
            Name = name,
            Version = version,
            SchemaJson = schemaJson,
            SectionsJson = sectionsJson,
            IsActive = true
        };
        _db.TypeDefinitions.Add(td);
        await _db.SaveChangesAsync();
        return td;
    }

    private async Task<Note> SeedNoteAsync(Guid typeId, int typeVersion,
        string title = "Test Note", string? metadataJson = null, string bodyMarkdown = "")
    {
        var note = new Note
        {
            UserId = _userId,
            TypeId = typeId,
            TypeVersion = typeVersion,
            Title = title,
            TypedMetadataJson = metadataJson,
            BodyMarkdown = bodyMarkdown
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();
        return note;
    }

    // ── Preview tests ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Preview_ReturnsCorrectPassAndFailItems()
    {
        // Arrange: v1 uses empty schema, v2 requires a "rating" number
        var v1 = await SeedTypeAsync("BookReview", 1, "{}");
        var v2 = await SeedTypeAsync("BookReview", 2,
            """{"type":"object","properties":{"rating":{"type":"number"}},"required":["rating"]}""");

        // Note A — has rating → should pass metadata validation
        await SeedNoteAsync(v1.Id, 1, "Passing Note", """{"rating":5}""");
        // Note B — missing required rating → should fail metadata validation
        await SeedNoteAsync(v1.Id, 1, "Failing Note", """{}""");

        // Act
        var preview = await _sut.PreviewMigrationAsync(v1.Id, v2.Id);

        // Assert
        Assert.Equal(2, preview.Count);

        var passing = preview.FirstOrDefault(p => p.NoteTitle == "Passing Note");
        Assert.NotNull(passing);
        Assert.True(passing.MetadataValid);
        Assert.Empty(passing.ValidationErrors);
        Assert.Equal(1, passing.CurrentTypeVersion);
        Assert.Equal(2, passing.TargetTypeVersion);

        var failing = preview.FirstOrDefault(p => p.NoteTitle == "Failing Note");
        Assert.NotNull(failing);
        Assert.False(failing.MetadataValid);
        Assert.NotEmpty(failing.ValidationErrors);
    }

    [Fact]
    public async Task Preview_ReturnsEmpty_WhenTargetTypeNotFound()
    {
        var v1 = await SeedTypeAsync("Article", 1);
        await SeedNoteAsync(v1.Id, 1, "Some Note");

        var preview = await _sut.PreviewMigrationAsync(v1.Id, Guid.NewGuid());

        Assert.Empty(preview);
    }

    [Fact]
    public async Task Preview_ExcludesTrashedNotes()
    {
        var v1 = await SeedTypeAsync("Task", 1);
        var v2 = await SeedTypeAsync("Task", 2);

        var note = await SeedNoteAsync(v1.Id, 1, "Trashed Note");
        note.IsTrashed = true;
        await _db.SaveChangesAsync();

        var preview = await _sut.PreviewMigrationAsync(v1.Id, v2.Id);

        Assert.Empty(preview);
    }

    // ── Migrate tests ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Migrate_AppliesTypeIdAndVersion_ToPassingNotes()
    {
        var v1 = await SeedTypeAsync("Recipe", 1, "{}");
        var v2 = await SeedTypeAsync("Recipe", 2, "{}");

        var note = await SeedNoteAsync(v1.Id, 1, "Pasta");

        var request = new TypeMigrationRequest(v2.Id, []);
        var result = await _sut.MigrateNotesAsync(v1.Id, request);

        Assert.True(result.Succeeded);
        Assert.Contains(note.Id, result.MigratedNoteIds);

        var updated = await _db.Notes.FindAsync(note.Id);
        Assert.Equal(v2.Id, updated!.TypeId);
        Assert.Equal(2, updated.TypeVersion);
    }

    [Fact]
    public async Task Migrate_SkipsInvalidNotes_AndReturnsOnlyMigratedIds()
    {
        var v1 = await SeedTypeAsync("Film", 1, "{}");
        var v2 = await SeedTypeAsync("Film", 2,
            """{"type":"object","properties":{"year":{"type":"number"}},"required":["year"]}""");

        var good = await SeedNoteAsync(v1.Id, 1, "Good Note", """{"year":2024}""");
        var bad  = await SeedNoteAsync(v1.Id, 1, "Bad Note",  """{}""");

        var request = new TypeMigrationRequest(v2.Id, []);
        var result = await _sut.MigrateNotesAsync(v1.Id, request);

        Assert.True(result.Succeeded);
        Assert.Contains(good.Id, result.MigratedNoteIds);
        Assert.DoesNotContain(bad.Id, result.MigratedNoteIds);

        // Good note should be migrated; bad note should stay on v1
        var goodNote = await _db.Notes.FindAsync(good.Id);
        Assert.Equal(v2.Id, goodNote!.TypeId);

        var badNote = await _db.Notes.FindAsync(bad.Id);
        Assert.Equal(v1.Id, badNote!.TypeId);
    }

    [Fact]
    public async Task Migrate_WithSpecificNoteIds_OnlyMigratesSelectedNotes()
    {
        var v1 = await SeedTypeAsync("Journal", 1, "{}");
        var v2 = await SeedTypeAsync("Journal", 2, "{}");

        var note1 = await SeedNoteAsync(v1.Id, 1, "Note 1");
        var note2 = await SeedNoteAsync(v1.Id, 1, "Note 2");

        var request = new TypeMigrationRequest(v2.Id, [note1.Id]);
        var result = await _sut.MigrateNotesAsync(v1.Id, request);

        Assert.True(result.Succeeded);
        Assert.Contains(note1.Id, result.MigratedNoteIds);
        Assert.DoesNotContain(note2.Id, result.MigratedNoteIds);

        var n2 = await _db.Notes.FindAsync(note2.Id);
        Assert.Equal(v1.Id, n2!.TypeId); // untouched
    }

    [Fact]
    public async Task Migrate_Fails_WhenSourceTypeNotFound()
    {
        var v2 = await SeedTypeAsync("Ghost", 2, "{}");

        var request = new TypeMigrationRequest(v2.Id, []);
        var result = await _sut.MigrateNotesAsync(Guid.NewGuid(), request);

        Assert.False(result.Succeeded);
        Assert.Equal(404, result.StatusCode);
    }

    [Fact]
    public async Task Migrate_Fails_WhenTargetTypeBelongsToDifferentName()
    {
        var v1 = await SeedTypeAsync("Poetry", 1);
        var otherType = await SeedTypeAsync("Prose", 1);

        var request = new TypeMigrationRequest(otherType.Id, []);
        var result = await _sut.MigrateNotesAsync(v1.Id, request);

        Assert.False(result.Succeeded);
        Assert.Equal(400, result.StatusCode);
        Assert.Contains("same type name", result.Errors[0]);
    }

    [Fact]
    public async Task Migrate_ReturnsEmptySuccess_WhenNoNotesFound()
    {
        var v1 = await SeedTypeAsync("Empty", 1);
        var v2 = await SeedTypeAsync("Empty", 2);

        var request = new TypeMigrationRequest(v2.Id, []);
        var result = await _sut.MigrateNotesAsync(v1.Id, request);

        Assert.True(result.Succeeded);
        Assert.Empty(result.MigratedNoteIds);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
