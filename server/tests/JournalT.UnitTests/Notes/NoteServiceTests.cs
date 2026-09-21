namespace JournalT.UnitTests.Notes;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Notes.DTOs;
using JournalT.Domain.Entities;
using JournalT.Domain.Enums;
using JournalT.Infrastructure.Markdown;
using JournalT.Infrastructure.Notes;
using JournalT.Infrastructure.Persistence;
using JournalT.Infrastructure.Validation;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

public class NoteServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly JournalTDbContext _db;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _otherUserId = Guid.NewGuid();
    private readonly NoteService _sut;

    public NoteServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<JournalTDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new JournalTDbContext(options);
        _db.Database.EnsureCreated();

        var currentUser = new TestCurrentUser(_userId);
        var markdownService = new MarkdownService();
        var typeValidationService = new TypeValidationService();

        _sut = new NoteService(_db, currentUser, markdownService, typeValidationService);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task CreateAsync_InboxNote_SucceedsAndRendersMarkdown()
    {
        var request = new CreateNoteRequest(
            Title: "Quick Thought",
            Level: NoteLevel.Inbox,
            BodyMarkdown: "Remember to review [[Architecture]] and use **bold**."
        );

        var result = await _sut.CreateAsync(request);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.Note);
        Assert.Equal(NoteLevel.Inbox, result.Note.Level);
        Assert.Equal("Quick Thought", result.Note.Title);
        Assert.Contains("<strong>bold</strong>", result.Note.RenderedHtml);
        Assert.Contains("Architecture", result.Note.WikiLinks);
        Assert.Null(result.Note.TypeId);
    }

    [Fact]
    public async Task CreateAsync_InboxNote_WithTypeId_Fails()
    {
        var request = new CreateNoteRequest(
            Title: "Invalid Inbox Note",
            Level: NoteLevel.Inbox,
            TypeId: Guid.NewGuid()
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Contains("Inbox notes cannot specify a TypeId", result.Errors[0]);
    }

    [Fact]
    public async Task CreateAsync_QuickNote_WithFreeFormTags_Succeeds()
    {
        var request = new CreateNoteRequest(
            Title: "Quick Task",
            Level: NoteLevel.Quick,
            BodyMarkdown: "Some quick text.",
            Tags: [new TagDto(TagType.FreeForm, null, "ideas"), new TagDto(TagType.FreeForm, null, "backend")]
        );

        var result = await _sut.CreateAsync(request);

        Assert.True(result.Succeeded);
        Assert.Equal(2, result.Note!.Tags.Count);
        Assert.All(result.Note.Tags, t => Assert.Equal(TagType.FreeForm, t.TagType));
    }

    [Fact]
    public async Task CreateAsync_QuickNote_WithTypedTag_Fails()
    {
        var request = new CreateNoteRequest(
            Title: "Quick with Typed Tag",
            Level: NoteLevel.Quick,
            Tags: [new TagDto(TagType.Typed, "status", "draft")]
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Contains("Quick notes only support FreeForm tags", result.Errors[0]);
    }

    [Fact]
    public async Task CreateAsync_QuickNote_WithTypeId_Fails()
    {
        var request = new CreateNoteRequest(
            Title: "Quick with TypeId",
            Level: NoteLevel.Quick,
            TypeId: Guid.NewGuid()
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Contains("Quick notes cannot specify a TypeId", result.Errors[0]);
    }

    [Fact]
    public async Task CreateAsync_JournalNote_WithoutTypeId_Fails()
    {
        var request = new CreateNoteRequest(
            Title: "Journal without Type",
            Level: NoteLevel.Journal,
            TypeId: null
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Contains("require a TypeId", result.Errors[0]);
    }

    [Fact]
    public async Task CreateAsync_JournalNote_WithNonExistentType_Fails()
    {
        var request = new CreateNoteRequest(
            Title: "Journal with missing Type",
            Level: NoteLevel.Journal,
            TypeId: Guid.NewGuid()
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Contains("Type definition not found", result.Errors[0]);
    }

    [Fact]
    public async Task CreateAsync_JournalNote_WithOtherUsersType_Fails()
    {
        var otherUserType = new TypeDefinition
        {
            UserId = _otherUserId,
            Name = "Other Person Type",
            Version = 1,
            SchemaJson = "{\"type\":\"object\"}",
            IsActive = true
        };
        _db.TypeDefinitions.Add(otherUserType);
        await _db.SaveChangesAsync();

        var request = new CreateNoteRequest(
            Title: "Stealing Type",
            Level: NoteLevel.Journal,
            TypeId: otherUserType.Id
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Contains("Type definition not found", result.Errors[0]);
    }

    [Fact]
    public async Task CreateAsync_JournalNote_ValidMetadataAndSections_Succeeds()
    {
        var typeDef = new TypeDefinition
        {
            UserId = _userId,
            Name = "Decision Record",
            Version = 2,
            SchemaJson = """
                {
                    "type": "object",
                    "properties": {
                        "outcome": { "type": "string" }
                    },
                    "required": ["outcome"]
                }
                """,
            SectionsJson = """
                [
                    { "heading": "Context", "level": 2, "required": true }
                ]
                """,
            IsActive = true
        };
        _db.TypeDefinitions.Add(typeDef);
        await _db.SaveChangesAsync();

        var request = new CreateNoteRequest(
            Title: "ADR-001",
            Level: NoteLevel.Journal,
            TypeId: typeDef.Id,
            TypedMetadataJson: "{\"outcome\":\"approved\"}",
            BodyMarkdown: "## Context\nBackground details here."
        );

        var result = await _sut.CreateAsync(request);

        Assert.True(result.Succeeded);
        Assert.Equal(typeDef.Id, result.Note!.TypeId);
        Assert.Equal(2, result.Note.TypeVersion);
    }

    [Fact]
    public async Task CreateAsync_JournalNote_InvalidMetadata_FailsValidation()
    {
        var typeDef = new TypeDefinition
        {
            UserId = _userId,
            Name = "Book Review",
            Version = 1,
            SchemaJson = """
                {
                    "type": "object",
                    "properties": {
                        "rating": { "type": "integer", "minimum": 1, "maximum": 5 }
                    },
                    "required": ["rating"]
                }
                """,
            IsActive = true
        };
        _db.TypeDefinitions.Add(typeDef);
        await _db.SaveChangesAsync();

        var request = new CreateNoteRequest(
            Title: "Dune Review",
            Level: NoteLevel.Journal,
            TypeId: typeDef.Id,
            TypedMetadataJson: "{\"rating\": 10}" // Exceeds maximum 5
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.True(result.Errors.Length > 0);
    }

    [Fact]
    public async Task CreateAsync_MissingTitle_Fails()
    {
        var request = new CreateNoteRequest(Title: "   ");

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Equal("Title is required.", result.Errors[0]);
    }

    [Fact]
    public async Task CreateAsync_NonExistentLibrary_Fails()
    {
        var request = new CreateNoteRequest(
            Title: "Orphan Note",
            LibraryId: Guid.NewGuid()
        );

        var result = await _sut.CreateAsync(request);

        Assert.False(result.Succeeded);
        Assert.Equal("Library not found.", result.Errors[0]);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsNote_AndHidesOtherUsersNote()
    {
        var myNote = new Note
        {
            UserId = _userId,
            Title = "My Private Note",
            BodyMarkdown = "Hello [[Secret Note]]"
        };
        var otherNote = new Note
        {
            UserId = _otherUserId,
            Title = "Other's Note"
        };
        _db.Notes.AddRange(myNote, otherNote);
        await _db.SaveChangesAsync();

        var retrievedMine = await _sut.GetByIdAsync(myNote.Id);
        var retrievedOther = await _sut.GetByIdAsync(otherNote.Id);

        Assert.NotNull(retrievedMine);
        Assert.Equal("My Private Note", retrievedMine.Title);
        Assert.Contains("Secret Note", retrievedMine.WikiLinks);

        Assert.Null(retrievedOther);
    }

    [Fact]
    public async Task ListAsync_FiltersOutTrashedNotesByDefault()
    {
        var activeNote = new Note { UserId = _userId, Title = "Active", IsTrashed = false };
        var trashedNote = new Note { UserId = _userId, Title = "Trashed", IsTrashed = true };
        _db.Notes.AddRange(activeNote, trashedNote);
        await _db.SaveChangesAsync();

        var list = await _sut.ListAsync(new NoteFilterParams());

        Assert.Single(list.Items);
        Assert.Equal("Active", list.Items[0].Title);
        Assert.Equal(1, list.TotalCount);
    }

    [Fact]
    public async Task ListAsync_AllowsQueryingTrashExplicitly()
    {
        var activeNote = new Note { UserId = _userId, Title = "Active", IsTrashed = false };
        var trashedNote = new Note { UserId = _userId, Title = "Trashed", IsTrashed = true };
        _db.Notes.AddRange(activeNote, trashedNote);
        await _db.SaveChangesAsync();

        var list = await _sut.ListAsync(new NoteFilterParams(IsTrashed: true));

        Assert.Single(list.Items);
        Assert.Equal("Trashed", list.Items[0].Title);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesContentAndReRendersMarkdown()
    {
        var note = new Note
        {
            UserId = _userId,
            Title = "Old Title",
            BodyMarkdown = "Old body",
            RenderedHtml = "<p>Old body</p>"
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();

        var updateRequest = new UpdateNoteRequest(
            Title: "New Title",
            BodyMarkdown: "New body with **bold**."
        );

        var result = await _sut.UpdateAsync(note.Id, updateRequest);

        Assert.True(result.Succeeded);
        Assert.Equal("New Title", result.Note!.Title);
        Assert.Contains("<strong>bold</strong>", result.Note.RenderedHtml);
    }

    [Fact]
    public async Task TrashAndRestoreLifecycle_WorksCorrectly()
    {
        var note = new Note
        {
            UserId = _userId,
            Title = "To Be Trashed",
            IsTrashed = false
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();

        // 1. Trash
        var trashed = await _sut.TrashAsync(note.Id);
        Assert.True(trashed);

        _db.ChangeTracker.Clear();
        var retrievedTrashed = await _db.Notes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == note.Id);
        Assert.NotNull(retrievedTrashed);
        Assert.True(retrievedTrashed.IsTrashed);
        Assert.NotNull(retrievedTrashed.TrashedAtUtc);

        // Cannot update trashed note
        var updateResult = await _sut.UpdateAsync(note.Id, new UpdateNoteRequest("Updated"));
        Assert.False(updateResult.Succeeded);
        Assert.Contains("Cannot edit a trashed note", updateResult.Errors[0]);

        // 2. Restore
        var restored = await _sut.RestoreAsync(note.Id);
        Assert.True(restored);

        _db.ChangeTracker.Clear();
        var retrievedRestored = await _db.Notes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == note.Id);
        Assert.NotNull(retrievedRestored);
        Assert.False(retrievedRestored.IsTrashed);
        Assert.Null(retrievedRestored.TrashedAtUtc);

        // 3. Permanent delete
        var deleted = await _sut.DeletePermanentAsync(note.Id);
        Assert.True(deleted);

        _db.ChangeTracker.Clear();
        var retrievedDeleted = await _db.Notes.AsNoTracking().FirstOrDefaultAsync(n => n.Id == note.Id);
        Assert.Null(retrievedDeleted);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
