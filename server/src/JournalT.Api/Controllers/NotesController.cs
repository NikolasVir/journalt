namespace JournalT.Api.Controllers;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Notes.DTOs;
using Microsoft.AspNetCore.Authorization;
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

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateNoteRequest request, CancellationToken ct)
    {
        var result = await _noteService.UpdateAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

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
}
