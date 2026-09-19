namespace JournalT.Domain.Entities;

using JournalT.Domain.Common;

public class ApiKey : BaseEntity
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;
    public string KeyHash { get; set; } = string.Empty;
    public DateTime? ExpiresAtUtc { get; set; }
    public DateTime? LastUsedAtUtc { get; set; }
    public bool IsRevoked { get; set; }
}
