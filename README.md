# JournalT

A self-hosted personal knowledge management system built with ASP.NET Core (.NET 10) and SQLite, featuring progressive note lifecycles (Inbox → Quick → Journal), JSON Schema type validation, and sanitized server-rendered Markdown with wiki-links.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Optional: [Bruno](https://www.usebruno.com/) (for API testing)

## Project Structure

The backend follows Clean Architecture principles:

- `src/JournalT.Domain`: Core entities (`Note`, `Library`, `TypeDefinition`, `ApiKey`), enums, and domain contracts (zero dependencies).
- `src/JournalT.Application`: DTOs, service interfaces (`IAuthService`, `IApiKeyService`, `IMarkdownService`, `ITypeValidationService`), and validation models.
- `src/JournalT.Infrastructure`: SQLite EF Core persistence (`JournalTDbContext`), migrations, ASP.NET Identity, API key auth handler, Markdig Markdown pipeline, and JSON Schema validator.
- `src/JournalT.Api`: ASP.NET Core minimal hosting (`Program.cs`), controllers, antiforgery CSRF filter, and OpenAPI configuration.
- `tests/JournalT.UnitTests`: Unit test suite covering Markdown rendering, sanitization, and Type/Section validation.

## Running the Server

```pwsh
# Run tests
dotnet test server/JournalT.slnx

# Run the API server (Development mode auto-applies SQLite migrations)
dotnet run --project server/src/JournalT.Api
```

The API will be available at `http://localhost:5050`.

## API Testing with Bruno

The `bruno/` directory contains ready-to-run API request collections:
1. Open Bruno and open the `bruno/` collection folder.
2. Select the `local` environment (`baseUrl: http://localhost:5050`).
3. Run `auth/register` or `auth/login` to obtain an authentication cookie and CSRF token.
4. Manage API keys via `apikeys/create`, `apikeys/list`, and test API key auth via `apikeys/auth-with-api-key`.
