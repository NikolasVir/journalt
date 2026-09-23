namespace JournalT.Api.Controllers;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Tags.DTOs;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/tags/definitions")]
public class TagDefinitionsController(ITagDefinitionService tagDefinitionService) : ControllerBase
{
    private readonly ITagDefinitionService _tagDefinitionService = tagDefinitionService;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTagDefinitionRequest request, CancellationToken ct)
    {
        var result = await _tagDefinitionService.CreateAsync(request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return CreatedAtAction(nameof(GetById), new { id = result.TagDefinition!.Id }, result.TagDefinition);
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var list = await _tagDefinitionService.ListAsync(ct);
        return Ok(list);
    }

    [HttpGet("options")]
    public async Task<IActionResult> Options(CancellationToken ct)
    {
        var options = await _tagDefinitionService.ListOptionsAsync(ct);
        return Ok(options);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var tagDef = await _tagDefinitionService.GetByIdAsync(id, ct);
        return tagDef is not null ? Ok(tagDef) : NotFound();
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTagDefinitionRequest request, CancellationToken ct)
    {
        var result = await _tagDefinitionService.UpdateAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result.TagDefinition);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _tagDefinitionService.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
