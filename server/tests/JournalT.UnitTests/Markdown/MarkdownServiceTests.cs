namespace JournalT.UnitTests.Markdown;

using JournalT.Infrastructure.Markdown;

public class MarkdownServiceTests
{
    private readonly MarkdownService _sut = new();

    [Fact]
    public void Render_BasicMarkdown_Succeeds()
    {
        var markdown = """
            # Hello World

            This is **bold** and *italic*.

            | Col A | Col B |
            | --- | --- |
            | 1 | 2 |

            - [x] Done
            - [ ] Pending
            """;

        var result = _sut.Render(markdown);

        Assert.Contains("<h1>Hello World</h1>", result.RenderedHtml);
        Assert.Contains("<strong>bold</strong>", result.RenderedHtml);
        Assert.Contains("<table>", result.RenderedHtml);
        Assert.Contains("type=\"checkbox\"", result.RenderedHtml);
    }

    [Fact]
    public void Render_SanitizesXssAndMedia_StripsUnsafeContent()
    {
        var markdown = """
            <script>alert('xss')</script>

            <div onclick="evil()">Click</div>

            [Malicious](javascript:alert(1))

            ![Image](https://example.com/img.png)

            <iframe src="https://evil.com"></iframe>

            <svg onload="alert(1)"></svg>
            """;

        var result = _sut.Render(markdown);

        Assert.DoesNotContain("<script>", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onclick", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("javascript:", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<img", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<iframe", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onload", result.RenderedHtml, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Render_WikiLinkResolution_ResolvesValidAndFallbacksToSpan()
    {
        var targetId = Guid.NewGuid();
        var resolutions = new Dictionary<string, Guid> { ["Known Note"] = targetId };

        var markdown = "Check [[Known Note|Alias]] and [[Unknown Note]].";
        var result = _sut.Render(markdown, resolutions);

        // Resolved link -> anchor
        Assert.Contains($"<a href=\"/notes/{targetId}\" class=\"internal-link\">Alias</a>", result.RenderedHtml);
        // Unresolved link -> span with data-title
        Assert.Contains("<span class=\"internal-link unresolved\" data-title=\"Unknown Note\">Unknown Note</span>", result.RenderedHtml);
    }

    [Fact]
    public void ExtractWikiLinks_HandlesCodeFencesAndMalformedBrackets()
    {
        var markdown = """
            `[[InlineCodeNotLink]]`

            ```csharp
            var x = "[[CodeFenceNotLink]]";
            ```

            [[Unclosed
            [[]]
            [[   ]]
            [[ValidTarget|CustomLabel]]
            """;

        var links = _sut.ExtractWikiLinks(markdown);

        Assert.Single(links);
        Assert.Equal("ValidTarget", links[0]);
    }
}
