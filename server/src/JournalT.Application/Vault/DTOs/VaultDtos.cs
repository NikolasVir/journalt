namespace JournalT.Application.Vault.DTOs;

public record VaultCanaryResponse(
    bool Exists,
    string? EncryptedCanary,
    string? Nonce,
    string? AuthTag);

public record InitializeVaultRequest(
    string PartitionToken,
    string EncryptedCanary,
    string Nonce,
    string AuthTag);

public record VaultNoteDto(
    Guid Id,
    string PartitionToken,
    string EncryptedPayload,
    string Nonce,
    string AuthTag,
    bool IsPinned,
    DateTime? PinnedAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public record CreateVaultNoteRequest(
    string PartitionToken,
    string EncryptedPayload,
    string Nonce,
    string AuthTag,
    bool IsPinned = false);

public record UpdateVaultNoteRequest(
    string EncryptedPayload,
    string Nonce,
    string AuthTag,
    bool IsPinned = false);

public record ChangeVaultPassphraseRequest(
    string OldPartitionToken,
    string NewPartitionToken,
    string NewEncryptedCanary,
    string NewNonce,
    string NewAuthTag,
    List<MigrateVaultNoteItem> Notes);

public record MigrateVaultNoteItem(
    Guid Id,
    string EncryptedPayload,
    string Nonce,
    string AuthTag,
    bool IsPinned);
