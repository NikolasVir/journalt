namespace JournalT.Application.Notes.DTOs;

public record TodoSummaryResponse(
    int PendingCount,
    int CompletedCount,
    IReadOnlyList<NoteSummaryResponse> PendingTodos,
    IReadOnlyList<NoteSummaryResponse> RecentCompletedTodos
);
