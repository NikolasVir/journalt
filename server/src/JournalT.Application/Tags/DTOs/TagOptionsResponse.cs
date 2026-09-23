namespace JournalT.Application.Tags.DTOs;

public sealed record TagOptionsResponse(
    Guid Id,
    string Category,
    bool IsClosed,
    IReadOnlyList<string> Values
);
