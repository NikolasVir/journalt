namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Vault.DTOs;

public interface IVaultService
{
    Task<VaultCanaryResponse> GetCanaryAsync(string partitionToken, CancellationToken ct = default);
    Task<bool> InitializeVaultAsync(InitializeVaultRequest request, CancellationToken ct = default);
    Task<List<VaultNoteDto>> ListNotesAsync(string partitionToken, CancellationToken ct = default);
    Task<VaultNoteDto?> GetNoteByIdAsync(Guid id, string partitionToken, CancellationToken ct = default);
    Task<VaultNoteDto> CreateNoteAsync(CreateVaultNoteRequest request, CancellationToken ct = default);
    Task<VaultNoteDto?> UpdateNoteAsync(Guid id, string partitionToken, UpdateVaultNoteRequest request, CancellationToken ct = default);
    Task<bool> DeleteNoteAsync(Guid id, string partitionToken, CancellationToken ct = default);
    Task<VaultNoteDto?> TogglePinAsync(Guid id, string partitionToken, CancellationToken ct = default);
    Task<bool> ChangePassphraseAsync(ChangeVaultPassphraseRequest request, CancellationToken ct = default);
    Task<bool> DeleteVaultAsync(string partitionToken, CancellationToken ct = default);
}
