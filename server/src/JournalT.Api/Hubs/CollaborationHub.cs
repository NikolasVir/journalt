namespace JournalT.Api.Hubs;

using System.Collections.Concurrent;
using System.Security.Claims;
using JournalT.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

[Authorize]
public class CollaborationHub(IJournalTDbContext db, ILibraryService libraryService) : Hub
{
    private readonly IJournalTDbContext _db = db;
    private readonly ILibraryService _libraryService = libraryService;
    private static readonly ConcurrentDictionary<Guid, List<string>> NoteSessions = new();
    private static readonly Dictionary<Guid, HashSet<string>> NoteConnections = new();
    private static readonly Dictionary<string, HashSet<Guid>> ConnectionNotes = new();
    private static readonly object SessionLock = new();
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

        var note = await _db.Notes
            .AsNoTracking()
            .Where(n => n.Id == noteId)
            .Select(n => new { n.UserId, n.LibraryId, IsDirectlyShared = n.Shares.Any(s => s.UserId == userId.Value) })
            .FirstOrDefaultAsync();

        if (note == null) return false;
        if (note.UserId == userId.Value || note.IsDirectlyShared) return true;

        if (note.LibraryId.HasValue)
        {
            return await _libraryService.HasLibraryAccessAsync(note.LibraryId.Value, userId.Value);
        }

        return false;
    }

    public async Task<List<string>> JoinNote(Guid noteId)
    {
        if (!await CanAccessNoteAsync(noteId))
        {
            throw new HubException("Unauthorized access to note.");
        }

        var groupName = $"note:{noteId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        lock (SessionLock)
        {
            if (!NoteConnections.TryGetValue(noteId, out var connections) || connections.Count == 0)
            {
                // First client joining an idle room: discard any stale in-memory session
                // so the room is always seeded fresh from the persisted SQLite state.
                NoteSessions.TryRemove(noteId, out _);
                connections = new HashSet<string>();
                NoteConnections[noteId] = connections;
            }

            connections.Add(Context.ConnectionId);

            if (!ConnectionNotes.TryGetValue(Context.ConnectionId, out var notes))
            {
                notes = new HashSet<Guid>();
                ConnectionNotes[Context.ConnectionId] = notes;
            }
            notes.Add(noteId);
        }

        var list = NoteSessions.GetOrAdd(noteId, _ => new List<string>());
        lock (list)
        {
            return new List<string>(list);
        }
    }

    public async Task LeaveNote(Guid noteId)
    {
        RemoveConnectionFromNote(Context.ConnectionId, noteId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"note:{noteId}");
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        lock (SessionLock)
        {
            if (ConnectionNotes.TryGetValue(Context.ConnectionId, out var notes))
            {
                foreach (var noteId in notes.ToList())
                {
                    RemoveConnectionFromNoteLocked(Context.ConnectionId, noteId);
                }
                ConnectionNotes.Remove(Context.ConnectionId);
            }
        }

        return base.OnDisconnectedAsync(exception);
    }

    private static void RemoveConnectionFromNote(string connectionId, Guid noteId)
    {
        lock (SessionLock)
        {
            RemoveConnectionFromNoteLocked(connectionId, noteId);
            if (ConnectionNotes.TryGetValue(connectionId, out var notes))
            {
                notes.Remove(noteId);
                if (notes.Count == 0)
                {
                    ConnectionNotes.Remove(connectionId);
                }
            }
        }
    }

    private static void RemoveConnectionFromNoteLocked(string connectionId, Guid noteId)
    {
        if (NoteConnections.TryGetValue(noteId, out var connections))
        {
            connections.Remove(connectionId);
            if (connections.Count == 0)
            {
                NoteConnections.Remove(noteId);
                NoteSessions.TryRemove(noteId, out _);
            }
        }
        else
        {
            NoteSessions.TryRemove(noteId, out _);
        }
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
        lock (SessionLock)
        {
            NoteSessions.TryRemove(noteId, out _);
        }
    }

    public static void ClearSessionIfIdle(Guid noteId)
    {
        lock (SessionLock)
        {
            if (!NoteConnections.TryGetValue(noteId, out var connections) || connections.Count == 0)
            {
                NoteSessions.TryRemove(noteId, out _);
            }
        }
    }
}
