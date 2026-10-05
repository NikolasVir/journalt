namespace JournalT.Api.Controllers;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Types.DTOs;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/types")]
public class TypesController(ITypeDefinitionService typeDefinitionService) : ControllerBase
{
    private readonly ITypeDefinitionService _typeService = typeDefinitionService;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTypeDefinitionRequest request, CancellationToken ct)
    {
        var result = await _typeService.CreateAsync(request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return CreatedAtAction(nameof(GetById), new { id = result.TypeDefinition!.Id }, result.TypeDefinition);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var list = await _typeService.ListAsync(includeInactive, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var typeDef = await _typeService.GetByIdAsync(id, ct);
        return typeDef is not null ? Ok(typeDef) : NotFound();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTypeDefinitionRequest request, CancellationToken ct)
    {
        var result = await _typeService.UpdateAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result.TypeDefinition);
    }

    [HttpPost("{id:guid}/version")]
    public async Task<IActionResult> CreateNewVersion(Guid id, [FromBody] CreateTypeVersionRequest request, CancellationToken ct)
    {
        var result = await _typeService.CreateNewVersionAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return StatusCode(StatusCodes.Status201Created, result.TypeDefinition);
    }

    [HttpPost("{id:guid}/clone")]
    public async Task<IActionResult> Clone(Guid id, [FromBody] CloneTypeRequest request, CancellationToken ct)
    {
        var result = await _typeService.CloneAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return StatusCode(StatusCodes.Status201Created, result.TypeDefinition);
    }

    [HttpPost("{id:guid}/duplicate")]
    public async Task<IActionResult> Duplicate(Guid id, [FromBody] CloneTypeRequest request, CancellationToken ct)
    {
        return await Clone(id, request, ct);
    }

    [HttpPatch("{id:guid}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken ct)
    {
        var success = await _typeService.ToggleActiveAsync(id, ct);
        return success ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await _typeService.DeleteAsync(id, ct);
        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return NoContent();
    }

    [HttpGet("{id:guid}/migrations/preview")]
    public async Task<IActionResult> PreviewMigration(
        Guid id,
        [FromQuery] Guid targetVersionId,
        CancellationToken ct)
    {
        var preview = await _typeService.PreviewMigrationAsync(id, targetVersionId, ct);
        return Ok(preview);
    }

    [HttpPost("{id:guid}/migrations")]
    public async Task<IActionResult> MigrateNotes(
        Guid id,
        [FromBody] TypeMigrationRequest request,
        CancellationToken ct)
    {
        var result = await _typeService.MigrateNotesAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result);
    }
}
