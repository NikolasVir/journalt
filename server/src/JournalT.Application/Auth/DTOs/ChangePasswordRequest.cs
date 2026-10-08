namespace JournalT.Application.Auth.DTOs;

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
