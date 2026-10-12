namespace JournalT.Application.Notes.DTOs;

using JournalT.Domain.Enums;

/// <summary>Describes a wiki-link that could not be resolved at render time.</summary>
/// <param name="Title">The raw title token from the [[...]] syntax.</param>
/// <param name="Reason">Human-readable reason: "not_found" or "ambiguous".</param>
public sealed record WikiLinkWarning(string Title, string Reason);

public sealed record NoteResponse(
    Guid Id,
    Guid UserId,
    NoteLevel Level,
    string Title,
    string? Summary,
    string BodyMarkdown,
    string RenderedHtml,
    Guid? LibraryId,
    Guid? TypeId,
    int? TypeVersion,
    string? TypedMetadataJson,
    bool IsTodo,
    DateTime? TodoCompletedAtUtc,
    bool IsTrashed,
    DateTime? TrashedAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    IReadOnlyList<TagDto> Tags,
    IReadOnlyList<string> WikiLinks,
    NoteFormat Format = NoteFormat.Markdown,
    IReadOnlyList<NoteSourceResponse>? Sources = null,
    IReadOnlyList<NoteRelationResponse>? OutboundRelations = null,
    /// <summary>Relations from other non-trashed notes that target this note.</summary>
    IReadOnlyList<NoteBacklinkResponse>? Backlinks = null,
    /// <summary>Wiki-links that could not be resolved (not_found or ambiguous). Does not prevent saving.</summary>
    IReadOnlyList<WikiLinkWarning>? UnresolvedWikiLinks = null,
    /// <summary>Validation warnings when note content/metadata is incompatible with its current Type definition.</summary>
    IReadOnlyList<string>? TypeValidationWarnings = null,
    bool IsOwner = true,
    bool IsShared = false,
    string? OwnerUserName = null,
    IReadOnlyList<NoteShareUserDto>? Shares = null,
    bool IsPinned = false,
    DateTime? PinnedAtUtc = null
);
