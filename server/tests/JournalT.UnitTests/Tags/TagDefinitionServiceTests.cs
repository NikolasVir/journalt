namespace JournalT.UnitTests.Tags;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Tags.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Persistence;
using JournalT.Infrastructure.Tags;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

public class TagDefinitionServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly JournalTDbContext _db;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly TagDefinitionService _sut;

    public TagDefinitionServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<JournalTDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new JournalTDbContext(options);
        _db.Database.EnsureCreated();

        var currentUser = new TestCurrentUser(_userId);
        _sut = new TagDefinitionService(_db, currentUser);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Create_OpenAndClosedVocabularies_Succeeds()
    {
        var openTag = await _sut.CreateAsync(new CreateTagDefinitionRequest("topic"));
        Assert.True(openTag.Succeeded);
        Assert.Equal("topic", openTag.TagDefinition!.Category);
        Assert.Null(openTag.TagDefinition.AllowedValuesJson);

        var closedTag = await _sut.CreateAsync(new CreateTagDefinitionRequest(
            "status",
            "[\"draft\", \"active\", \"archived\"]"
        ));
        Assert.True(closedTag.Succeeded);
        Assert.Equal("status", closedTag.TagDefinition!.Category);
        Assert.NotNull(closedTag.TagDefinition.AllowedValuesJson);
    }

    [Fact]
    public async Task Create_DuplicateCategory_FailsWithConflict()
    {
        await _sut.CreateAsync(new CreateTagDefinitionRequest("status"));
        var duplicate = await _sut.CreateAsync(new CreateTagDefinitionRequest("Status"));

        Assert.False(duplicate.Succeeded);
        Assert.Equal(409, duplicate.StatusCode);
    }

    [Fact]
    public async Task Create_InvalidJsonAllowedValues_Fails()
    {
        var result = await _sut.CreateAsync(new CreateTagDefinitionRequest("priority", "not-a-json-array"));

        Assert.False(result.Succeeded);
        Assert.Contains("valid JSON array", result.Errors[0]);
    }

    [Fact]
    public async Task Tenancy_CannotAccessOtherUsersTagDefinitions()
    {
        var otherTag = new TagDefinition
        {
            UserId = Guid.NewGuid(),
            Category = "secret"
        };
        _db.TagDefinitions.Add(otherTag);
        await _db.SaveChangesAsync();

        var retrieved = await _sut.GetByIdAsync(otherTag.Id);
        Assert.Null(retrieved);

        var updateResult = await _sut.UpdateAsync(otherTag.Id, new UpdateTagDefinitionRequest("[]"));
        Assert.False(updateResult.Succeeded);
        Assert.Equal(404, updateResult.StatusCode);

        var deleted = await _sut.DeleteAsync(otherTag.Id);
        Assert.False(deleted);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
