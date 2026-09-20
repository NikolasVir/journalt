namespace JournalT.Api.Controllers;

using System.Security.Claims;
using JournalT.Application.Auth.DTOs;
using JournalT.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Manage API keys for the current user.
/// Key management is cookie-only — you cannot create or revoke API keys using an API key.
/// </summary>
[ApiController]
[Route("api/apikeys")]
[Authorize(AuthenticationSchemes = "Identity.Application")]
public class ApiKeysController(IApiKeyService apiKeyService) : ControllerBase
{
    private readonly IApiKeyService _apiKeyService = apiKeyService;

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<IActionResult> Create(CreateApiKeyRequest request, CancellationToken ct)
    {
        var result = await _apiKeyService.CreateAsync(CurrentUserId, request, ct);

        if (!result.Succeeded)
            return Problem(detail: result.Error, statusCode: StatusCodes.Status409Conflict);

        return CreatedAtAction(nameof(GetAll), null, result.ApiKey);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var keys = await _apiKeyService.ListAsync(CurrentUserId, ct);
        return Ok(keys);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        var found = await _apiKeyService.RevokeAsync(id, CurrentUserId, ct);
        return found ? NoContent() : NotFound();
    }

    [HttpDelete("by-name/{name}")]
    public async Task<IActionResult> RevokeByName(string name, CancellationToken ct)
    {
        var found = await _apiKeyService.RevokeByNameAsync(name, CurrentUserId, ct);
        return found ? NoContent() : NotFound();
    }
}
