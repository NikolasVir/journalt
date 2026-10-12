namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Libraries.DTOs;

public interface ILibraryService
{
    Task<LibraryResult> CreateAsync(CreateLibraryRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<LibraryTreeResponse>> GetTreeAsync(CancellationToken ct = default);
    Task<IReadOnlyList<LibraryTreeResponse>> GetSharedTreeAsync(CancellationToken ct = default);
    Task<IReadOnlyList<LibraryResponse>> ListFlatAsync(bool includeShared = true, CancellationToken ct = default);
    Task<LibraryResult> RenameAsync(Guid id, RenameLibraryRequest request, CancellationToken ct = default);
    Task<LibraryResult> MoveAsync(Guid id, MoveLibraryRequest request, CancellationToken ct = default);
    Task<LibraryResult> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<LibrarySharesResponse?> GetSharesAsync(Guid libraryId, CancellationToken ct = default);
    Task<ShareLibraryResult> ShareLibraryAsync(Guid libraryId, ShareLibraryRequest request, CancellationToken ct = default);
    Task<ShareLibraryResult> RemoveShareAsync(Guid libraryId, Guid targetUserId, CancellationToken ct = default);
    Task<bool> HasLibraryAccessAsync(Guid libraryId, Guid userId, CancellationToken ct = default);
    Task<HashSet<Guid>> GetAccessibleLibraryIdsAsync(Guid userId, CancellationToken ct = default);
}
