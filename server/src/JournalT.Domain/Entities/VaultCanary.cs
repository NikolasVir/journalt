namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class VaultCanary : BaseEntity
{
    public Guid UserId { get; set; }
    public string PartitionToken { get; set; } = string.Empty;
    public string EncryptedCanary { get; set; } = string.Empty;
    public string Nonce { get; set; } = string.Empty;
    public string AuthTag { get; set; } = string.Empty;
}
