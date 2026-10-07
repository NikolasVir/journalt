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
    public async Task PromoteAsync_InboxToNoteToJournal_Succeeds()
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

        // 2. Promote Inbox -> Note
        var toNote = await _sut.PromoteAsync(note.Id, new PromoteNoteRequest(TargetLevel: NoteLevel.Note));
        Assert.True(toNote.Succeeded);
        Assert.Equal(NoteLevel.Note, toNote.Note!.Level);

        // 3. Promote Note -> Journal
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
        var note1 = (await _sut.CreateAsync(new CreateNoteRequest("Subject Note", NoteLevel.Note))).Note!;
        var note2 = (await _sut.CreateAsync(new CreateNoteRequest("Target Note", NoteLevel.Note))).Note!;

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

        // 2. Note level note cannot have TypeId
        var noteWithType = await _sut.CreateAsync(new CreateNoteRequest("Note", NoteLevel.Note, TypeId: Guid.NewGuid()));
        Assert.False(noteWithType.Succeeded);

        // 3. Note level note cannot have Typed tag
        var noteWithTypedTag = await _sut.CreateAsync(new CreateNoteRequest(
            "Note",
            NoteLevel.Note,
            Tags: [new TagDto(TagType.Typed, "status", "active")]
        ));
        Assert.False(noteWithTypedTag.Succeeded);

        // 4. Journal note requires TypeId
        var journalNoType = await _sut.CreateAsync(new CreateNoteRequest("Journal", NoteLevel.Journal));
        Assert.False(journalNoType.Succeeded);

        // 5. Typed tag disallowed vocabulary value
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
        // Setup Note level note
        var note = (await _sut.CreateAsync(new CreateNoteRequest("Note", NoteLevel.Note))).Note!;

        // Attempt demotion Note -> Inbox
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
        var targetNote = (await _sut.CreateAsync(new CreateNoteRequest("Target Note", NoteLevel.Note))).Note!;

        // Inbox notes cannot have outbound relations
        var inboxRel = await _sut.AddRelationAsync(inboxNote.Id, new CreateNoteRelationRequest(targetNote.Id, "about"));
        Assert.False(inboxRel.Succeeded);
        Assert.Contains("Inbox notes cannot define explicit outbound relations", inboxRel.Errors[0]);

        // Add relation from Note to Target note
        var sourceNote = (await _sut.CreateAsync(new CreateNoteRequest("Source Note", NoteLevel.Note))).Note!;
        await _sut.AddRelationAsync(sourceNote.Id, new CreateNoteRelationRequest(targetNote.Id, "relates_to"));

        var relationsBeforeTrash = await _sut.GetRelationsAsync(sourceNote.Id);
        Assert.Single(relationsBeforeTrash);

        // Relations pointing to trashed notes must be excluded
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
        await _sut.CreateAsync(new CreateNoteRequest("Ambiguous Note", NoteLevel.Note));
        await _sut.CreateAsync(new CreateNoteRequest("Ambiguous Note", NoteLevel.Note));

        // Note linking to the ambiguous title
        var referencingNote = (await _sut.CreateAsync(new CreateNoteRequest(
            "Referencing Note",
            NoteLevel.Note,
            BodyMarkdown: "See [[Ambiguous Note]] and [[NonExistent Note]]."
        ))).Note!;

        // Multiple matches or missing targets remain unresolved spans
        Assert.Contains("<span class=\"internal-link unresolved\" data-title=\"Ambiguous Note\">Ambiguous Note</span>", referencingNote.RenderedHtml);
        Assert.Contains("<span class=\"internal-link unresolved\" data-title=\"NonExistent Note\">NonExistent Note</span>", referencingNote.RenderedHtml);
        Assert.DoesNotContain("<a href=", referencingNote.RenderedHtml);

        // UnresolvedWikiLinks must carry typed warnings (not_found / ambiguous)
        Assert.NotNull(referencingNote.UnresolvedWikiLinks);
        Assert.Equal(2, referencingNote.UnresolvedWikiLinks!.Count);

        var ambiguousWarning = referencingNote.UnresolvedWikiLinks.SingleOrDefault(w => w.Title == "Ambiguous Note");
        Assert.NotNull(ambiguousWarning);
        Assert.Equal("ambiguous", ambiguousWarning!.Reason);

        var notFoundWarning = referencingNote.UnresolvedWikiLinks.SingleOrDefault(w => w.Title == "NonExistent Note");
        Assert.NotNull(notFoundWarning);
        Assert.Equal("not_found", notFoundWarning!.Reason);
    }


    [Fact]
    public async Task JournalTags_MustUseRegisteredTypedValues_AndAreCanonicalized()
    {
        var openType = new TypeDefinition
        {
            UserId = _userId,
            Name = "LearningNote",
            Version = 1,
            SchemaJson = "{}",
            IsActive = true
        };
        var topicDefinition = new TagDefinition
        {
            UserId = _userId,
            Category = "topic",
            KnownValuesJson = "[\"Mathematics\",\"Systems\"]"
        };
        var statusDefinition = new TagDefinition
        {
            UserId = _userId,
            Category = "status",
            AllowedValuesJson = "[\"active\"]"
        };
        _db.TagDefinitions.Add(topicDefinition);
        _db.TagDefinitions.Add(statusDefinition);
        _db.TypeDefinitions.Add(openType);
        await _db.SaveChangesAsync();

        var freeFormResult = await _sut.CreateAsync(new CreateNoteRequest(
            "Invalid free-form tag",
            NoteLevel.Journal,
            TypeId: openType.Id,
            TypedMetadataJson: "{}",
            Tags: [new TagDto(TagType.FreeForm, null, "mathematics")]
        ));
        Assert.False(freeFormResult.Succeeded);
        Assert.Contains("only support registered typed tags", freeFormResult.Errors[0]);

        var unknownResult = await _sut.CreateAsync(new CreateNoteRequest(
            "Unknown value",
            NoteLevel.Journal,
            TypeId: openType.Id,
            TypedMetadataJson: "{}",
            Tags: [new TagDto(TagType.Typed, "topic", "Biology")]
        ));
        Assert.False(unknownResult.Succeeded);
        Assert.Contains("not registered", unknownResult.Errors[0]);

        var closedCategoryOnlyResult = await _sut.CreateAsync(new CreateNoteRequest(
            "Closed category without value",
            NoteLevel.Journal,
            TypeId: openType.Id,
            TypedMetadataJson: "{}",
            Tags: [new TagDto(TagType.Typed, "status", null)]
        ));
        Assert.False(closedCategoryOnlyResult.Succeeded);
        Assert.Contains("is closed and requires a value", closedCategoryOnlyResult.Errors[0]);

        var categoryOnlyResult = await _sut.CreateAsync(new CreateNoteRequest(
            "Open category without value",
            NoteLevel.Journal,
            TypeId: openType.Id,
            TypedMetadataJson: "{}",
            Tags: [new TagDto(TagType.Typed, "topic", null)]
        ));
        Assert.True(categoryOnlyResult.Succeeded);
        var categoryOnlyTag = Assert.Single(categoryOnlyResult.Note!.Tags!);
        Assert.Equal("topic", categoryOnlyTag.Category);
        Assert.Null(categoryOnlyTag.Value);

        var validResult = await _sut.CreateAsync(new CreateNoteRequest(
            "Valid typed tag",
            NoteLevel.Journal,
            TypeId: openType.Id,
            TypedMetadataJson: "{}",
            Tags: [new TagDto(TagType.Typed, "topic", "mathematics")]
        ));

        Assert.True(validResult.Succeeded);
        var tag = Assert.Single(validResult.Note!.Tags!);
        Assert.Equal(TagType.Typed, tag.TagType);
        Assert.Equal("topic", tag.Category);
        Assert.Equal("Mathematics", tag.Value);
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

    [Fact]
    public async Task Search_MatchesBodyMarkdownAndTag_FiltersCorrectly()
    {
        // 1. Note matching keyword in body markdown
        await _sut.CreateAsync(new CreateNoteRequest("Common Title", NoteLevel.Note, BodyMarkdown: "Deep architectural insights about indexing"));
        await _sut.CreateAsync(new CreateNoteRequest("Unrelated", NoteLevel.Note, BodyMarkdown: "Just notes"));

        var bodySearch = await _sut.ListAsync(new NoteFilterParams(Search: "architectural"));
        Assert.Single(bodySearch.Items);
        Assert.Equal("Common Title", bodySearch.Items[0].Title);

        // 2. Tag filter matching
        await _sut.CreateAsync(new CreateNoteRequest(
            "Tagged Note",
            NoteLevel.Note,
            Tags: [new TagDto(TagType.FreeForm, null, "performance")]
        ));

        var tagResults = await _sut.ListAsync(new NoteFilterParams(Tag: "performance"));
        Assert.Single(tagResults.Items);
        Assert.Equal("Tagged Note", tagResults.Items[0].Title);
    }

    [Fact]
    public async Task TodoHub_ToggleAndSummary_TracksPendingAndCompleted()
    {
        var note = (await _sut.CreateAsync(new CreateNoteRequest("Fix memory leak", NoteLevel.Note, IsTodo: true))).Note!;
        Assert.True(note.IsTodo);
        Assert.Null(note.TodoCompletedAtUtc);

        // Initial summary
        var initialSummary = await _sut.GetTodoSummaryAsync();
        Assert.True(initialSummary.PendingCount >= 1);

        // Toggle todo completion (PATCH /api/notes/{id}/todo)
        var completedNote = await _sut.ToggleTodoAsync(note.Id);
        Assert.NotNull(completedNote);
        Assert.False(completedNote.IsTodo);
        Assert.NotNull(completedNote.TodoCompletedAtUtc);

        // Recheck summary
        var updatedSummary = await _sut.GetTodoSummaryAsync();
        Assert.True(updatedSummary.CompletedCount >= 1);
        Assert.Contains(updatedSummary.RecentCompletedTodos, t => t.Id == note.Id);
    }

    [Fact]
    public async Task GetById_WhenNoteIsIncompatibleWithType_ReturnsTypeValidationWarnings()
    {
        var typeDef = new TypeDefinition
        {
            UserId = _userId,
            Name = "StrictType",
            Version = 1,
            SchemaJson = """{"type":"object","properties":{"score":{"type":"number"}},"required":["score"]}""",
            SectionsJson = """[{"heading":"Summary","level":2,"required":true}]""",
            IsActive = true
        };
        _db.TypeDefinitions.Add(typeDef);
        await _db.SaveChangesAsync();

        // Seed a note that is missing required field and section
        var note = new Note
        {
            UserId = _userId,
            Title = "Legacy Note",
            Level = NoteLevel.Journal,
            TypeId = typeDef.Id,
            TypeVersion = 1,
            TypedMetadataJson = "{}",
            BodyMarkdown = "Just some text without headings",
            RenderedHtml = "<p>Just some text without headings</p>"
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();

        var fetched = await _sut.GetByIdAsync(note.Id);
        Assert.NotNull(fetched);
        Assert.NotNull(fetched.TypeValidationWarnings);
        Assert.NotEmpty(fetched.TypeValidationWarnings);
        Assert.Contains(fetched.TypeValidationWarnings, w => w.Contains("Summary"));
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
