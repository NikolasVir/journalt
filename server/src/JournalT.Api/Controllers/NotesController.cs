namespace JournalT.Api.Controllers;

using JournalT.Api.Hubs;
using JournalT.Application.Common.Interfaces;
using JournalT.Application.Notes.DTOs;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/notes")]
public class NotesController(INoteService noteService) : ControllerBase
{
    private readonly INoteService _noteService = noteService;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateNoteRequest request, CancellationToken ct)
    {
        var result = await _noteService.CreateAsync(request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return CreatedAtAction(nameof(GetById), new { id = result.Note!.Id }, result.Note);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var note = await _noteService.GetByIdAsync(id, ct);
        return note is not null ? Ok(note) : NotFound();
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] NoteFilterParams filter, CancellationToken ct)
    {
        var result = await _noteService.ListAsync(filter, ct);
        return Ok(result);
    }

    /// <summary>Lightweight index of wiki-eligible notes, used to build the Explore library tree.</summary>
    [HttpGet("wiki-index")]
    public async Task<IActionResult> GetWikiIndex(CancellationToken ct)
    {
        var index = await _noteService.GetWikiIndexAsync(ct);
        return Ok(index);
    }

    [HttpGet("tags")]
    public async Task<IActionResult> GetTags(CancellationToken ct)
    {
        var tags = await _noteService.GetDistinctTagsAsync(ct);
        return Ok(tags);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateNoteRequest request, CancellationToken ct)
    {
        var result = await _noteService.UpdateAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        CollaborationHub.ClearSessionIfIdle(id);
        return Ok(result.Note);
    }

    [HttpPatch("{id:guid}/checklist")]
    public async Task<IActionResult> UpdateChecklist(Guid id, [FromBody] UpdateChecklistRequest request, CancellationToken ct)
    {
        var result = await _noteService.UpdateChecklistAsync(id, request.BodyMarkdown ?? string.Empty, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        CollaborationHub.ClearSessionIfIdle(id);
        return Ok(result.Note);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Trash(Guid id, CancellationToken ct)
    {
        var trashed = await _noteService.TrashAsync(id, ct);
        return trashed ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct)
    {
        var restored = await _noteService.RestoreAsync(id, ct);
        return restored ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}/permanent")]
    public async Task<IActionResult> DeletePermanent(Guid id, CancellationToken ct)
    {
        var deleted = await _noteService.DeletePermanentAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    // Phase 3: Promotion
    [HttpPost("{id:guid}/promote")]
    public async Task<IActionResult> Promote(Guid id, [FromBody] PromoteNoteRequest request, CancellationToken ct)
    {
        var result = await _noteService.PromoteAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result.Note);
    }

    // Phase 3: Sources
    [HttpPost("{id:guid}/sources")]
    public async Task<IActionResult> AddSource(Guid id, [FromBody] CreateNoteSourceRequest request, CancellationToken ct)
    {
        var source = await _noteService.AddSourceAsync(id, request, ct);
        return source is not null ? StatusCode(StatusCodes.Status201Created, source) : NotFound();
    }

    [HttpGet("{id:guid}/sources")]
    public async Task<IActionResult> GetSources(Guid id, CancellationToken ct)
    {
        var sources = await _noteService.GetSourcesAsync(id, ct);
        return Ok(sources);
    }

    [HttpDelete("{id:guid}/sources/{sourceId:guid}")]
    public async Task<IActionResult> DeleteSource(Guid id, Guid sourceId, CancellationToken ct)
    {
        var deleted = await _noteService.DeleteSourceAsync(id, sourceId, ct);
        return deleted ? NoContent() : NotFound();
    }

    // Phase 3: Relations
    [HttpPost("{id:guid}/relations")]
    public async Task<IActionResult> AddRelation(Guid id, [FromBody] CreateNoteRelationRequest request, CancellationToken ct)
    {
        var result = await _noteService.AddRelationAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return StatusCode(StatusCodes.Status201Created, result.Note!.OutboundRelations!.First());
    }

    [HttpGet("{id:guid}/relations")]
    public async Task<IActionResult> GetRelations(Guid id, CancellationToken ct)
    {
        var relations = await _noteService.GetRelationsAsync(id, ct);
        return Ok(relations);
    }

    [HttpGet("{id:guid}/backlinks")]
    public async Task<IActionResult> GetBacklinks(Guid id, CancellationToken ct)
    {
        var backlinks = await _noteService.GetBacklinksAsync(id, ct);
        return Ok(backlinks);
    }

    [HttpDelete("{id:guid}/relations/{relationId:guid}")]
    public async Task<IActionResult> DeleteRelation(Guid id, Guid relationId, CancellationToken ct)
    {
        var deleted = await _noteService.DeleteRelationAsync(id, relationId, ct);
        return deleted ? NoContent() : NotFound();
    }

    // Phase 4: Todo Hub
    [HttpGet("todos/summary")]
    public async Task<IActionResult> GetTodoSummary(CancellationToken ct)
    {
        var summary = await _noteService.GetTodoSummaryAsync(ct);
        return Ok(summary);
    }

    [HttpPatch("{id:guid}/todo")]
    public async Task<IActionResult> ToggleTodo(Guid id, CancellationToken ct)
    {
        var note = await _noteService.ToggleTodoAsync(id, ct);
        return note is not null ? Ok(note) : NotFound();
    }

    [HttpPatch("{id:guid}/pin")]
    public async Task<IActionResult> TogglePin(Guid id, CancellationToken ct)
    {
        var note = await _noteService.TogglePinAsync(id, ct);
        return note is not null ? Ok(note) : NotFound();
    }

    // Markdown Preview
    [HttpPost("render")]
    public async Task<IActionResult> RenderMarkdown([FromBody] RenderMarkdownRequest request, CancellationToken ct)
    {
        var renderedHtml = await _noteService.RenderPreviewAsync(request.Markdown ?? string.Empty, ct);
        return Ok(new RenderMarkdownResponse(renderedHtml));
    }

    // Note Sharing
    [HttpGet("{id:guid}/shares")]
    public async Task<IActionResult> GetShares(Guid id, CancellationToken ct)
    {
        var shares = await _noteService.GetSharesAsync(id, ct);
        return shares is not null ? Ok(shares) : NotFound();
    }

    [HttpPost("{id:guid}/shares")]
    public async Task<IActionResult> Share(Guid id, [FromBody] ShareNoteRequest request, CancellationToken ct)
    {
        var result = await _noteService.ShareNoteAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result.Shares);
    }

    [HttpDelete("{id:guid}/shares/{userId:guid}")]
    public async Task<IActionResult> RemoveShare(Guid id, Guid userId, CancellationToken ct)
    {
        var result = await _noteService.RemoveShareAsync(id, userId, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return NoContent();
    }
}

public record UpdateChecklistRequest(string? BodyMarkdown);
public record RenderMarkdownRequest(string? Markdown);
public record RenderMarkdownResponse(string RenderedHtml);

