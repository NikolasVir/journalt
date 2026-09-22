# ── Build stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (layer-cache friendly)
COPY server/JournalT.slnx ./server/
COPY server/src/ ./server/src/
RUN dotnet restore server/JournalT.slnx

# Publish
RUN dotnet publish server/src/JournalT.Api/JournalT.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Install curl for healthcheck probe
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN addgroup --system journalt && adduser --system --ingroup journalt journalt

# Persistent data directory for the SQLite database (mount a volume here)
RUN mkdir -p /data && chown journalt:journalt /data

COPY --from=build /app/publish .

USER journalt

# ASP.NET Core listens on port 8080 inside the container (non-privileged)
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# SQLite database path — override with -e or in compose
ENV ConnectionStrings__DefaultConnection="Data Source=/data/journalt.db"

EXPOSE 8080

ENTRYPOINT ["dotnet", "JournalT.Api.dll"]
