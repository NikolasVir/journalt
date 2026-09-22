export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  expiresAtUtc?: string | null;
  lastUsedAtUtc?: string | null;
}

export interface ApiKeyCreatedResponse {
  id: string;
  name: string;
  keyPrefix: string;
  plaintextKey: string;
  expiresAtUtc?: string | null;
}

export interface CreateApiKeyRequest {
  name: string;
  expiresAtUtc?: string | null;
}
