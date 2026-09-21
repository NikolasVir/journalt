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

    // --- Happy Paths ---

    [Fact]
    public async Task CreateAndGet_JournalNote_WithValidSchemaAndSections_Succeeds()
    {
        var typeDef = new TypeDefinition
        {
            UserId = _userId,
            Name = "DailyLog",
            Version = 1,
            SchemaJson = """{"type":"object","properties":{"mood":{"type":"string"}},"required":["mood"]}""",
            SectionsJson = """[{"heading":"Highlights","level":2,"required":true}]""",
            IsActive = true
        };
        _db.TypeDefinitions.Add(typeDef);
        await _db.SaveChangesAsync();

        var request = new CreateNoteRequest(
            Title: "Daily Reflection",
            Level: NoteLevel.Journal,
            BodyMarkdown: "## Highlights\nShipped features.",
            TypeId: typeDef.Id,
            TypedMetadataJson: "{\"mood\": \"focused\"}"
        );

        var result = await _sut.CreateAsync(request);
        Assert.True(result.Succeeded);
        Assert.Contains("Shipped features.", result.Note!.RenderedHtml);

        var retrieved = await _sut.GetByIdAsync(result.Note.Id);
        Assert.NotNull(retrieved);
        Assert.Equal("Daily Reflection", retrieved.Title);
        Assert.Equal("{\"mood\": \"focused\"}", retrieved.TypedMetadataJson);
    }

    [Fact]
    public async Task PromoteAsync_InboxToQuickToJournal_Succeeds()
    {
        var typeDef = new TypeDefinition
        {
            UserId = _userId,
            Name = "Milestone",
            Version = 1,
            SchemaJson = "{}",
            IsActive = true
        };
        _db.TypeDefinitions.Add(typeDef);
        await _db.SaveChangesAsync();

        // 1. Create Inbox Note
        var note = (await _sut.CreateAsync(new CreateNoteRequest("Initial Capture", NoteLevel.Inbox))).Note!;
        Assert.Equal(NoteLevel.Inbox, note.Level);

        // 2. Promote Inbox -> Quick
        var toQuick = await _sut.PromoteAsync(note.Id, new PromoteNoteRequest(TargetLevel: NoteLevel.Quick));
        Assert.True(toQuick.Succeeded);
        Assert.Equal(NoteLevel.Quick, toQuick.Note!.Level);

        // 3. Promote Quick -> Journal
        var toJournal = await _sut.PromoteAsync(note.Id, new PromoteNoteRequest(
            TargetLevel: NoteLevel.Journal,
            TypeId: typeDef.Id,
            TypedMetadataJson: "{}"
        ));
        Assert.True(toJournal.Succeeded);
        Assert.Equal(NoteLevel.Journal, toJournal.Note!.Level);
        Assert.Equal(typeDef.Id, toJournal.Note.TypeId);
    }

    [Fact]
    public async Task SourcesAndRelations_Lifecycle_Succeeds()
    {
        var note1 = (await _sut.CreateAsync(new CreateNoteRequest("Subject Note", NoteLevel.Quick))).Note!;
        var note2 = (await _sut.CreateAsync(new CreateNoteRequest("Target Note", NoteLevel.Quick))).Note!;

        // Add source
        var source = await _sut.AddSourceAsync(note1.Id, new CreateNoteSourceRequest("Doc Citation", Url: "https://example.com"));
        Assert.NotNull(source);

        var sources = await _sut.GetSourcesAsync(note1.Id);
        Assert.Single(sources);

        // Add relation
        var relResult = await _sut.AddRelationAsync(note1.Id, new CreateNoteRelationRequest(note2.Id, "references"));
        Assert.True(relResult.Succeeded);

        var relations = await _sut.GetRelationsAsync(note1.Id);
        Assert.Single(relations);
        Assert.Equal(note2.Id, relations[0].TargetNoteId);

        // Delete source & relation
        Assert.True(await _sut.DeleteSourceAsync(note1.Id, source.Id));
        Assert.True(await _sut.DeleteRelationAsync(note1.Id, relations[0].Id));
    }

    // --- Edge Cases ---

    [Fact]
    public async Task ValidationRules_NoteLevelConstraints_Enforced()
    {
        var tagDef = new TagDefinition
        {
            UserId = _userId,
            Category = "status",
            AllowedValuesJson = "[\"active\", \"done\"]"
        };
        _db.TagDefinitions.Add(tagDef);
        await _db.SaveChangesAsync();

        // 1. Inbox note cannot have TypeId
        var inboxWithType = await _sut.CreateAsync(new CreateNoteRequest("Inbox", NoteLevel.Inbox, TypeId: Guid.NewGuid()));
        Assert.False(inboxWithType.Succeeded);

        // 2. Quick note cannot have TypeId
        var quickWithType = await _sut.CreateAsync(new CreateNoteRequest("Quick", NoteLevel.Quick, TypeId: Guid.NewGuid()));
        Assert.False(quickWithType.Succeeded);

        // 3. Quick note cannot have Typed tag (QUICK-003)
        var quickWithTypedTag = await _sut.CreateAsync(new CreateNoteRequest(
            "Quick",
            NoteLevel.Quick,
            Tags: [new TagDto(TagType.Typed, "status", "active")]
        ));
        Assert.False(quickWithTypedTag.Succeeded);

        // 4. Journal note requires TypeId (NOTE-004)
        var journalNoType = await _sut.CreateAsync(new CreateNoteRequest("Journal", NoteLevel.Journal));
        Assert.False(journalNoType.Succeeded);

        // 5. Typed tag disallowed vocabulary value (TYPE-004)
        var invalidTagValue = await _sut.CreateAsync(new CreateNoteRequest(
            "Journal",
            NoteLevel.Journal,
            Tags: [new TagDto(TagType.Typed, "status", "invalid-status")]
        ));
        Assert.False(invalidTagValue.Succeeded);
    }

    [Fact]
    public async Task PromoteAsync_DemotionOrTrashedNote_Rejected()
    {
        // Setup Quick note
        var note = (await _sut.CreateAsync(new CreateNoteRequest("Quick", NoteLevel.Quick))).Note!;

        // Attempt demotion Quick -> Inbox (NOTE-009)
        var demoteResult = await _sut.PromoteAsync(note.Id, new PromoteNoteRequest(TargetLevel: NoteLevel.Inbox));
        Assert.False(demoteResult.Succeeded);
        Assert.Contains("Cannot demote", demoteResult.Errors[0]);

        // Trash note and attempt promote
        await _sut.TrashAsync(note.Id);
        var trashedPromote = await _sut.PromoteAsync(note.Id, new PromoteNoteRequest(TargetLevel: NoteLevel.Journal));
        Assert.False(trashedPromote.Succeeded);
        Assert.Contains("Cannot promote a trashed note", trashedPromote.Errors[0]);
    }

    [Fact]
    public async Task Relations_CannotAddOnInbox_AndExcludesTrashedTargets()
    {
        var inboxNote = (await _sut.CreateAsync(new CreateNoteRequest("Inbox Note", NoteLevel.Inbox))).Note!;
        var targetNote = (await _sut.CreateAsync(new CreateNoteRequest("Target Note", NoteLevel.Quick))).Note!;

        // INBOX-003: Inbox notes cannot have outbound relations
        var inboxRel = await _sut.AddRelationAsync(inboxNote.Id, new CreateNoteRelationRequest(targetNote.Id, "about"));
        Assert.False(inboxRel.Succeeded);
        Assert.Contains("Inbox notes cannot define explicit outbound relations", inboxRel.Errors[0]);

        // Add relation from Quick note to Target note
        var sourceNote = (await _sut.CreateAsync(new CreateNoteRequest("Source Quick", NoteLevel.Quick))).Note!;
        await _sut.AddRelationAsync(sourceNote.Id, new CreateNoteRelationRequest(targetNote.Id, "relates_to"));

        var relationsBeforeTrash = await _sut.GetRelationsAsync(sourceNote.Id);
        Assert.Single(relationsBeforeTrash);

        // SRC-005: Relations pointing to trashed notes must be excluded
        await _sut.TrashAsync(targetNote.Id);
        var relationsAfterTrash = await _sut.GetRelationsAsync(sourceNote.Id);
        Assert.Empty(relationsAfterTrash);

        // Restoring target note restores relation visibility
        await _sut.RestoreAsync(targetNote.Id);
        var relationsAfterRestore = await _sut.GetRelationsAsync(sourceNote.Id);
        Assert.Single(relationsAfterRestore);
    }

    [Fact]
    public async Task WikiLinks_AmbiguousOrMissingTarget_RemainsUnresolvedSpan()
    {
        // Create two notes with the exact same title
        await _sut.CreateAsync(new CreateNoteRequest("Ambiguous Note", NoteLevel.Quick));
        await _sut.CreateAsync(new CreateNoteRequest("Ambiguous Note", NoteLevel.Quick));

        // Note linking to the ambiguous title
        var referencingNote = (await _sut.CreateAsync(new CreateNoteRequest(
            "Referencing Note",
            NoteLevel.Quick,
            BodyMarkdown: "See [[Ambiguous Note]] and [[NonExistent Note]]."
        ))).Note!;

        // SRC-007: Multiple matches or missing targets remain unresolved spans
        Assert.Contains("<span class=\"internal-link unresolved\" data-title=\"Ambiguous Note\">Ambiguous Note</span>", referencingNote.RenderedHtml);
        Assert.Contains("<span class=\"internal-link unresolved\" data-title=\"NonExistent Note\">NonExistent Note</span>", referencingNote.RenderedHtml);
        Assert.DoesNotContain("<a href=", referencingNote.RenderedHtml);
    }

    [Fact]
    public async Task TenancyAndSoftDelete_HidesOtherUsersAndTrashedNotes()
    {
        // Other user's note
        var otherNote = new Note { UserId = _otherUserId, Title = "Other User Secret" };
        _db.Notes.Add(otherNote);

        // Current user's note that is trashed
        var trashedNote = new Note { UserId = _userId, Title = "Trashed Item", IsTrashed = true, TrashedAtUtc = DateTime.UtcNow };
        _db.Notes.Add(trashedNote);

        // Current user's active note
        var activeNote = new Note { UserId = _userId, Title = "Active Item" };
        _db.Notes.Add(activeNote);
        await _db.SaveChangesAsync();

        // 1. GetByIdAsync across tenant boundary returns null
        Assert.Null(await _sut.GetByIdAsync(otherNote.Id));

        // 2. Default ListAsync returns ONLY active note (filters trashed and other tenants)
        var list = await _sut.ListAsync(new NoteFilterParams());
        Assert.Single(list.Items);
        Assert.Equal("Active Item", list.Items[0].Title);

        // 3. Mutating other tenant's note fails
        var addRelResult = await _sut.AddRelationAsync(otherNote.Id, new CreateNoteRelationRequest(activeNote.Id, "about"));
        Assert.False(addRelResult.Succeeded);
        Assert.Equal(404, addRelResult.StatusCode);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
