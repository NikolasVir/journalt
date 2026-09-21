namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Tags.DTOs;

public interface ITagDefinitionService
{
    Task<TagDefinitionResult> CreateAsync(CreateTagDefinitionRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<TagDefinitionResponse>> ListAsync(CancellationToken ct = default);
    Task<TagDefinitionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<TagDefinitionResult> UpdateAsync(Guid id, UpdateTagDefinitionRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}
