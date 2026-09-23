export type TagType = 'FreeForm' | 'Typed';

export interface TagDefinitionResponse {
  id: string;
  category: string;
  allowedValuesJson?: string | null;
  knownValuesJson?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface TagOptionResponse {
  id: string;
  category: string;
  isClosed: boolean;
  values: string[];
}

export interface CreateTagDefinitionRequest {
  category: string;
  allowedValuesJson?: string | null;
  knownValuesJson?: string | null;
  allowedValues?: string[] | null;
  knownValues?: string[] | null;
}

export interface UpdateTagDefinitionRequest {
  allowedValuesJson?: string | null;
  knownValuesJson?: string | null;
  allowedValues?: string[] | null;
  knownValues?: string[] | null;
}
