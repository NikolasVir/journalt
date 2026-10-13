namespace JournalT.Api.Controllers;

using JournalT.Application.Common.Interfaces;
using JournalT.Application.Vault.DTOs;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/vault")]
public class VaultController(IVaultService vaultService) : ControllerBase
{
    private readonly IVaultService _vaultService = vaultService;

    [HttpGet("canary")]
    public async Task<IActionResult> GetCanary([FromQuery] string partitionToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(partitionToken))
            return BadRequest("partitionToken is required.");

        var canary = await _vaultService.GetCanaryAsync(partitionToken, ct);
        return Ok(canary);
    }

    [HttpPost("initialize")]
    public async Task<IActionResult> Initialize([FromBody] InitializeVaultRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.PartitionToken) ||
            string.IsNullOrWhiteSpace(request.EncryptedCanary) ||
            string.IsNullOrWhiteSpace(request.Nonce) ||
            string.IsNullOrWhiteSpace(request.AuthTag))
        {
            return BadRequest("Invalid vault initialization payload.");
        }

        var result = await _vaultService.InitializeVaultAsync(request, ct);
        return Ok(new { success = result });
    }

    [HttpGet("notes")]
    public async Task<IActionResult> ListNotes([FromQuery] string partitionToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(partitionToken))
            return BadRequest("partitionToken is required.");

        var notes = await _vaultService.ListNotesAsync(partitionToken, ct);
        return Ok(notes);
    }

    [HttpGet("notes/{id:guid}")]
    public async Task<IActionResult> GetNoteById(Guid id, [FromQuery] string partitionToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(partitionToken))
            return BadRequest("partitionToken is required.");

        var note = await _vaultService.GetNoteByIdAsync(id, partitionToken, ct);
        return note is not null ? Ok(note) : NotFound();
    }

    [HttpPost("notes")]
    public async Task<IActionResult> CreateNote([FromBody] CreateVaultNoteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.PartitionToken) ||
            string.IsNullOrWhiteSpace(request.EncryptedPayload) ||
            string.IsNullOrWhiteSpace(request.Nonce) ||
            string.IsNullOrWhiteSpace(request.AuthTag))
        {
            return BadRequest("Invalid vault note payload.");
        }

        var note = await _vaultService.CreateNoteAsync(request, ct);
        return CreatedAtAction(nameof(GetNoteById), new { id = note.Id, partitionToken = note.PartitionToken }, note);
    }

    [HttpPut("notes/{id:guid}")]
    public async Task<IActionResult> UpdateNote(Guid id, [FromQuery] string partitionToken, [FromBody] UpdateVaultNoteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(partitionToken) ||
            string.IsNullOrWhiteSpace(request.EncryptedPayload) ||
            string.IsNullOrWhiteSpace(request.Nonce) ||
            string.IsNullOrWhiteSpace(request.AuthTag))
        {
            return BadRequest("Invalid vault note payload.");
        }

        var note = await _vaultService.UpdateNoteAsync(id, partitionToken, request, ct);
        return note is not null ? Ok(note) : NotFound();
    }

    [HttpDelete("notes/{id:guid}")]
    public async Task<IActionResult> DeleteNote(Guid id, [FromQuery] string partitionToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(partitionToken))
            return BadRequest("partitionToken is required.");

        var success = await _vaultService.DeleteNoteAsync(id, partitionToken, ct);
        return success ? NoContent() : NotFound();
    }

    [HttpPatch("notes/{id:guid}/pin")]
    public async Task<IActionResult> TogglePin(Guid id, [FromQuery] string partitionToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(partitionToken))
            return BadRequest("partitionToken is required.");

        var note = await _vaultService.TogglePinAsync(id, partitionToken, ct);
        return note is not null ? Ok(note) : NotFound();
    }

    [HttpPost("change-passphrase")]
    public async Task<IActionResult> ChangePassphrase([FromBody] ChangeVaultPassphraseRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.OldPartitionToken) ||
            string.IsNullOrWhiteSpace(request.NewPartitionToken) ||
            string.IsNullOrWhiteSpace(request.NewEncryptedCanary))
        {
            return BadRequest("Invalid change passphrase request.");
        }

        var success = await _vaultService.ChangePassphraseAsync(request, ct);
        return success ? Ok(new { success = true }) : BadRequest("Failed to update vault passphrase.");
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteVault([FromQuery] string partitionToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(partitionToken))
            return BadRequest("partitionToken is required.");

        var success = await _vaultService.DeleteVaultAsync(partitionToken, ct);
        return success ? NoContent() : NotFound();
    }
}
