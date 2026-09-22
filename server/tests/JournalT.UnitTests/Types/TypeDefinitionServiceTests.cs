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
    public async Task CreateNewVersion_IncrementsVersionNumber_Succeeds()
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

        // Verify both versions exist in database
        var allVersions = await _sut.ListAsync();
        Assert.Equal(2, allVersions.Count);
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

        var deleted = await _sut.DeleteAsync(otherType.Id);
        Assert.False(deleted);
    }

    [Fact]
    public async Task Delete_TypeInUseByNote_SoftDeactivatesInsteadOfHardDelete()
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

        var deleted = await _sut.DeleteAsync(typeDef.Id);
        Assert.True(deleted);

        // Record still exists in DB but IsActive is false
        var dbRecord = await _db.TypeDefinitions.FindAsync(typeDef.Id);
        Assert.NotNull(dbRecord);
        Assert.False(dbRecord.IsActive);

        // Excluded from standard active list
        var activeList = await _sut.ListAsync(includeInactive: false);
        Assert.Empty(activeList);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
