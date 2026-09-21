namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Libraries.DTOs;

public interface ILibraryService
{
    Task<LibraryResult> CreateAsync(CreateLibraryRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<LibraryTreeResponse>> GetTreeAsync(CancellationToken ct = default);
    Task<IReadOnlyList<LibraryResponse>> ListFlatAsync(CancellationToken ct = default);
    Task<LibraryResult> RenameAsync(Guid id, RenameLibraryRequest request, CancellationToken ct = default);
    Task<LibraryResult> MoveAsync(Guid id, MoveLibraryRequest request, CancellationToken ct = default);
}
