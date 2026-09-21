namespace JournalT.UnitTests.Libraries;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Libraries.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Libraries;
using JournalT.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

public class LibraryServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly JournalTDbContext _db;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _otherUserId = Guid.NewGuid();
    private readonly LibraryService _sut;

    public LibraryServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<JournalTDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new JournalTDbContext(options);
        _db.Database.EnsureCreated();

        var currentUser = new TestCurrentUser(_userId);
        _sut = new LibraryService(_db, currentUser);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task CreateAndGetTree_NestedHierarchy_Succeeds()
    {
        var root = (await _sut.CreateAsync(new CreateLibraryRequest("Projects"))).Library!;
        var child = (await _sut.CreateAsync(new CreateLibraryRequest("JournalT", root.Id))).Library!;
        var grandChild = (await _sut.CreateAsync(new CreateLibraryRequest("Backend", child.Id))).Library!;

        var tree = await _sut.GetTreeAsync();

        Assert.Single(tree);
        Assert.Equal("Projects", tree[0].Name);
        Assert.Single(tree[0].Children);
        Assert.Equal("JournalT", tree[0].Children[0].Name);
        Assert.Single(tree[0].Children[0].Children);
        Assert.Equal("Backend", tree[0].Children[0].Children[0].Name);
    }

    [Fact]
    public async Task CreateAsync_DuplicateSiblingName_FailsWithConflict()
    {
        await _sut.CreateAsync(new CreateLibraryRequest("Docs"));
        var duplicateResult = await _sut.CreateAsync(new CreateLibraryRequest("Docs"));

        Assert.False(duplicateResult.Succeeded);
        Assert.Equal(409, duplicateResult.StatusCode);
    }

    [Fact]
    public async Task MoveAsync_IntoSelfOrDescendant_FailsCyclePrevention()
    {
        var parent = (await _sut.CreateAsync(new CreateLibraryRequest("Parent"))).Library!;
        var child = (await _sut.CreateAsync(new CreateLibraryRequest("Child", parent.Id))).Library!;

        // Attempt move into self
        var selfMove = await _sut.MoveAsync(parent.Id, new MoveLibraryRequest(parent.Id));
        Assert.False(selfMove.Succeeded);
        Assert.Contains("Cannot move a library into itself", selfMove.Errors[0]);

        // Attempt move into descendant
        var descendantMove = await _sut.MoveAsync(parent.Id, new MoveLibraryRequest(child.Id));
        Assert.False(descendantMove.Succeeded);
        Assert.Contains("Cannot move a library into one of its descendants", descendantMove.Errors[0]);
    }

    [Fact]
    public async Task MoveAsync_DuplicateSiblingUnderNewParent_Fails()
    {
        var targetParent = (await _sut.CreateAsync(new CreateLibraryRequest("TargetParent"))).Library!;
        await _sut.CreateAsync(new CreateLibraryRequest("ExistingName", targetParent.Id));
        var rootItem = (await _sut.CreateAsync(new CreateLibraryRequest("ExistingName"))).Library!;

        var result = await _sut.MoveAsync(rootItem.Id, new MoveLibraryRequest(targetParent.Id));

        Assert.False(result.Succeeded);
        Assert.Equal(409, result.StatusCode);
    }

    [Fact]
    public async Task Tenancy_CannotAccessOtherUsersLibrary()
    {
        var otherUserLib = new Library { UserId = _otherUserId, Name = "Secret Lib" };
        _db.Libraries.Add(otherUserLib);
        await _db.SaveChangesAsync();

        var renameResult = await _sut.RenameAsync(otherUserLib.Id, new RenameLibraryRequest("Hacked"));
        Assert.False(renameResult.Succeeded);
        Assert.Equal(404, renameResult.StatusCode);

        var moveResult = await _sut.MoveAsync(otherUserLib.Id, new MoveLibraryRequest(null));
        Assert.False(moveResult.Succeeded);
        Assert.Equal(404, moveResult.StatusCode);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
