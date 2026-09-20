namespace JournalT.Api.Extensions;

using System.Security.Claims;
using JournalT.Application.Common.Interfaces;

public class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor = accessor;

    public Guid UserId
    {
        get
        {
            var claim = _accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(claim, out var id)
                ? id
                : throw new UnauthorizedAccessException("No authenticated user in context.");
        }
    }
}
