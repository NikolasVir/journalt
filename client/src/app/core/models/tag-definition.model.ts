export type TagType = 'FreeForm' | 'Typed';

export interface TagDefinitionResponse {
  id: string;
  category: string;
  allowedValuesJson?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateTagDefinitionRequest {
  category: string;
  allowedValuesJson?: string | null;
  allowedValues?: string[] | null;
}

export interface UpdateTagDefinitionRequest {
  allowedValuesJson?: string | null;
  allowedValues?: string[] | null;
}
