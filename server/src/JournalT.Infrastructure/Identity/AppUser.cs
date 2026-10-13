namespace JournalT.Infrastructure.Identity;

using JournalT.Domain.Common;
using Microsoft.AspNetCore.Identity;

public class AppUser : IdentityUser<Guid>, IAuditableEntity
{
    public bool IsActive { get; set; } = true;
    public string? AvatarUrl { get; set; }
    public string? AccentColor { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
