namespace JournalT.Infrastructure.Vault;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Vault.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

public sealed class VaultService(
    JournalTDbContext db,
    ICurrentUser currentUser) : IVaultService
{
    private readonly JournalTDbContext _db = db;
    private readonly ICurrentUser _currentUser = currentUser;

    public async Task<VaultCanaryResponse> GetCanaryAsync(string partitionToken, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var canary = await _db.VaultCanaries
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.PartitionToken == partitionToken, ct);

        if (canary is null)
        {
            return new VaultCanaryResponse(false, null, null, null);
        }

        return new VaultCanaryResponse(true, canary.EncryptedCanary, canary.Nonce, canary.AuthTag);
    }

    public async Task<bool> InitializeVaultAsync(InitializeVaultRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var existing = await _db.VaultCanaries
            .FirstOrDefaultAsync(c => c.UserId == userId && c.PartitionToken == request.PartitionToken, ct);

        if (existing is not null)
        {
            return true;
        }

        var canary = new VaultCanary
        {
            UserId = userId,
            PartitionToken = request.PartitionToken,
            EncryptedCanary = request.EncryptedCanary,
            Nonce = request.Nonce,
            AuthTag = request.AuthTag
        };

        _db.VaultCanaries.Add(canary);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<VaultNoteDto>> ListNotesAsync(string partitionToken, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var notes = await _db.VaultNotes
            .AsNoTracking()
            .Where(n => n.UserId == userId && n.PartitionToken == partitionToken)
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.PinnedAtUtc)
            .ThenByDescending(n => n.UpdatedAtUtc)
            .Select(n => new VaultNoteDto(
                n.Id,
                n.PartitionToken,
                n.EncryptedPayload,
                n.Nonce,
                n.AuthTag,
                n.IsPinned,
                n.PinnedAtUtc,
                n.CreatedAtUtc,
                n.UpdatedAtUtc))
            .ToListAsync(ct);

        return notes;
    }

    public async Task<VaultNoteDto?> GetNoteByIdAsync(Guid id, string partitionToken, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.VaultNotes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.PartitionToken == partitionToken, ct);

        if (note is null) return null;

        return new VaultNoteDto(
            note.Id,
            note.PartitionToken,
            note.EncryptedPayload,
            note.Nonce,
            note.AuthTag,
            note.IsPinned,
            note.PinnedAtUtc,
            note.CreatedAtUtc,
            note.UpdatedAtUtc);
    }

    public async Task<VaultNoteDto> CreateNoteAsync(CreateVaultNoteRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = new VaultNote
        {
            UserId = userId,
            PartitionToken = request.PartitionToken,
            EncryptedPayload = request.EncryptedPayload,
            Nonce = request.Nonce,
            AuthTag = request.AuthTag,
            IsPinned = request.IsPinned,
            PinnedAtUtc = request.IsPinned ? DateTime.UtcNow : null
        };

        _db.VaultNotes.Add(note);
        await _db.SaveChangesAsync(ct);

        return new VaultNoteDto(
            note.Id,
            note.PartitionToken,
            note.EncryptedPayload,
            note.Nonce,
            note.AuthTag,
            note.IsPinned,
            note.PinnedAtUtc,
            note.CreatedAtUtc,
            note.UpdatedAtUtc);
    }

    public async Task<VaultNoteDto?> UpdateNoteAsync(Guid id, string partitionToken, UpdateVaultNoteRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.VaultNotes
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.PartitionToken == partitionToken, ct);

        if (note is null) return null;

        note.EncryptedPayload = request.EncryptedPayload;
        note.Nonce = request.Nonce;
        note.AuthTag = request.AuthTag;
        note.IsPinned = request.IsPinned;
        note.PinnedAtUtc = request.IsPinned ? (note.PinnedAtUtc ?? DateTime.UtcNow) : null;

        await _db.SaveChangesAsync(ct);

        return new VaultNoteDto(
            note.Id,
            note.PartitionToken,
            note.EncryptedPayload,
            note.Nonce,
            note.AuthTag,
            note.IsPinned,
            note.PinnedAtUtc,
            note.CreatedAtUtc,
            note.UpdatedAtUtc);
    }

    public async Task<bool> DeleteNoteAsync(Guid id, string partitionToken, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.VaultNotes
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.PartitionToken == partitionToken, ct);

        if (note is null) return false;

        _db.VaultNotes.Remove(note);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<VaultNoteDto?> TogglePinAsync(Guid id, string partitionToken, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var note = await _db.VaultNotes
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId && n.PartitionToken == partitionToken, ct);

        if (note is null) return null;

        note.IsPinned = !note.IsPinned;
        note.PinnedAtUtc = note.IsPinned ? DateTime.UtcNow : null;

        await _db.SaveChangesAsync(ct);

        return new VaultNoteDto(
            note.Id,
            note.PartitionToken,
            note.EncryptedPayload,
            note.Nonce,
            note.AuthTag,
            note.IsPinned,
            note.PinnedAtUtc,
            note.CreatedAtUtc,
            note.UpdatedAtUtc);
    }

    public async Task<bool> ChangePassphraseAsync(ChangeVaultPassphraseRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var oldCanary = await _db.VaultCanaries
            .FirstOrDefaultAsync(c => c.UserId == userId && c.PartitionToken == request.OldPartitionToken, ct);

        if (oldCanary is null)
        {
            return false;
        }

        var oldNotes = await _db.VaultNotes
            .Where(n => n.UserId == userId && n.PartitionToken == request.OldPartitionToken)
            .ToListAsync(ct);

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            _db.VaultCanaries.Remove(oldCanary);
            _db.VaultNotes.RemoveRange(oldNotes);

            var newCanary = new VaultCanary
            {
                UserId = userId,
                PartitionToken = request.NewPartitionToken,
                EncryptedCanary = request.NewEncryptedCanary,
                Nonce = request.NewNonce,
                AuthTag = request.NewAuthTag
            };
            _db.VaultCanaries.Add(newCanary);

            var oldNotesDict = oldNotes.ToDictionary(n => n.Id);
            foreach (var item in request.Notes)
            {
                var createdAt = oldNotesDict.TryGetValue(item.Id, out var existing) ? existing.CreatedAtUtc : DateTime.UtcNow;
                var pinnedAt = item.IsPinned ? (oldNotesDict.TryGetValue(item.Id, out var p) && p.PinnedAtUtc.HasValue ? p.PinnedAtUtc : DateTime.UtcNow) : null;

                var newNote = new VaultNote
                {
                    Id = item.Id,
                    UserId = userId,
                    PartitionToken = request.NewPartitionToken,
                    EncryptedPayload = item.EncryptedPayload,
                    Nonce = item.Nonce,
                    AuthTag = item.AuthTag,
                    IsPinned = item.IsPinned,
                    PinnedAtUtc = pinnedAt,
                    CreatedAtUtc = createdAt,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                _db.VaultNotes.Add(newNote);
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return true;
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<bool> DeleteVaultAsync(string partitionToken, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        var canary = await _db.VaultCanaries
            .FirstOrDefaultAsync(c => c.UserId == userId && c.PartitionToken == partitionToken, ct);

        if (canary is null)
        {
            return false;
        }

        var notes = await _db.VaultNotes
            .Where(n => n.UserId == userId && n.PartitionToken == partitionToken)
            .ToListAsync(ct);

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            _db.VaultNotes.RemoveRange(notes);
            _db.VaultCanaries.Remove(canary);
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return true;
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }
}
