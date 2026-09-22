namespace JournalT.Application.Common.Interfaces;

using JournalT.Application.Types.DTOs;

public interface ITypeDefinitionService
{
    Task<TypeDefinitionResult> CreateAsync(CreateTypeDefinitionRequest request, CancellationToken ct = default);
    Task<TypeDefinitionResult> CreateNewVersionAsync(Guid id, CreateTypeVersionRequest request, CancellationToken ct = default);
    Task<TypeDefinitionResult> CloneAsync(Guid id, CloneTypeRequest request, CancellationToken ct = default);
    Task<TypeDefinitionResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<TypeDefinitionResponse>> ListAsync(bool includeInactive = false, CancellationToken ct = default);
    Task<bool> ToggleActiveAsync(Guid id, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<TypeMigrationPreviewItem>> PreviewMigrationAsync(Guid sourceTypeId, Guid targetTypeVersionId, CancellationToken ct = default);
    Task<TypeMigrationResult> MigrateNotesAsync(Guid sourceTypeId, TypeMigrationRequest request, CancellationToken ct = default);
}
