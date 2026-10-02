export interface SectionDefinition {
  heading?: string;
  level?: number;
  required: boolean;
  allowMultiple?: boolean;
  repeatable?: boolean;
  title?: string;
}

export interface TypeDefinitionResponse {
  id: string;
  name: string;
  version: number;
  description?: string | null;
  schemaJson: string;
  sectionsJson?: string | null;
  isActive: boolean;
  createdAtUtc: string;
}

export interface CreateTypeDefinitionRequest {
  name: string;
  description?: string | null;
  schemaJson: string;
  sectionsJson?: string | null;
}

export interface CreateTypeVersionRequest {
  description?: string | null;
  schemaJson: string;
  sectionsJson?: string | null;
}

export interface CloneTypeRequest {
  newName: string;
}

export interface TypeMigrationPreviewItem {
  noteId: string;
  noteTitle: string;
  currentVersion: number;
  targetVersion: number;
  isValidAgainstTarget: boolean;
  validationErrors: string[];
}

export interface TypeMigrationRequest {
  targetVersionId: string;
  noteIds?: string[] | null;
}

export interface TypeMigrationResult {
  migratedCount: number;
  failedCount: number;
  failures: string[];
}
