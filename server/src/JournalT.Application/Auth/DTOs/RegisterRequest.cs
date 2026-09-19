namespace JournalT.Application.Auth.DTOs;

public sealed record RegisterRequest(string Email, string UserName, string Password);
