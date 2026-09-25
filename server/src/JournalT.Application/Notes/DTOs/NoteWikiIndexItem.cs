namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

/// <summary>
/// Minimal projection of a wiki-eligible note, used to build the Explore
/// library tree and its counts without paging through full note bodies.
/// Only Journal and Quick notes are included; Inbox is transient and excluded.
/// </summary>
/// <param name="IsReferenced">
/// True when another non-trashed note holds a relation pointing at this one.
/// Quick notes join the wiki through filing or through being referenced.
/// </param>
public sealed record NoteWikiIndexItem(
    Guid Id,
    NoteLevel Level,
    string Title,
    Guid? LibraryId,
    Guid? TypeId,
    DateTime UpdatedAtUtc,
    bool IsReferenced
);
