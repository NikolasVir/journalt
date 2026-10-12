namespace JournalT.Infrastructure.Libraries;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Libraries.DTOs;
using JournalT.Domain.Entities;
using JournalT.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

public sealed class LibraryService(
    JournalTDbContext db,
    ICurrentUser currentUser) : ILibraryService
{
    private readonly JournalTDbContext _db = db;
    private readonly ICurrentUser _currentUser = currentUser;

    public async Task<LibraryResult> CreateAsync(CreateLibraryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return LibraryResult.Failure("Library name is required.");

        var userId = _currentUser.UserId;
        var trimmedName = request.Name.Trim();

        if (request.ParentLibraryId.HasValue)
        {
            var parentExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.ParentLibraryId.Value && l.UserId == userId, ct);
            if (!parentExists)
                return LibraryResult.Failure("Parent library not found.");
        }

        var nameExists = await _db.Libraries
            .AnyAsync(l => l.UserId == userId &&
                           l.ParentLibraryId == request.ParentLibraryId &&
                           l.Name.ToLower() == trimmedName.ToLower(), ct);

        if (nameExists)
            return LibraryResult.Failure("A library with the same name already exists in this folder.", 409);

        var library = new Library
        {
            UserId = userId,
            ParentLibraryId = request.ParentLibraryId,
            Name = trimmedName
        };

        _db.Libraries.Add(library);
        await _db.SaveChangesAsync(ct);

        return LibraryResult.Success(new LibraryResponse(
            library.Id,
            library.ParentLibraryId,
            library.Name,
            library.CreatedAtUtc,
            library.UpdatedAtUtc
        ), 201);
    }

    public async Task<IReadOnlyList<LibraryResponse>> ListFlatAsync(bool includeShared = true, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var ownLibraries = await _db.Libraries
            .AsNoTracking()
            .Include(l => l.Shares)
            .Where(l => l.UserId == userId)
            .OrderBy(l => l.Name)
            .Select(l => new LibraryResponse(
                l.Id,
                l.ParentLibraryId,
                l.Name,
                l.CreatedAtUtc,
                l.UpdatedAtUtc,
                true,
                l.Shares.Any(),
                null,
                l.UserId
            ))
            .ToListAsync(ct);

        if (!includeShared)
            return ownLibraries;

        var sharedTree = await GetSharedTreeAsync(ct);
        var flatShared = new List<LibraryResponse>();

        void Flatten(IReadOnlyList<LibraryTreeResponse> nodes)
        {
            foreach (var node in nodes)
            {
                flatShared.Add(new LibraryResponse(
                    node.Id,
                    node.ParentLibraryId,
                    node.Name,
                    node.CreatedAtUtc,
                    node.UpdatedAtUtc,
                    false,
                    true,
                    node.OwnerUserName,
                    node.OwnerId
                ));
                Flatten(node.Children);
            }
        }

        Flatten(sharedTree);
        return [.. ownLibraries, .. flatShared];
    }

    public async Task<IReadOnlyList<LibraryTreeResponse>> GetTreeAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var allLibraries = await _db.Libraries
            .AsNoTracking()
            .Include(l => l.Shares)
            .Where(l => l.UserId == userId)
            .OrderBy(l => l.Name)
            .Select(l => new
            {
                l.Id,
                l.ParentLibraryId,
                l.Name,
                l.CreatedAtUtc,
                l.UpdatedAtUtc,
                IsShared = l.Shares.Any(),
                NotesCount = l.Notes.Count(n => !n.IsTrashed)
            })
            .ToListAsync(ct);

        var lookup = allLibraries.ToLookup(l => l.ParentLibraryId);

        IReadOnlyList<LibraryTreeResponse> BuildChildren(Guid? parentId)
        {
            return lookup[parentId]
                .Select(l => new LibraryTreeResponse(
                    l.Id,
                    l.ParentLibraryId,
                    l.Name,
                    l.CreatedAtUtc,
                    l.UpdatedAtUtc,
                    BuildChildren(l.Id),
                    l.NotesCount,
                    true,
                    l.IsShared,
                    null,
                    userId
                ))
                .ToList();
        }

        return BuildChildren(null);
    }

    public async Task<IReadOnlyList<LibraryTreeResponse>> GetSharedTreeAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;

        // Find all direct library shares for the current user
        var directShares = await _db.LibraryShares
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .Select(s => s.LibraryId)
            .ToListAsync(ct);

        if (directShares.Count == 0)
            return [];

        // Load the shared libraries and their owners
        var sharedLibraries = await _db.Libraries
            .AsNoTracking()
            .Where(l => directShares.Contains(l.Id))
            .ToListAsync(ct);

        var ownerIds = sharedLibraries.Select(l => l.UserId).Distinct().ToList();

        // Load all libraries owned by these owners to properly resolve the full subfolder trees
        var allOwnerLibraries = await _db.Libraries
            .AsNoTracking()
            .Where(l => ownerIds.Contains(l.UserId))
            .Select(l => new
            {
                l.Id,
                l.UserId,
                l.ParentLibraryId,
                l.Name,
                l.CreatedAtUtc,
                l.UpdatedAtUtc,
                NotesCount = l.Notes.Count(n => !n.IsTrashed)
            })
            .ToListAsync(ct);

        var ownerNames = await _db.Users
            .AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.UserName ?? string.Empty, ct);

        // A shared library is a root in the shared view if its parent is NOT also shared with this user
        var directShareSet = new HashSet<Guid>(directShares);
        var roots = sharedLibraries
            .Where(l => !l.ParentLibraryId.HasValue || !directShareSet.Contains(l.ParentLibraryId.Value))
            .OrderBy(l => l.Name)
            .ToList();

        var ownerLookup = allOwnerLibraries.ToLookup(l => l.ParentLibraryId);

        IReadOnlyList<LibraryTreeResponse> BuildSharedChildren(Guid parentId, Guid ownerId, string ownerName)
        {
            return ownerLookup[parentId]
                .OrderBy(l => l.Name)
                .Select(l => new LibraryTreeResponse(
                    l.Id,
                    l.ParentLibraryId,
                    l.Name,
                    l.CreatedAtUtc,
                    l.UpdatedAtUtc,
                    BuildSharedChildren(l.Id, ownerId, ownerName),
                    l.NotesCount,
                    false,
                    true,
                    ownerName,
                    ownerId
                ))
                .ToList();
        }

        var result = new List<LibraryTreeResponse>();
        foreach (var root in roots)
        {
            var ownerName = ownerNames.TryGetValue(root.UserId, out var name) ? name : string.Empty;
            var notesCount = allOwnerLibraries.FirstOrDefault(l => l.Id == root.Id)?.NotesCount ?? 0;

            result.Add(new LibraryTreeResponse(
                root.Id,
                null, // In the recipient's shared view, this node is rendered as a top-level shared root
                root.Name,
                root.CreatedAtUtc,
                root.UpdatedAtUtc,
                BuildSharedChildren(root.Id, root.UserId, ownerName),
                notesCount,
                false,
                true,
                ownerName,
                root.UserId
            ));
        }

        return result;
    }

    public async Task<HashSet<Guid>> GetAccessibleLibraryIdsAsync(Guid userId, CancellationToken ct = default)
    {
        var accessible = new HashSet<Guid>();

        // 1. Personal libraries
        var ownIds = await _db.Libraries
            .AsNoTracking()
            .Where(l => l.UserId == userId)
            .Select(l => l.Id)
            .ToListAsync(ct);

        foreach (var id in ownIds) accessible.Add(id);

        // 2. Direct library shares
        var directSharedLibIds = await _db.LibraryShares
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .Select(s => s.LibraryId)
            .ToListAsync(ct);

        if (directSharedLibIds.Count == 0)
            return accessible;

        // 3. Descendants of shared libraries
        var sharedLibs = await _db.Libraries
            .AsNoTracking()
            .Where(l => directSharedLibIds.Contains(l.Id))
            .ToListAsync(ct);

        var ownerIds = sharedLibs.Select(l => l.UserId).Distinct().ToList();
        var allOwnerLibs = await _db.Libraries
            .AsNoTracking()
            .Where(l => ownerIds.Contains(l.UserId))
            .Select(l => new { l.Id, l.ParentLibraryId })
            .ToListAsync(ct);

        var childrenLookup = allOwnerLibs.ToLookup(l => l.ParentLibraryId);

        void AddDescendants(Guid parentId)
        {
            accessible.Add(parentId);
            foreach (var child in childrenLookup[parentId])
            {
                AddDescendants(child.Id);
            }
        }

        foreach (var directId in directSharedLibIds)
        {
            AddDescendants(directId);
        }

        return accessible;
    }

    public async Task<bool> HasLibraryAccessAsync(Guid libraryId, Guid userId, CancellationToken ct = default)
    {
        var accessible = await GetAccessibleLibraryIdsAsync(userId, ct);
        return accessible.Contains(libraryId);
    }

    public async Task<LibrarySharesResponse?> GetSharesAsync(Guid libraryId, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId;
        var library = await _db.Libraries
            .Include(l => l.Shares)
            .FirstOrDefaultAsync(l => l.Id == libraryId, ct);

        if (library is null) return null;

        var hasAccess = library.UserId == currentUserId || library.Shares.Any(s => s.UserId == currentUserId);
        if (!hasAccess)
        {
            // Also check if user has access via ancestor library share
            var accessible = await GetAccessibleLibraryIdsAsync(currentUserId, ct);
            if (!accessible.Contains(libraryId))
                return null;
        }

        var isOwner = library.UserId == currentUserId;
        var ownerUserName = await _db.Users
            .Where(u => u.Id == library.UserId)
            .Select(u => u.UserName)
            .FirstOrDefaultAsync(ct) ?? string.Empty;

        var shareUserIds = library.Shares.Select(s => s.UserId).ToList();
        var usersMap = await _db.Users
            .Where(u => shareUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.UserName ?? string.Empty, ct);

        var sharesList = library.Shares
            .Select(s => new LibraryShareUserDto(
                s.UserId,
                usersMap.TryGetValue(s.UserId, out var name) ? name : string.Empty,
                s.CreatedAtUtc))
            .OrderBy(s => s.UserName)
            .ToList();

        return new LibrarySharesResponse(library.Id, library.UserId, ownerUserName, isOwner, sharesList);
    }

    public async Task<ShareLibraryResult> ShareLibraryAsync(Guid libraryId, ShareLibraryRequest request, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId;
        var library = await _db.Libraries
            .Include(l => l.Shares)
            .FirstOrDefaultAsync(l => l.Id == libraryId, ct);

        if (library is null)
            return ShareLibraryResult.NotFound("Library not found.");

        if (library.UserId != currentUserId)
            return ShareLibraryResult.Forbidden("Only the library owner can share this library.");

        if (!request.UserId.HasValue && string.IsNullOrWhiteSpace(request.UserName))
            return ShareLibraryResult.Failure("User is required.");

        var targetUserQuery = _db.Users.AsNoTracking().Where(u => u.IsActive);
        var targetUser = request.UserId.HasValue
            ? await targetUserQuery.FirstOrDefaultAsync(u => u.Id == request.UserId.Value, ct)
            : await targetUserQuery.FirstOrDefaultAsync(u => u.NormalizedUserName == request.UserName!.Trim().ToUpperInvariant(), ct);

        if (targetUser is null)
            return ShareLibraryResult.Failure("User not found.");

        if (targetUser.Id == currentUserId)
            return ShareLibraryResult.Failure("You cannot share a library with yourself.");

        if (library.Shares.Any(s => s.UserId == targetUser.Id))
            return ShareLibraryResult.Conflict("Library is already shared with this user.");

        var share = new LibraryShare
        {
            LibraryId = libraryId,
            UserId = targetUser.Id
        };

        _db.LibraryShares.Add(share);
        await _db.SaveChangesAsync(ct);

        var sharesResponse = await GetSharesAsync(libraryId, ct);
        return ShareLibraryResult.Success(sharesResponse!);
    }

    public async Task<ShareLibraryResult> RemoveShareAsync(Guid libraryId, Guid targetUserId, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId;
        var library = await _db.Libraries
            .Include(l => l.Shares)
            .FirstOrDefaultAsync(l => l.Id == libraryId, ct);

        if (library is null)
            return ShareLibraryResult.NotFound("Library not found.");

        var isOwner = library.UserId == currentUserId;
        var isSelf = targetUserId == currentUserId;

        if (!isOwner && !isSelf)
            return ShareLibraryResult.Forbidden("You do not have permission to modify sharing for this library.");

        var share = library.Shares.FirstOrDefault(s => s.UserId == targetUserId);
        if (share is null)
            return ShareLibraryResult.Failure("Share not found.");

        _db.LibraryShares.Remove(share);
        await _db.SaveChangesAsync(ct);

        return ShareLibraryResult.Success();
    }

    public async Task<LibraryResult> RenameAsync(Guid id, RenameLibraryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return LibraryResult.Failure("Library name is required.");

        var userId = _currentUser.UserId;
        var library = await _db.Libraries
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId, ct);

        if (library is null)
            return LibraryResult.NotFound();

        var trimmedName = request.Name.Trim();
        if (trimmedName != library.Name)
        {
            var siblingExists = await _db.Libraries
                .AnyAsync(l => l.UserId == userId &&
                               l.Id != id &&
                               l.ParentLibraryId == library.ParentLibraryId &&
                               l.Name.ToLower() == trimmedName.ToLower(), ct);

            if (siblingExists)
                return LibraryResult.Failure("A sibling library with the same name already exists.", 409);

            library.Name = trimmedName;
            await _db.SaveChangesAsync(ct);
        }

        return LibraryResult.Success(new LibraryResponse(
            library.Id,
            library.ParentLibraryId,
            library.Name,
            library.CreatedAtUtc,
            library.UpdatedAtUtc
        ));
    }

    public async Task<LibraryResult> MoveAsync(Guid id, MoveLibraryRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var library = await _db.Libraries
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId, ct);

        if (library is null)
            return LibraryResult.NotFound();

        if (request.NewParentLibraryId == library.ParentLibraryId)
            return LibraryResult.Success(new LibraryResponse(library.Id, library.ParentLibraryId, library.Name, library.CreatedAtUtc, library.UpdatedAtUtc));

        // Self cycle check
        if (request.NewParentLibraryId == id)
            return LibraryResult.Failure("Cannot move a library into itself.");

        // Descendant cycle check
        if (request.NewParentLibraryId.HasValue)
        {
            var targetParentExists = await _db.Libraries
                .AnyAsync(l => l.Id == request.NewParentLibraryId.Value && l.UserId == userId, ct);

            if (!targetParentExists)
                return LibraryResult.Failure("Target parent library not found.");

            var currentAncestorId = request.NewParentLibraryId;
            while (currentAncestorId.HasValue)
            {
                if (currentAncestorId.Value == id)
                    return LibraryResult.Failure("Cannot move a library into one of its descendants.");

                currentAncestorId = await _db.Libraries
                    .AsNoTracking()
                    .Where(l => l.Id == currentAncestorId.Value && l.UserId == userId)
                    .Select(l => l.ParentLibraryId)
                    .FirstOrDefaultAsync(ct);
            }
        }

        // Sibling name uniqueness under new parent
        var siblingExists = await _db.Libraries
            .AnyAsync(l => l.UserId == userId &&
                           l.Id != id &&
                           l.ParentLibraryId == request.NewParentLibraryId &&
                           l.Name.ToLower() == library.Name.ToLower(), ct);

        if (siblingExists)
            return LibraryResult.Failure("A library with the same name already exists in the target destination.", 409);

        library.ParentLibraryId = request.NewParentLibraryId;
        await _db.SaveChangesAsync(ct);

        return LibraryResult.Success(new LibraryResponse(
            library.Id,
            library.ParentLibraryId,
            library.Name,
            library.CreatedAtUtc,
            library.UpdatedAtUtc
        ));
    }

    public async Task<LibraryResult> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var library = await _db.Libraries
            .FirstOrDefaultAsync(l => l.Id == id && l.UserId == userId, ct);

        if (library is null)
            return LibraryResult.NotFound();

        var hasNotes = await _db.Notes
            .AnyAsync(n => n.LibraryId == id && n.UserId == userId && !n.IsTrashed, ct);

        if (hasNotes)
            return LibraryResult.Conflict("Libraries that contain notes cannot be deleted.");

        var hasSubLibraries = await _db.Libraries
            .AnyAsync(l => l.ParentLibraryId == id && l.UserId == userId, ct);

        if (hasSubLibraries)
            return LibraryResult.Conflict("Libraries that have subfolders cannot be deleted.");

        _db.Libraries.Remove(library);
        await _db.SaveChangesAsync(ct);

        return LibraryResult.Success();
    }
}
