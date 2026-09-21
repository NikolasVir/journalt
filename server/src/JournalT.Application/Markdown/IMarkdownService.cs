namespace JournalT.Application.Markdown;

public record WikiLinkResolution(string Title, Guid? NoteId, bool IsAmbiguous = false);

public record MarkdownRenderResult(
    string RenderedHtml,
    IReadOnlyList<string> ExtractedWikiLinks,
    IReadOnlyList<WikiLinkResolution> ResolvedLinks
);

public interface IMarkdownService
{
    MarkdownRenderResult Render(string markdown, IReadOnlyDictionary<string, Guid>? resolvedTitles = null);
    IReadOnlyList<string> ExtractWikiLinks(string markdown);
}
