namespace JournalT.Api.Controllers;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Types.DTOs;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/types")]
public class TypesController(ITypeDefinitionService typeDefinitionService) : ControllerBase
{
    private readonly ITypeDefinitionService _typeDefinitionService = typeDefinitionService;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTypeDefinitionRequest request, CancellationToken ct)
    {
        var result = await _typeDefinitionService.CreateAsync(request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return CreatedAtAction(nameof(GetById), new { id = result.TypeDefinition!.Id }, result.TypeDefinition);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var list = await _typeDefinitionService.ListAsync(includeInactive, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var typeDef = await _typeDefinitionService.GetByIdAsync(id, ct);
        return typeDef is not null ? Ok(typeDef) : NotFound();
    }

    [HttpPost("{id:guid}/version")]
    public async Task<IActionResult> CreateNewVersion(Guid id, [FromBody] CreateTypeVersionRequest request, CancellationToken ct)
    {
        var result = await _typeDefinitionService.CreateNewVersionAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return StatusCode(StatusCodes.Status201Created, result.TypeDefinition);
    }

    [HttpPost("{id:guid}/clone")]
    public async Task<IActionResult> Clone(Guid id, [FromBody] CloneTypeRequest request, CancellationToken ct)
    {
        var result = await _typeDefinitionService.CloneAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return StatusCode(StatusCodes.Status201Created, result.TypeDefinition);
    }

    [HttpPatch("{id:guid}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id, CancellationToken ct)
    {
        var success = await _typeDefinitionService.ToggleActiveAsync(id, ct);
        return success ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _typeDefinitionService.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
