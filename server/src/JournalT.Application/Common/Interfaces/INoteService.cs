namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Common.Models;
using JournalT.Application.Notes.DTOs;

public interface INoteService
{
    Task<NoteResult> CreateAsync(CreateNoteRequest request, CancellationToken ct = default);
    Task<NoteResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<NoteSummaryResponse>> ListAsync(NoteFilterParams filter, CancellationToken ct = default);
    Task<NoteResult> UpdateAsync(Guid id, UpdateNoteRequest request, CancellationToken ct = default);
    Task<bool> TrashAsync(Guid id, CancellationToken ct = default);
    Task<bool> RestoreAsync(Guid id, CancellationToken ct = default);
    Task<bool> DeletePermanentAsync(Guid id, CancellationToken ct = default);
}
