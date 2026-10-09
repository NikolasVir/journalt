# Agent Directives & Repository Guidelines

## Git & Commit Conventions
- Commit messages must follow Conventional Commits format (`type(scope): subject` or `type: subject`).
- Commit messages must never exceed 50 chars per message (`header-max-length: 50`).
- The subject must be entirely lower-case.
- Never run `git commit` automatically without explicit user approval.

## Engineering Principles
- Simplicity and maintainability above all else.
- Maintain documentation integrity and preserve unrelated existing code/comments.
- Adhere to Clean Architecture in ASP.NET Core backend (.NET 10).
- Adhere to modern Angular 21 standalone components, signals, and typed reactive forms.

## Pre-Commit Verification
- Backend tests: `dotnet test server/JournalT.slnx`
- Backend release build: `dotnet build server/src/JournalT.Api -c Release`
- Frontend unit tests: `npm test -- --watch=false` in `client/`
- Frontend build: `npm run build` in `client/`
