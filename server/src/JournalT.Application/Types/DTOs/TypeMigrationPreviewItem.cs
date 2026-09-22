namespace JournalT.Application.Types.DTOs;

/// <summary>Represents one note that would be affected by migrating to a new type version.</summary>
public sealed record TypeMigrationPreviewItem(
    Guid NoteId,
    string NoteTitle,
    int CurrentTypeVersion,
    int TargetTypeVersion,
    bool MetadataValid,       // whether existing TypedMetadataJson passes the new schema
    bool SectionsValid,       // whether existing BodyMarkdown passes the new sections spec
    IReadOnlyList<string> ValidationErrors  // errors under the new schema/sections
);
