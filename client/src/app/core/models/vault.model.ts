import { NoteLevel } from '@core/models/note.model';

export interface VaultCanaryResponse {
  exists: boolean;
  encryptedCanary: string | null;
  nonce: string | null;
  authTag: string | null;
}

export interface InitializeVaultRequest {
  partitionToken: string;
  encryptedCanary: string;
  nonce: string;
  authTag: string;
}

export interface VaultNoteDto {
  id: string;
  partitionToken: string;
  encryptedPayload: string;
  nonce: string;
  authTag: string;
  isPinned: boolean;
  pinnedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateVaultNoteRequest {
  partitionToken: string;
  encryptedPayload: string;
  nonce: string;
  authTag: string;
  isPinned?: boolean;
}

export interface UpdateVaultNoteRequest {
  encryptedPayload: string;
  nonce: string;
  authTag: string;
  isPinned?: boolean;
}

/** Per-note metadata that lives inside the encrypted payload (never visible to the server). */
export interface VaultNoteMeta {
  level: NoteLevel;
  isTodo: boolean;
  todoCompletedAtUtc: string | null;
  isTrashed: boolean;
  trashedAtUtc: string | null;
}

/** Encrypted payload shape. Meta fields are optional for notes written before levels existed. */
export interface VaultNoteContent extends Partial<VaultNoteMeta> {
  title: string;
  bodyMarkdown: string;
  tags: string[];
}

export interface DecryptedVaultNote extends VaultNoteMeta {
  id: string;
  partitionToken: string;
  title: string;
  bodyMarkdown: string;
  renderedHtml?: string;
  tags: string[];
  isPinned: boolean;
  pinnedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  encryptedPayload: string;
  nonce: string;
  authTag: string;
}

export interface MigrateVaultNoteItem {
  id: string;
  encryptedPayload: string;
  nonce: string;
  authTag: string;
  isPinned: boolean;
}

export interface ChangeVaultPassphraseRequest {
  oldPartitionToken: string;
  newPartitionToken: string;
  newEncryptedCanary: string;
  newNonce: string;
  newAuthTag: string;
  notes: MigrateVaultNoteItem[];
}
