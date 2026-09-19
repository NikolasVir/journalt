namespace JournalT.Application.Auth.DTOs;

public sealed record LoginRequest(string Email, string Password, bool RememberMe = false);
