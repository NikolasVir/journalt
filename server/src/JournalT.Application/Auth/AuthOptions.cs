namespace JournalT.Application.Auth;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>
    /// When false, POST /api/auth/register returns 403.
    /// Override via environment variable: Auth__RegistrationEnabled=false
    /// </summary>
    public bool RegistrationEnabled { get; init; } = true;
}
