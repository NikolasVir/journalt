namespace JournalT.Api.Controllers;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Libraries.DTOs;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/libraries")]
public class LibrariesController(ILibraryService libraryService) : ControllerBase
{
    private readonly ILibraryService _libraryService = libraryService;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLibraryRequest request, CancellationToken ct)
    {
        var result = await _libraryService.CreateAsync(request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return StatusCode(StatusCodes.Status201Created, result.Library);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool flat = false, CancellationToken ct = default)
    {
        if (flat)
        {
            var flatList = await _libraryService.ListFlatAsync(ct);
            return Ok(flatList);
        }

        var tree = await _libraryService.GetTreeAsync(ct);
        return Ok(tree);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Rename(Guid id, [FromBody] RenameLibraryRequest request, CancellationToken ct)
    {
        var result = await _libraryService.RenameAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result.Library);
    }

    [HttpPut("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveLibraryRequest request, CancellationToken ct)
    {
        var result = await _libraryService.MoveAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result.Library);
    }
}
