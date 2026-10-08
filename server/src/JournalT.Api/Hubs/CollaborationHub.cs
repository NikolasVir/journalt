namespace JournalT.Api.Hubs;

using System.Collections.Concurrent;
using System.Security.Claims;
using JournalT.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

[Authorize]
public class CollaborationHub(IJournalTDbContext db) : Hub
{
    private readonly IJournalTDbContext _db = db;
    private static readonly ConcurrentDictionary<Guid, List<string>> NoteSessions = new();
    private const int MaxUpdatesPerSession = 500;

    private Guid? GetCurrentUserId()
    {
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private async Task<bool> CanAccessNoteAsync(Guid noteId)
    {
        var userId = GetCurrentUserId();
        if (userId is null) return false;

        return await _db.Notes
            .AsNoTracking()
            .AnyAsync(n => n.Id == noteId && (n.UserId == userId.Value || n.Shares.Any(s => s.UserId == userId.Value)));
    }

    public async Task<List<string>> JoinNote(Guid noteId)
    {
        if (!await CanAccessNoteAsync(noteId))
        {
            throw new HubException("Unauthorized access to note.");
        }

        var groupName = $"note:{noteId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        var list = NoteSessions.GetOrAdd(noteId, _ => new List<string>());
        lock (list)
        {
            return new List<string>(list);
        }
    }

    public async Task LeaveNote(Guid noteId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"note:{noteId}");
    }

    public async Task SendUpdate(Guid noteId, string updateB64)
    {
        if (!await CanAccessNoteAsync(noteId))
        {
            throw new HubException("Unauthorized access to note.");
        }

        var list = NoteSessions.GetOrAdd(noteId, _ => new List<string>());
        lock (list)
        {
            if (list.Count >= MaxUpdatesPerSession)
            {
                list.RemoveAt(0);
            }
            list.Add(updateB64);
        }

        await Clients.OthersInGroup($"note:{noteId}").SendAsync("ReceiveUpdate", updateB64);
    }

    public async Task SendAwareness(Guid noteId, string awarenessB64)
    {
        if (!await CanAccessNoteAsync(noteId))
        {
            throw new HubException("Unauthorized access to note.");
        }

        await Clients.OthersInGroup($"note:{noteId}").SendAsync("ReceiveAwareness", awarenessB64);
    }

    public static void ClearSession(Guid noteId)
    {
        NoteSessions.TryRemove(noteId, out _);
    }
}
