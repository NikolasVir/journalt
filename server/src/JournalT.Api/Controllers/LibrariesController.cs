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
    public async Task<IActionResult> List([FromQuery] bool flat = false, [FromQuery] bool includeShared = true, CancellationToken ct = default)
    {
        if (flat)
        {
            var flatList = await _libraryService.ListFlatAsync(includeShared, ct);
            return Ok(flatList);
        }

        var tree = await _libraryService.GetTreeAsync(ct);
        return Ok(tree);
    }

    [HttpGet("shared")]
    public async Task<IActionResult> GetSharedTree(CancellationToken ct = default)
    {
        var sharedTree = await _libraryService.GetSharedTreeAsync(ct);
        return Ok(sharedTree);
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

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await _libraryService.DeleteAsync(id, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return NoContent();
    }

    [HttpGet("{id:guid}/shares")]
    public async Task<IActionResult> GetShares(Guid id, CancellationToken ct)
    {
        var shares = await _libraryService.GetSharesAsync(id, ct);
        return shares is not null ? Ok(shares) : NotFound();
    }

    [HttpPost("{id:guid}/shares")]
    public async Task<IActionResult> Share(Guid id, [FromBody] ShareLibraryRequest request, CancellationToken ct)
    {
        var result = await _libraryService.ShareLibraryAsync(id, request, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return Ok(result.Shares);
    }

    [HttpDelete("{id:guid}/shares/{userId:guid}")]
    public async Task<IActionResult> RemoveShare(Guid id, Guid userId, CancellationToken ct)
    {
        var result = await _libraryService.RemoveShareAsync(id, userId, ct);

        if (!result.Succeeded)
            return Problem(detail: string.Join("; ", result.Errors), statusCode: result.StatusCode);

        return NoContent();
    }
}
