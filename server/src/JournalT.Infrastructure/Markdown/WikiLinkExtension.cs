namespace JournalT.Infrastructure.Markdown;

using System.Net;
using Markdig;
using Markdig.Helpers;
using Markdig.Parsers;
using Markdig.Parsers.Inlines;
using Markdig.Renderers;
using Markdig.Renderers.Html;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;

public class WikiLinkInline : LeafInline
{
    public string Title { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public Guid? ResolvedNoteId { get; set; }
}

public class WikiLinkInlineParser : InlineParser
{
    public WikiLinkInlineParser() => OpeningCharacters = ['['];

    public override bool Match(InlineProcessor processor, ref StringSlice slice)
    {
        if (slice.CurrentChar != '[' || slice.PeekChar(1) != '[') return false;

        var start = slice.Start;
        slice.NextChar(); slice.NextChar(); // skip "[["
        var contentStart = slice.Start;

        while (!slice.IsEmpty && (slice.CurrentChar != ']' || slice.PeekChar(1) != ']') && slice.CurrentChar != '\n' && slice.CurrentChar != '\r')
        {
            slice.NextChar();
        }

        if (slice.IsEmpty || slice.CurrentChar != ']') { slice.Start = start; return false; }

        var raw = slice.Text.Substring(contentStart, slice.Start - contentStart).Trim();
        slice.NextChar(); slice.NextChar(); // skip "]]"

        if (string.IsNullOrWhiteSpace(raw)) return false;

        var parts = raw.Split('|', 2, StringSplitOptions.TrimEntries);
        var title = parts[0];
        var label = parts.Length > 1 && !string.IsNullOrEmpty(parts[1]) ? parts[1] : title;

        if (string.IsNullOrEmpty(title)) return false;

        processor.Inline = new WikiLinkInline
        {
            Span = new SourceSpan(start, slice.Start - 1),
            Title = title,
            Label = label
        };
        return true;
    }
}

public class WikiLinkRenderer : HtmlObjectRenderer<WikiLinkInline>
{
    protected override void Write(HtmlRenderer renderer, WikiLinkInline obj)
    {
        if (!renderer.EnableHtmlForInline) { renderer.Write(obj.Label); return; }

        if (obj.ResolvedNoteId.HasValue)
        {
            renderer.Write($"<a href=\"/notes/{obj.ResolvedNoteId.Value}\" class=\"internal-link\">{WebUtility.HtmlEncode(obj.Label)}</a>");
        }
        else
        {
            renderer.Write($"<span class=\"internal-link unresolved\" data-title=\"{WebUtility.HtmlEncode(obj.Title)}\">{WebUtility.HtmlEncode(obj.Label)}</span>");
        }
    }
}

public class WikiLinkExtension : IMarkdownExtension
{
    public void Setup(MarkdownPipelineBuilder pipeline) => pipeline.InlineParsers.Insert(0, new WikiLinkInlineParser());

    public void Setup(MarkdownPipeline pipeline, IMarkdownRenderer renderer)
    {
        if (renderer is TextRendererBase<HtmlRenderer> htmlRenderer)
        {
            htmlRenderer.ObjectRenderers.AddIfNotAlready(new WikiLinkRenderer());
        }
    }
}
