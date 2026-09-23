set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

build-api:
    dotnet build server/JournalT.slnx --configuration Release

build-client:
    npm --prefix client run build:kestrel

build: build-api build-client

run: build
    dotnet run --project server/src/JournalT.Api --configuration Release --launch-profile http
