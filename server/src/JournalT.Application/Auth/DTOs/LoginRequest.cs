namespace JournalT.Application.Auth.DTOs;

public sealed record LoginRequest(string UserName, string Password, bool RememberMe = false);
