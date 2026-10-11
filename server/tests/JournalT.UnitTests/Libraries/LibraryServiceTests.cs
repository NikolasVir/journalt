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

        var deleteResult = await _sut.DeleteAsync(otherUserLib.Id);
        Assert.False(deleteResult.Succeeded);
        Assert.Equal(404, deleteResult.StatusCode);
    }

    [Fact]
    public async Task DeleteAsync_WhenEmpty_DeletesSuccessfully()
    {
        var lib = (await _sut.CreateAsync(new CreateLibraryRequest("To Delete"))).Library!;

        var result = await _sut.DeleteAsync(lib.Id);

        Assert.True(result.Succeeded);
        Assert.False(await _db.Libraries.AnyAsync(l => l.Id == lib.Id));
    }

    [Fact]
    public async Task DeleteAsync_WhenContainsNotes_FailsWithConflict()
    {
        var lib = (await _sut.CreateAsync(new CreateLibraryRequest("With Notes"))).Library!;
        _db.Notes.Add(new Note
        {
            UserId = _userId,
            LibraryId = lib.Id,
            Title = "Note inside lib",
            BodyMarkdown = "content",
            RenderedHtml = "<p>content</p>"
        });
        await _db.SaveChangesAsync();

        var result = await _sut.DeleteAsync(lib.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(409, result.StatusCode);
        Assert.Contains("contain notes", result.Errors[0]);
    }

    [Fact]
    public async Task DeleteAsync_WhenHasSubLibraries_FailsWithConflict()
    {
        var parent = (await _sut.CreateAsync(new CreateLibraryRequest("Parent"))).Library!;
        await _sut.CreateAsync(new CreateLibraryRequest("Child", parent.Id));

        var result = await _sut.DeleteAsync(parent.Id);

        Assert.False(result.Succeeded);
        Assert.Equal(409, result.StatusCode);
        Assert.Contains("subfolders", result.Errors[0]);
    }

    [Fact]
    public async Task DeleteAsync_NonExistent_ReturnsNotFound()
    {
        var notFoundResult = await _sut.DeleteAsync(Guid.NewGuid());
        Assert.False(notFoundResult.Succeeded);
        Assert.Equal(404, notFoundResult.StatusCode);
    }

    [Fact]
    public async Task GetTreeAsync_CalculatesNotesCountExcludingTrashed()
    {
        var lib = (await _sut.CreateAsync(new CreateLibraryRequest("Notes Count Lib"))).Library!;
        _db.Notes.AddRange(
            new Note { UserId = _userId, LibraryId = lib.Id, Title = "N1", BodyMarkdown = "c1", RenderedHtml = "<p>c1</p>", IsTrashed = false },
            new Note { UserId = _userId, LibraryId = lib.Id, Title = "N2", BodyMarkdown = "c2", RenderedHtml = "<p>c2</p>", IsTrashed = false },
            new Note { UserId = _userId, LibraryId = lib.Id, Title = "N3", BodyMarkdown = "c3", RenderedHtml = "<p>c3</p>", IsTrashed = true }
        );
        await _db.SaveChangesAsync();

        var tree = await _sut.GetTreeAsync();
        var item = tree.First(t => t.Id == lib.Id);

        Assert.Equal(2, item.NotesCount);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
