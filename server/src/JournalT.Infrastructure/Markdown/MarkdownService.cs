namespace JournalT.Infrastructure.Markdown;

using System.IO;
using Ganss.Xss;
using JournalT.Application.Markdown;
using Markdig;
using Markdig.Renderers;
using Markdig.Syntax;

public class MarkdownService : IMarkdownService
{
    private readonly MarkdownPipeline _pipeline;
    private readonly HtmlSanitizer _sanitizer;

    public MarkdownService()
    {
        _pipeline = new MarkdownPipelineBuilder()
            .UseEmphasisExtras()
            .UseGridTables()
            .UsePipeTables()
            .UseTaskLists()
            .UseAutoLinks()
            .UseFootnotes()
            .UseDefinitionLists()
            .UseMathematics()
            .UseGenericAttributes()
            .UseAlertBlocks()
            .Use(new WikiLinkExtension())
            .Build();

        _sanitizer = new HtmlSanitizer();

        // Disallow external embedded media
        _sanitizer.AllowedTags.Remove("img");
        _sanitizer.AllowedTags.Remove("picture");
        _sanitizer.AllowedTags.Remove("video");
        _sanitizer.AllowedTags.Remove("audio");
        _sanitizer.AllowedTags.Remove("source");
        _sanitizer.AllowedTags.Remove("iframe");
        _sanitizer.AllowedTags.Remove("embed");
        _sanitizer.AllowedTags.Remove("object");

        // Allow classes and data attributes used for wiki-link resolution styling
        _sanitizer.AllowedAttributes.Add("class");
        _sanitizer.AllowedAttributes.Add("data-title");
    }

    public IReadOnlyList<string> ExtractWikiLinks(string markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown))
        {
            return [];
        }

        var document = Markdig.Markdown.Parse(markdown, _pipeline);
        return document.Descendants<WikiLinkInline>()
            .Select(w => w.Title)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public MarkdownRenderResult Render(string markdown, IReadOnlyDictionary<string, Guid>? resolvedTitles = null)
    {
        if (string.IsNullOrWhiteSpace(markdown))
        {
            return new MarkdownRenderResult(string.Empty, [], []);
        }

        var document = Markdig.Markdown.Parse(markdown, _pipeline);
        var wikiLinks = document.Descendants<WikiLinkInline>().ToList();

        var extractedTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var resolutions = new List<WikiLinkResolution>();

        foreach (var link in wikiLinks)
        {
            extractedTitles.Add(link.Title);

            if (resolvedTitles != null && resolvedTitles.TryGetValue(link.Title, out var noteId))
            {
                link.ResolvedNoteId = noteId;
                resolutions.Add(new WikiLinkResolution(link.Title, noteId, IsAmbiguous: false));
            }
            else
            {
                resolutions.Add(new WikiLinkResolution(link.Title, null, IsAmbiguous: false));
            }
        }

        using var writer = new StringWriter();
        var renderer = new HtmlRenderer(writer);
        _pipeline.Setup(renderer);
        renderer.Render(document);
        writer.Flush();
        var rawHtml = writer.ToString();

        var sanitizedHtml = _sanitizer.Sanitize(rawHtml);

        return new MarkdownRenderResult(
            sanitizedHtml,
            extractedTitles.ToList(),
            resolutions
        );
    }
}
