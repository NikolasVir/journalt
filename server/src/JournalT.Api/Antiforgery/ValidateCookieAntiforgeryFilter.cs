namespace JournalT.Api.Antiforgery;

using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

/// <summary>
/// Enforces anti-forgery (CSRF) token validation on state-changing requests (POST, PUT, DELETE, PATCH)
/// that are authenticated via session cookies.
/// 
/// Exemptions:
/// 1. Safe HTTP methods (GET, HEAD, OPTIONS, TRACE)
/// 2. Actions marked with [AllowAnonymous] (e.g. login, register, csrf)
/// 3. Requests authenticated via API Key (custom headers cannot be forged cross-origin)
/// </summary>
public class ValidateCookieAntiforgeryFilter(IAntiforgery antiforgery) : IAsyncActionFilter
{
    private readonly IAntiforgery _antiforgery = antiforgery;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var httpContext = context.HttpContext;
        var method = httpContext.Request.Method;

        // 1. Safe methods do not mutate state
        if (HttpMethods.IsGet(method) ||
            HttpMethods.IsHead(method) ||
            HttpMethods.IsOptions(method) ||
            HttpMethods.IsTrace(method))
        {
            await next();
            return;
        }

        // 2. AllowAnonymous actions do not operate under an authenticated user session
        var endpoint = httpContext.GetEndpoint();
        if (endpoint?.Metadata.GetMetadata<IAllowAnonymous>() is not null)
        {
            await next();
            return;
        }

        // 3. API key authentication is immune to CSRF (custom headers are blocked by browser CORS)
        var isApiKeyAuth = httpContext.User.Identities
            .Any(i => i.AuthenticationType == "ApiKey");

        if (isApiKeyAuth)
        {
            await next();
            return;
        }

        // 4. Validate antiforgery token for cookie-authenticated mutating requests
        try
        {
            await _antiforgery.ValidateRequestAsync(httpContext);
        }
        catch (AntiforgeryValidationException)
        {
            context.Result = new BadRequestObjectResult(new
            {
                error = "Antiforgery token validation failed. Missing or invalid 'X-XSRF-TOKEN' header."
            });
            return;
        }

        await next();
    }
}
