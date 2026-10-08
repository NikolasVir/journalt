namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Common.Models;
using JournalT.Application.Notes.DTOs;

public interface INoteService
{
    Task<NoteResult> CreateAsync(CreateNoteRequest request, CancellationToken ct = default);
    Task<NoteResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<NoteSummaryResponse>> ListAsync(NoteFilterParams filter, CancellationToken ct = default);
    Task<IReadOnlyList<NoteWikiIndexItem>> GetWikiIndexAsync(CancellationToken ct = default);
    Task<NoteResult> UpdateAsync(Guid id, UpdateNoteRequest request, CancellationToken ct = default);
    Task<bool> TrashAsync(Guid id, CancellationToken ct = default);
    Task<bool> RestoreAsync(Guid id, CancellationToken ct = default);
    Task<bool> DeletePermanentAsync(Guid id, CancellationToken ct = default);

    // Promotion (Phase 3)
    Task<NoteResult> PromoteAsync(Guid id, PromoteNoteRequest request, CancellationToken ct = default);

    // Sources (Phase 3)
    Task<NoteSourceResponse?> AddSourceAsync(Guid noteId, CreateNoteSourceRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<NoteSourceResponse>> GetSourcesAsync(Guid noteId, CancellationToken ct = default);
    Task<bool> DeleteSourceAsync(Guid noteId, Guid sourceId, CancellationToken ct = default);

    // Relations (Phase 3)
    Task<NoteResult> AddRelationAsync(Guid noteId, CreateNoteRelationRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<NoteRelationResponse>> GetRelationsAsync(Guid noteId, CancellationToken ct = default);
    Task<IReadOnlyList<NoteBacklinkResponse>> GetBacklinksAsync(Guid noteId, CancellationToken ct = default);
    Task<bool> DeleteRelationAsync(Guid noteId, Guid relationId, CancellationToken ct = default);

    // Todo Hub (Phase 4)
    Task<NoteResponse?> ToggleTodoAsync(Guid id, CancellationToken ct = default);
    Task<TodoSummaryResponse> GetTodoSummaryAsync(CancellationToken ct = default);

    // Markdown Preview
    Task<string> RenderPreviewAsync(string markdown, CancellationToken ct = default);

    // Tags
    Task<IReadOnlyList<string>> GetDistinctTagsAsync(CancellationToken ct = default);

    // Note Sharing
    Task<NoteSharesResponse?> GetSharesAsync(Guid noteId, CancellationToken ct = default);
    Task<ShareNoteResult> ShareNoteAsync(Guid noteId, ShareNoteRequest request, CancellationToken ct = default);
    Task<ShareNoteResult> RemoveShareAsync(Guid noteId, Guid targetUserId, CancellationToken ct = default);
}
