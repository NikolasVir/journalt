# JournalT

[![CI](https://github.com/NikolasVir/journalt/actions/workflows/ci.yml/badge.svg)](https://github.com/NikolasVir/journalt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

JournalT is a self-hosted note-taking app inspired by Google Keep, with added
features for real-time collaboration and Wiki-style documentation. Built with
**ASP.NET Core (.NET 10)**, **Angular 21**, and **SQLite**.

---

## Highlights

- **Google Keep-Inspired Workflow + Progressive Lifecycle:** Quick-capture
  thoughts in the **Inbox**, organize them into **Notes**, or log chronological
  entries in the **Journal**.
- **Multiple Note Formats:**
  - **Markdown:** Freeform notes rendered with Markdig.
  - **Checklists:** Interactive task lists with completion tracking.
  - **Typed Notes:** Custom structured sections governed by JSON Schema
    templates.
- **Real-Time Collaboration:** Multi-client concurrent editing powered by **Yjs
  CRDTs** over **SignalR** WebSockets.
- **Wiki-Style Documentation:**
  - Wiki-links (`[[Note Title]]`) for effortless interlinking across notes.
  - Math formula typesetting via **KaTeX** (`$...$`).
  - Syntax-highlighted code blocks via **PrismJS**.
  - Server-side HTML sanitization for safe rendering.
- **Tag Registry & Libraries:** Multi-library workspaces and structured tag
  categories with autocomplete and known value registries.
- **Auth & API Keys:** Secure cookie authentication with CSRF protection, user
  avatars, and scoped API keys for scripts and external tools.
- **Single-Container Deployment:** Self-contained Docker image serving the
  compiled Angular frontend directly through Kestrel with embedded SQLite.

---

## Quickstart with Docker

The easiest way to run JournalT is using Docker Compose.

### 1. `docker-compose.yml`

```yaml
version: "3.9"

services:
  journalt:
    image: ghcr.io/nikolasvir/journalt:latest
    container_name: journalt
    restart: unless-stopped
    ports:
      - "5050:8080"
    volumes:
      - journalt_data:/data
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__DefaultConnection: "Data Source=/data/journalt.db"
      # Registration is disabled by default. Uncomment to allow additional users to register:
      # Auth__RegistrationEnabled: "true"

volumes:
  journalt_data:
```

### 2. Start the Container

```bash
docker compose up -d
```

Open `http://localhost:5050` in your browser.

> [!WARNING] **Default Admin Credentials:** On initial startup, JournalT
> automatically seeds a default administrator account:
> - **Username:** `admin`
> - **Password:** `changeme`
>
> **Change this password immediately** in **Settings** after logging in!
>
> Public registration is disabled by default (`Auth__RegistrationEnabled:
> false`). If you want to allow others to register on your instance, enable
> `Auth__RegistrationEnabled: "true"`.

---

## Local Development

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 22](https://nodejs.org/) (npm 11+)
- Optional: [just](https://github.com/casey/just) command runner

### Quick Run (`just`)

```bash
# Build both frontend and backend, then launch on http://localhost:5050
just run
```

### Manual Run

**1. Start the Backend API**

```bash
dotnet run --project server/src/JournalT.Api
```
The API starts at `http://localhost:5050` and auto-applies SQLite migrations.

**2. Start the Angular Client**

```bash
cd client
npm install
npm start
```
The client starts at `http://localhost:4200` with API requests proxied to
`:5050`.

---

## Testing

```bash
# Run backend tests (.NET xUnit)
dotnet test server/JournalT.slnx

# Run frontend tests (Angular Vitest)
cd client
npm test
```

An optional [Bruno](https://www.usebruno.com/) collection is available in
`bruno/` for API exploration.

---

## Architecture & Tech Stack

- **Backend:** ASP.NET Core (.NET 10), EF Core, SQLite, ASP.NET Identity,
  SignalR, Markdig. Follows Clean Architecture (`Domain`, `Application`,
  `Infrastructure`, `Api`).
- **Frontend:** Angular 21 (standalone components, signals), Angular Material,
  CodeMirror 6, Yjs CRDTs.
- **CI/CD:** Automated GitHub Actions workflows for testing, container builds
  (GHCR), and release management (Release Please).

---

## License

This project is licensed under the [MIT License](LICENSE).
