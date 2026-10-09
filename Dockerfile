# ── Stage 1: Build Angular Client ─────────────────────────────────────────────
FROM node:22-alpine AS client-build
ARG APP_VERSION=0.1.0-dev
ARG APP_COMMIT=""
ENV APP_VERSION=$APP_VERSION
ENV APP_COMMIT=$APP_COMMIT
WORKDIR /client

# Install dependencies first (layer-cache friendly)
COPY client/package*.json ./
RUN npm ci

# Copy client source and build production bundle
COPY client/ ./
RUN npm run build

# ── Stage 2: Build .NET Backend ───────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG APP_VERSION=0.1.0-dev
WORKDIR /src

# Restore first (layer-cache friendly)
COPY server/Directory.Build.props* ./server/
COPY server/src/ ./server/src/
RUN dotnet restore server/src/JournalT.Api/JournalT.Api.csproj

# Publish backend
RUN dotnet publish server/src/JournalT.Api/JournalT.Api.csproj \
    --configuration Release \
    --no-restore \
    -p:MinVerVersion=$APP_VERSION \
    --output /app/publish

# Copy compiled Angular client into Kestrel's wwwroot directory
COPY --from=client-build /client/dist/client/browser/ /app/publish/wwwroot/

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Install curl for healthcheck probe
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN groupadd --system journalt && useradd --system -g journalt journalt

# Persistent data directory for the SQLite database and backups (mount a volume here)
RUN mkdir -p /data/backups && chown -R journalt:journalt /data

COPY --from=build --chown=journalt:journalt /app/publish .

USER journalt

# ASP.NET Core listens on port 8080 inside the container (non-privileged)
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# SQLite database path — override with -e or in compose
ENV ConnectionStrings__DefaultConnection="Data Source=/data/journalt.db"

EXPOSE 8080

ENTRYPOINT ["dotnet", "JournalT.Api.dll"]
