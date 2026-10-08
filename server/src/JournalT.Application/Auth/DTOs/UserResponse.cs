namespace JournalT.Application.Auth.DTOs;

public sealed record UserResponse(Guid Id, string UserName, string? AvatarUrl = null);
