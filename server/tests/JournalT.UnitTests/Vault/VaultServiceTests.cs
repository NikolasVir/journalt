namespace JournalT.UnitTests.Vault;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Vault.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Identity;
using JournalT.Infrastructure.Persistence;
using JournalT.Infrastructure.Vault;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

public class VaultServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly JournalTDbContext _db;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _otherUserId = Guid.NewGuid();
    private readonly VaultService _sut;

    public VaultServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<JournalTDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new JournalTDbContext(options);
        _db.Database.EnsureCreated();

        _db.Users.AddRange(
            new AppUser { Id = _userId, UserName = "VaultUser", NormalizedUserName = "VAULTUSER", IsActive = true },
            new AppUser { Id = _otherUserId, UserName = "OtherUser", NormalizedUserName = "OTHERUSER", IsActive = true }
        );
        _db.SaveChanges();

        var currentUser = new TestCurrentUser(_userId);
        _sut = new VaultService(_db, currentUser);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Canary_WhenNotInitialized_ReturnsExistsFalse()
    {
        var result = await _sut.GetCanaryAsync("partition-123");

        Assert.False(result.Exists);
        Assert.Null(result.EncryptedCanary);
    }

    [Fact]
    public async Task InitializeVault_SucceedsAndCanaryIsRetrievable()
    {
        var init = new InitializeVaultRequest("partition-123", "enc-canary", "nonce-1", "tag-1");
        var initialized = await _sut.InitializeVaultAsync(init);

        Assert.True(initialized);

        var canary = await _sut.GetCanaryAsync("partition-123");
        Assert.True(canary.Exists);
        Assert.Equal("enc-canary", canary.EncryptedCanary);
        Assert.Equal("nonce-1", canary.Nonce);
        Assert.Equal("tag-1", canary.AuthTag);
    }

    [Fact]
    public async Task Notes_AreIsolatedByPartitionAndUser()
    {
        var partitionA = "token-partition-a";
        var partitionB = "token-partition-b";

        var noteA1 = await _sut.CreateNoteAsync(new CreateVaultNoteRequest(partitionA, "payload-a1", "n1", "t1", false));
        var noteA2 = await _sut.CreateNoteAsync(new CreateVaultNoteRequest(partitionA, "payload-a2", "n2", "t2", true));
        var noteB1 = await _sut.CreateNoteAsync(new CreateVaultNoteRequest(partitionB, "payload-b1", "nb1", "tb1", false));

        var notesA = await _sut.ListNotesAsync(partitionA);
        var notesB = await _sut.ListNotesAsync(partitionB);

        Assert.Equal(2, notesA.Count);
        Assert.Single(notesB);
        Assert.Equal(noteB1.Id, notesB[0].Id);

        // Pinned notes sort first
        Assert.True(notesA[0].IsPinned);
        Assert.Equal(noteA2.Id, notesA[0].Id);

        // Other user cannot see notes
        var otherUserSut = new VaultService(_db, new TestCurrentUser(_otherUserId));
        var otherUserNotes = await otherUserSut.ListNotesAsync(partitionA);
        Assert.Empty(otherUserNotes);
    }

    [Fact]
    public async Task UpdateAndDeleteNote_WorksProperly()
    {
        var partition = "token-partition-crud";
        var created = await _sut.CreateNoteAsync(new CreateVaultNoteRequest(partition, "orig-payload", "n1", "t1", false));

        var updated = await _sut.UpdateNoteAsync(created.Id, partition, new UpdateVaultNoteRequest("updated-payload", "n2", "t2", true));
        Assert.NotNull(updated);
        Assert.Equal("updated-payload", updated.EncryptedPayload);
        Assert.True(updated.IsPinned);

        var toggled = await _sut.TogglePinAsync(created.Id, partition);
        Assert.NotNull(toggled);
        Assert.False(toggled.IsPinned);

        var deleted = await _sut.DeleteNoteAsync(created.Id, partition);
        Assert.True(deleted);

        var remaining = await _sut.ListNotesAsync(partition);
        Assert.Empty(remaining);
    }

    [Fact]
    public async Task ChangePassphrase_MigratesCanaryAndNotesAtomically()
    {
        var oldPartition = "partition-old";
        var newPartition = "partition-new";

        await _sut.InitializeVaultAsync(new InitializeVaultRequest(oldPartition, "old-canary", "n1", "t1"));
        var note = await _sut.CreateNoteAsync(new CreateVaultNoteRequest(oldPartition, "old-payload", "n2", "t2", true));

        var req = new ChangeVaultPassphraseRequest(
            oldPartition,
            newPartition,
            "new-canary",
            "n-new-canary",
            "t-new-canary",
            [new MigrateVaultNoteItem(note.Id, "new-payload", "n-new", "t-new", true)]);

        var result = await _sut.ChangePassphraseAsync(req);
        Assert.True(result);

        // Old partition should be gone
        var oldCanary = await _sut.GetCanaryAsync(oldPartition);
        Assert.False(oldCanary.Exists);
        var oldNotes = await _sut.ListNotesAsync(oldPartition);
        Assert.Empty(oldNotes);

        // New partition should be present with new payload
        var newCanary = await _sut.GetCanaryAsync(newPartition);
        Assert.True(newCanary.Exists);
        Assert.Equal("new-canary", newCanary.EncryptedCanary);

        var newNotes = await _sut.ListNotesAsync(newPartition);
        Assert.Single(newNotes);
        Assert.Equal(note.Id, newNotes[0].Id);
        Assert.Equal("new-payload", newNotes[0].EncryptedPayload);
        Assert.True(newNotes[0].IsPinned);
    }

    private sealed class TestCurrentUser(Guid userId) : ICurrentUser
    {
        public Guid UserId { get; } = userId;
    }
}
