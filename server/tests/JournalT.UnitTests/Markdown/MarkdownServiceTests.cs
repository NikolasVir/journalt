namespace JournalT.UnitTests.Markdown;

using JournalT.Infrastructure.Markdown;

public class MarkdownServiceTests
{
    private readonly MarkdownService _sut = new();

    [Fact]
    public void Render_RendersBasicMarkdown()
    {
        var markdown = "# Hello World\n\nThis is **bold** and *italic*.";

        var result = _sut.Render(markdown);

        Assert.Contains("<h1>Hello World</h1>", result.RenderedHtml);
        Assert.Contains("<strong>bold</strong>", result.RenderedHtml);
        Assert.Contains("<em>italic</em>", result.RenderedHtml);
    }

    [Fact]
    public void Render_RendersTablesAndTaskLists()
    {
        var markdown = """
            | Header 1 | Header 2 |
            | --- | --- |
            | Cell 1 | Cell 2 |

            - [x] Task 1
            - [ ] Task 2
            """;

        var result = _sut.Render(markdown);

        Assert.Contains("<table>", result.RenderedHtml);
        Assert.Contains("<th>Header 1</th>", result.RenderedHtml);
        Assert.Contains("<td>Cell 1</td>", result.RenderedHtml);
        Assert.Contains("type=\"checkbox\"", result.RenderedHtml);
    }

    [Fact]
    public void Render_SanitizesXssVectors()
    {
        var markdown = """
            <script>alert('xss')</script>

            <div onclick="evil()">Click me</div>

            [Malicious Link](javascript:alert(1))
            """;

        var result = _sut.Render(markdown);

        Assert.DoesNotContain("<script>", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert('xss')", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onclick", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("javascript:", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Render_StripsExternalMediaEmbeds()
    {
        var markdown = "Here is an image: ![Alt Text](https://example.com/image.png)";

        var result = _sut.Render(markdown);

        Assert.DoesNotContain("<img", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ExtractWikiLinks_ReturnsDistinctTitles()
    {
        var markdown = "See [[Architecture Overview]] and [[Architecture Overview|Arch]] as well as [[Project Roadmap]].";

        var links = _sut.ExtractWikiLinks(markdown);

        Assert.Equal(2, links.Count);
        Assert.Contains("Architecture Overview", links);
        Assert.Contains("Project Roadmap", links);
    }

    [Fact]
    public void Render_RendersResolvedWikiLink_AsAnchorTag()
    {
        var noteId = Guid.NewGuid();
        var resolutions = new Dictionary<string, Guid>
        {
            ["Target Note"] = noteId
        };
        var markdown = "Refer to [[Target Note|Custom Label]] for details.";

        var result = _sut.Render(markdown, resolutions);

        Assert.Contains($"<a href=\"/notes/{noteId}\" class=\"internal-link\">Custom Label</a>", result.RenderedHtml);
        Assert.Single(result.ResolvedLinks);
        Assert.Equal(noteId, result.ResolvedLinks[0].NoteId);
    }

    [Fact]
    public void Render_RendersUnresolvedWikiLink_AsSpanWithDataTitle()
    {
        var markdown = "Refer to [[Missing Note]] for details.";

        var result = _sut.Render(markdown);

        Assert.Contains("<span class=\"internal-link unresolved\" data-title=\"Missing Note\">Missing Note</span>", result.RenderedHtml);
        Assert.Single(result.ResolvedLinks);
        Assert.Null(result.ResolvedLinks[0].NoteId);
    }

    [Fact]
    public void Render_RendersAlertBlocks()
    {
        var markdown = """
            > [!NOTE]
            > This is an alert callout note.
            """;

        var result = _sut.Render(markdown);

        Assert.Contains("markdown-alert", result.RenderedHtml);
        Assert.Contains("This is an alert callout note.", result.RenderedHtml);
    }

    [Fact]
    public void Render_RendersFootnotes()
    {
        var markdown = """
            Here is a claim[^1].

            [^1]: Citation details.
            """;

        var result = _sut.Render(markdown);

        Assert.Contains("footnote", result.RenderedHtml);
        Assert.Contains("Citation details.", result.RenderedHtml);
    }

    [Fact]
    public void Render_StripsIframesAndObjects()
    {
        var markdown = """
            <iframe src="https://example.com"></iframe>
            <object data="test.pdf"></object>
            """;

        var result = _sut.Render(markdown);

        Assert.DoesNotContain("<iframe", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<object", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Render_EmptyOrWhitespace_ReturnsEmptyResult()
    {
        var result1 = _sut.Render("");
        var result2 = _sut.Render("   \n\t  ");

        Assert.Empty(result1.RenderedHtml);
        Assert.Empty(result1.ExtractedWikiLinks);
        Assert.Empty(result2.RenderedHtml);
        Assert.Empty(result2.ExtractedWikiLinks);
    }

    [Fact]
    public void ExtractWikiLinks_IgnoresLinksInCodeFencesAndInlineCode()
    {
        var markdown = """
            Here is inline code: `[[InlineNotALink]]`.

            ```csharp
            var code = "[[FenceNotALink]]";
            ```

            And an actual link: [[LegitimateLink]].
            """;

        var links = _sut.ExtractWikiLinks(markdown);

        Assert.Single(links);
        Assert.Equal("LegitimateLink", links[0]);
    }

    [Fact]
    public void ExtractWikiLinks_MalformedBracketVariations_HandledCleanly()
    {
        var markdown = """
            [Single]
            [[Unclosed
            Unopened]]
            [[]]
            [[   ]]
            [[|OnlyLabel]]
            [[Multi
            Line]]
            [[PipeTarget|]]
            """;

        var links = _sut.ExtractWikiLinks(markdown);

        Assert.Single(links);
        Assert.Equal("PipeTarget", links[0]);
    }

    [Fact]
    public void Render_WikiLinkHtmlInjection_EscapesAttributesAndContent()
    {
        var markdown = "Check [[\" onclick=\"alert(1)]] and [[Safe|<script>alert(2)</script>]].";

        var result = _sut.Render(markdown);

        Assert.DoesNotContain("<script>", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<span onclick", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<a onclick", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Render_SanitizesAdvancedEvasionVectors()
    {
        var markdown = """
            <svg onload="alert(1)"></svg>
            <style>body { background: red; }</style>
            <a href="jav&#x09;ascript:alert(1)">Click</a>
            """;

        var result = _sut.Render(markdown);

        Assert.DoesNotContain("onload", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<style>", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("href=\"jav", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ExtractWikiLinks_HandlesUnicodeAndSymbols()
    {
        var markdown = "See [[C# 10 & .NET]] and [[🚀 Project Launch|Rocket]].";

        var links = _sut.ExtractWikiLinks(markdown);

        Assert.Equal(2, links.Count);
        Assert.Contains("C# 10 & .NET", links);
        Assert.Contains("🚀 Project Launch", links);
    }
}
