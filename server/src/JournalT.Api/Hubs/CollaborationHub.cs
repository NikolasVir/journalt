namespace JournalT.Api.Hubs;

using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

[AllowAnonymous]
public class CollaborationHub : Hub
{
    private static readonly ConcurrentDictionary<Guid, List<string>> NoteSessions = new();

    public async Task<List<string>> JoinNote(Guid noteId)
    {
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
        var list = NoteSessions.GetOrAdd(noteId, _ => new List<string>());
        lock (list)
        {
            list.Add(updateB64);
        }

        await Clients.OthersInGroup($"note:{noteId}").SendAsync("ReceiveUpdate", updateB64);
    }

    public async Task SendAwareness(Guid noteId, string awarenessB64)
    {
        await Clients.OthersInGroup($"note:{noteId}").SendAsync("ReceiveAwareness", awarenessB64);
    }

    public static void ClearSession(Guid noteId)
    {
        NoteSessions.TryRemove(noteId, out _);
    }
}
