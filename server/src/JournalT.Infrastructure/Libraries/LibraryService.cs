namespace JournalT.Infrastructure.Libraries;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Libraries.DTOs;
using JournalT.Domain.Entities;
using Microsoft.EntityFrameworkCore;

public sealed class LibraryService(
    IJournalTDbContext db,
    ICurrentUser currentUser) : ILibraryService
{
    private readonly IJournalTDbContext _db = db;
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

    public async Task<IReadOnlyList<LibraryResponse>> ListFlatAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var items = await _db.Libraries
            .AsNoTracking()
            .Where(l => l.UserId == userId)
            .OrderBy(l => l.Name)
            .Select(l => new LibraryResponse(
                l.Id,
                l.ParentLibraryId,
                l.Name,
                l.CreatedAtUtc,
                l.UpdatedAtUtc
            ))
            .ToListAsync(ct);

        return items;
    }

    public async Task<IReadOnlyList<LibraryTreeResponse>> GetTreeAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId;
        var allLibraries = await _db.Libraries
            .AsNoTracking()
            .Where(l => l.UserId == userId)
            .OrderBy(l => l.Name)
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
                    BuildChildren(l.Id)
                ))
                .ToList();
        }

        return BuildChildren(null);
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
}
