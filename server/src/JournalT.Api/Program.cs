using JournalT.Infrastructure;
using JournalT.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddControllers();

// Add Infrastructure (SQLite DbContext, Identity, etc.)
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Auto-apply migrations so deleting journalt.db + dotnet run is enough to reset.
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<JournalTDbContext>();
    db.Database.Migrate();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
