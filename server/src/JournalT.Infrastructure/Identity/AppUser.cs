namespace JournalT.Infrastructure.Identity;

using JournalT.Domain.Common;
using Microsoft.AspNetCore.Identity;

public class AppUser : IdentityUser<Guid>, IAuditableEntity
{
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
