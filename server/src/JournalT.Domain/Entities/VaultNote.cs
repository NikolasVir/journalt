namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class VaultNote : BaseEntity
{
    public Guid UserId { get; set; }
    public string PartitionToken { get; set; } = string.Empty;
    public string EncryptedPayload { get; set; } = string.Empty;
    public string Nonce { get; set; } = string.Empty;
    public string AuthTag { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public DateTime? PinnedAtUtc { get; set; }
}
