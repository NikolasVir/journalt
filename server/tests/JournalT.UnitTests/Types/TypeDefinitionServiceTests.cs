namespace JournalT.UnitTests.Types;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Types.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Persistence;
using JournalT.Infrastructure.Types;
using JournalT.Infrastructure.Validation;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

public class TypeDefinitionServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly JournalTDbContext _db;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _otherUserId = Guid.NewGuid();
    private readonly TypeDefinitionService _sut;

    public TypeDefinitionServiceTests()
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

    [Fact]
    public async Task CreateAndList_ValidTypeDefinition_Succeeds()
    {
        var request = new CreateTypeDefinitionRequest(
            Name: "BookReview",
            Description: "Template for reading notes",
            SchemaJson: """{"type":"object","properties":{"rating":{"type":"number"}}}""",
            SectionsJson: """[{"heading":"Summary","level":2,"required":true}]"""
        );

        var result = await _sut.CreateAsync(request);
        Assert.True(result.Succeeded);
        Assert.Equal(1, result.TypeDefinition!.Version);
        Assert.True(result.TypeDefinition.IsActive);

        var list = await _sut.ListAsync();
        Assert.Single(list);
        Assert.Equal("BookReview", list[0].Name);
    }

    [Fact]
    public async Task CreateNewVersion_IncrementsVersionNumber_AndReplacesOldVersion()
    {
        var v1 = (await _sut.CreateAsync(new CreateTypeDefinitionRequest("MeetingNotes"))).TypeDefinition!;
        Assert.Equal(1, v1.Version);

        var v2Result = await _sut.CreateNewVersionAsync(v1.Id, new CreateTypeVersionRequest(
            Description: "Updated meeting template",
            SchemaJson: """{"type":"object","properties":{"attendees":{"type":"array"}}}"""
        ));

        Assert.True(v2Result.Succeeded);
        Assert.Equal(2, v2Result.TypeDefinition!.Version);
        Assert.Equal("MeetingNotes", v2Result.TypeDefinition.Name);

        // Verify the old version was replaced and only the new version exists
        var allVersions = await _sut.ListAsync();
        Assert.Single(allVersions);
        Assert.Equal(2, allVersions[0].Version);
        Assert.Equal(v2Result.TypeDefinition.Id, allVersions[0].Id);
    }

    [Fact]
    public async Task CreateNewVersion_AutomaticallyMigratesNotesFromOldVersion()
    {
        var v1 = (await _sut.CreateAsync(new CreateTypeDefinitionRequest("MeetingNotes"))).TypeDefinition!;

        var note = new Note
        {
            UserId = _userId,
            Title = "Team Sync",
            TypeId = v1.Id,
            TypeVersion = v1.Version
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();

        var v2Result = await _sut.CreateNewVersionAsync(v1.Id, new CreateTypeVersionRequest(
            Description: "Updated meeting template"
        ));

        Assert.True(v2Result.Succeeded);

        // Note should now point to v2
        var updatedNote = await _db.Notes.FindAsync(note.Id);
        Assert.NotNull(updatedNote);
        Assert.Equal(v2Result.TypeDefinition!.Id, updatedNote.TypeId);
        Assert.Equal(2, updatedNote.TypeVersion);

        // Old version definition should be removed
        Assert.Null(await _db.TypeDefinitions.FindAsync(v1.Id));
    }

    [Fact]
    public async Task Clone_NewName_Succeeds()
    {
        var source = (await _sut.CreateAsync(new CreateTypeDefinitionRequest(
            Name: "ProjectPlan",
            SchemaJson: """{"type":"object"}"""
        ))).TypeDefinition!;

        var cloneResult = await _sut.CloneAsync(source.Id, new CloneTypeRequest("SprintPlan"));

        Assert.True(cloneResult.Succeeded);
        Assert.Equal("SprintPlan", cloneResult.TypeDefinition!.Name);
        Assert.Equal(1, cloneResult.TypeDefinition.Version);
    }

    [Fact]
    public async Task Create_DuplicateName_ReturnsConflict()
    {
        await _sut.CreateAsync(new CreateTypeDefinitionRequest("UniqueType"));
        var duplicate = await _sut.CreateAsync(new CreateTypeDefinitionRequest("UniqueType"));

        Assert.False(duplicate.Succeeded);
        Assert.Equal(409, duplicate.StatusCode);
    }

    [Fact]
    public async Task Clone_ExistingName_ReturnsConflict()
    {
        var type1 = (await _sut.CreateAsync(new CreateTypeDefinitionRequest("TypeA"))).TypeDefinition!;
        await _sut.CreateAsync(new CreateTypeDefinitionRequest("TypeB"));

        var conflictClone = await _sut.CloneAsync(type1.Id, new CloneTypeRequest("TypeB"));

        Assert.False(conflictClone.Succeeded);
        Assert.Equal(409, conflictClone.StatusCode);
    }

    [Fact]
    public async Task Tenancy_CannotAccessOtherUsersTypes()
    {
        var otherType = new TypeDefinition
        {
            UserId = _otherUserId,
            Name = "SecretType",
            Version = 1,
            SchemaJson = "{}"
        };
        _db.TypeDefinitions.Add(otherType);
        await _db.SaveChangesAsync();

        Assert.Null(await _sut.GetByIdAsync(otherType.Id));

        var versionResult = await _sut.CreateNewVersionAsync(otherType.Id, new CreateTypeVersionRequest());
        Assert.False(versionResult.Succeeded);
        Assert.Equal(404, versionResult.StatusCode);

        var cloneResult = await _sut.CloneAsync(otherType.Id, new CloneTypeRequest("ClonedSecret"));
        Assert.False(cloneResult.Succeeded);
        Assert.Equal(404, cloneResult.StatusCode);

        var deleteResult = await _sut.DeleteAsync(otherType.Id);
        Assert.False(deleteResult.Succeeded);
        Assert.Equal(404, deleteResult.StatusCode);
    }

    [Fact]
    public async Task Delete_TypeInUseByNote_ReturnsConflictAndDoesNotDelete()
    {
        var typeDef = (await _sut.CreateAsync(new CreateTypeDefinitionRequest("InUseType"))).TypeDefinition!;

        // Add a note referencing this type
        _db.Notes.Add(new Note
        {
            UserId = _userId,
            Title = "Linked Note",
            TypeId = typeDef.Id,
            TypeVersion = typeDef.Version
        });
        await _db.SaveChangesAsync();

        var deleteResult = await _sut.DeleteAsync(typeDef.Id);
        Assert.False(deleteResult.Succeeded);
        Assert.Equal(409, deleteResult.StatusCode);
        Assert.Contains("Types that have notes cannot be deleted.", deleteResult.Errors);

        // Record still exists in DB and IsActive is true
        var dbRecord = await _db.TypeDefinitions.FindAsync(typeDef.Id);
        Assert.NotNull(dbRecord);
        Assert.True(dbRecord.IsActive);
    }

    [Fact]
    public async Task Delete_TypeWithoutNotes_Succeeds()
    {
        var typeDef = (await _sut.CreateAsync(new CreateTypeDefinitionRequest("UnusedType"))).TypeDefinition!;

        var deleteResult = await _sut.DeleteAsync(typeDef.Id);
        Assert.True(deleteResult.Succeeded);

        // Record is removed from DB
        var dbRecord = await _db.TypeDefinitions.FindAsync(typeDef.Id);
        Assert.Null(dbRecord);
    }

    [Fact]
    public async Task Update_ValidChanges_UpdatesInPlace_AndKeepsSameId()
    {
        var created = (await _sut.CreateAsync(new CreateTypeDefinitionRequest("OriginalName", "Desc 1"))).TypeDefinition!;

        var updateResult = await _sut.UpdateAsync(created.Id, new UpdateTypeDefinitionRequest(
            Name: "UpdatedName",
            Description: "Updated Desc",
            SchemaJson: """{"type":"object","properties":{"score":{"type":"number"}}}""",
            SectionsJson: """[{"heading":"Analysis","level":2,"required":true}]"""
        ));

        Assert.True(updateResult.Succeeded);
        Assert.Equal(created.Id, updateResult.TypeDefinition!.Id);
        Assert.Equal("UpdatedName", updateResult.TypeDefinition.Name);
        Assert.Equal("Updated Desc", updateResult.TypeDefinition.Description);

        // Fetch to ensure persisted
        var fetched = await _sut.GetByIdAsync(created.Id);
        Assert.NotNull(fetched);
        Assert.Equal("UpdatedName", fetched.Name);
        Assert.Equal("Updated Desc", fetched.Description);
        Assert.Equal("""[{"heading":"Analysis","level":2,"required":true}]""", fetched.SectionsJson);
    }

    [Fact]
    public async Task Update_CanUpdateEvenIfTypeHasNotes()
    {
        var created = (await _sut.CreateAsync(new CreateTypeDefinitionRequest("InUseForEdit"))).TypeDefinition!;

        _db.Notes.Add(new Note
        {
            UserId = _userId,
            Title = "Linked Note",
            TypeId = created.Id,
            TypeVersion = 1
        });
        await _db.SaveChangesAsync();

        var updateResult = await _sut.UpdateAsync(created.Id, new UpdateTypeDefinitionRequest(
            Name: "InUseForEditUpdated",
            Description: "Changed at will"
        ));

        Assert.True(updateResult.Succeeded);
        Assert.Equal(1, updateResult.TypeDefinition!.NotesCount);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
