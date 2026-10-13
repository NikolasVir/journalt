import { HttpClient } from '@angular/common/http';
import { inject, Injectable, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  decryptPayload,
  deriveVaultKeys,
  encryptPayload
} from '@core/crypto/vault-crypto';
import { renderVaultMarkdown } from '@core/crypto/vault-markdown';
import { NoteLevel } from '@core/models/note.model';
import {
  ChangeVaultPassphraseRequest,
  CreateVaultNoteRequest,
  DecryptedVaultNote,
  InitializeVaultRequest,
  MigrateVaultNoteItem,
  UpdateVaultNoteRequest,
  VaultCanaryResponse,
  VaultNoteContent,
  VaultNoteDto,
  VaultNoteMeta
} from '@core/models/vault.model';

const AUTO_LOCK_DEFAULT_SECONDS = 300; // 5 minutes

/** Editable fields of a vault note. Metadata defaults match a freshly captured normal note. */
export interface VaultNoteInput extends Partial<VaultNoteMeta> {
  title: string;
  bodyMarkdown: string;
  tags: string[];
  isPinned?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VaultService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  // In-memory sensitive state (never persisted to storage)
  private activeAesKey: CryptoKey | null = null;
  private autoLockTimer: any = null;
  private escapePressTimestamps: number[] = [];
  private lastActivityReset = 0;
  private sessionTimeoutSeconds = AUTO_LOCK_DEFAULT_SECONDS;

  // True when the currently unlocked vault was auto-created on this unlock
  // (no canary existed for the passphrase). Such a vault is discarded on lock
  // unless the user made a real change, so a mistyped passphrase leaves no trace.
  private ephemeralVault = false;
  private vaultDirty = false;

  // Public reactive state
  public readonly isUnlocked = signal<boolean>(false);
  public readonly isLoading = signal<boolean>(false);
  public readonly currentPartitionToken = signal<string | null>(null);
  public readonly notes = signal<DecryptedVaultNote[]>([]);
  public readonly autoLockSecondsRemaining = signal<number>(AUTO_LOCK_DEFAULT_SECONDS);

  constructor() {
    this.setupPanicHotkey();
    this.setupActivityListeners();
  }

  /**
   * Unlocks the vault corresponding to the provided passphrase.
   */
  public async unlock(passphrase: string): Promise<{ success: boolean; needsInit?: boolean; error?: string }> {
    if (!passphrase || !passphrase.trim()) {
      return { success: false, error: 'Passphrase cannot be empty.' };
    }

    this.isLoading.set(true);
    try {
      const { partitionToken, aesKey } = await deriveVaultKeys(passphrase.trim());

      const canaryResponse = await firstValueFrom(
        this.http.get<VaultCanaryResponse>(`/api/vault/canary?partitionToken=${partitionToken}`)
      );

      if (!canaryResponse.exists || !canaryResponse.encryptedCanary) {
        this.isLoading.set(false);
        return { success: false, needsInit: true };
      }

      // Verify canary authentication
      try {
        const decryptedCanary = await decryptPayload(
          aesKey,
          canaryResponse.encryptedCanary,
          canaryResponse.nonce!,
          canaryResponse.authTag!
        );

        if (decryptedCanary !== 'JOURNALT_VAULT_OK') {
          this.isLoading.set(false);
          return { success: false, error: 'Invalid passphrase.' };
        }
      } catch {
        this.isLoading.set(false);
        return { success: false, error: 'Invalid passphrase.' };
      }

      // Store in memory
      this.activeAesKey = aesKey;
      this.currentPartitionToken.set(partitionToken);
      this.isUnlocked.set(true);
      this.resetAutoLockTimer();

      // Load and decrypt notes
      await this.loadNotes();

      this.isLoading.set(false);
      return { success: true };
    } catch (err: any) {
      this.isLoading.set(false);
      return { success: false, error: err?.message || 'Failed to unlock vault.' };
    }
  }

  /**
   * Initializes a brand-new vault for the given passphrase and seeds it with
   * realistic starter notes so a freshly created (decoy) vault looks lived-in.
   * The vault is flagged as ephemeral: if the user leaves without making any
   * real change it is discarded, so mistyped passphrases leave no residue.
   */
  public async initializeVault(passphrase: string): Promise<{ success: boolean; error?: string }> {
    if (!passphrase || !passphrase.trim()) {
      return { success: false, error: 'Passphrase cannot be empty.' };
    }

    this.isLoading.set(true);
    try {
      const { partitionToken, aesKey } = await deriveVaultKeys(passphrase.trim());

      const encryptedCanary = await encryptPayload(aesKey, 'JOURNALT_VAULT_OK');

      const initRequest: InitializeVaultRequest = {
        partitionToken,
        encryptedCanary: encryptedCanary.encryptedPayload,
        nonce: encryptedCanary.nonce,
        authTag: encryptedCanary.authTag
      };

      await firstValueFrom(this.http.post('/api/vault/initialize', initRequest));

      this.activeAesKey = aesKey;
      this.currentPartitionToken.set(partitionToken);
      this.isUnlocked.set(true);
      this.resetAutoLockTimer();

      await this.seedDecoyNotes();

      // Seeding does not count as a user change: only real edits keep the vault.
      this.ephemeralVault = true;
      this.vaultDirty = false;

      await this.loadNotes();
      this.isLoading.set(false);
      return { success: true };
    } catch (err: any) {
      this.isLoading.set(false);
      return { success: false, error: err?.message || 'Failed to initialize vault.' };
    }
  }

  /**
   * Locks the vault immediately, wiping keys from memory. If the vault was
   * auto-created on this unlock and the user never changed anything, it is
   * deleted server-side so an accidental/mistyped passphrase leaves no trace.
   */
  public lock(): void {
    const partitionToken = this.currentPartitionToken();
    const shouldDiscard = this.ephemeralVault && !this.vaultDirty && !!partitionToken;

    this.activeAesKey = null;
    this.currentPartitionToken.set(null);
    this.notes.set([]);
    this.isUnlocked.set(false);
    this.sessionTimeoutSeconds = AUTO_LOCK_DEFAULT_SECONDS;
    this.clearAutoLockTimer();
    this.ephemeralVault = false;
    this.vaultDirty = false;

    if (shouldDiscard && partitionToken) {
      void this.discardVault(partitionToken);
    }
  }

  /** Best-effort removal of an auto-created vault the user never modified. */
  private async discardVault(partitionToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`/api/vault?partitionToken=${partitionToken}`)
      );
    } catch (err) {
      console.error('Failed to discard unused vault:', err);
    }
  }

  /**
   * Refreshes decrypted notes from server.
   */
  public async loadNotes(): Promise<void> {
    const partitionToken = this.currentPartitionToken();
    const aesKey = this.activeAesKey;
    if (!partitionToken || !aesKey) return;

    const dtoList = await firstValueFrom(
      this.http.get<VaultNoteDto[]>(`/api/vault/notes?partitionToken=${partitionToken}`)
    );

    const decryptedList: DecryptedVaultNote[] = [];
    for (const dto of dtoList) {
      try {
        const json = await decryptPayload(aesKey, dto.encryptedPayload, dto.nonce, dto.authTag);
        decryptedList.push(this.toDecryptedNote(dto, JSON.parse(json)));
      } catch (err) {
        console.error('Failed to decrypt vault note:', dto.id, err);
      }
    }

    this.notes.set(decryptedList);
  }

  /**
   * Creates a new encrypted note in the currently unlocked vault.
   * Mirrors normal note rules: new notes default to the Inbox level.
   */
  public async createNote(input: VaultNoteInput): Promise<DecryptedVaultNote> {
    const { partitionToken, aesKey } = this.requireUnlocked();
    this.resetAutoLockTimer();
    this.vaultDirty = true;

    const content = this.buildContent(input);
    const encrypted = await encryptPayload(aesKey, JSON.stringify(content));

    const request: CreateVaultNoteRequest = {
      partitionToken,
      encryptedPayload: encrypted.encryptedPayload,
      nonce: encrypted.nonce,
      authTag: encrypted.authTag,
      isPinned: input.isPinned ?? false
    };

    const createdDto = await firstValueFrom(
      this.http.post<VaultNoteDto>('/api/vault/notes', request)
    );

    const note = this.toDecryptedNote(createdDto, content);
    this.notes.update((current) => [note, ...current]);
    return note;
  }

  /**
   * Updates an existing note. Only the provided fields change; everything else
   * (level, todo state, pin) is carried over from the current note.
   */
  public async updateNote(id: string, patch: Partial<VaultNoteInput>): Promise<DecryptedVaultNote> {
    const { partitionToken, aesKey } = this.requireUnlocked();
    const existing = this.notes().find((n) => n.id === id);
    if (!existing) throw new Error('Note not found.');
    this.resetAutoLockTimer();
    this.vaultDirty = true;

    const content = this.buildContent({ ...existing, ...patch });
    const encrypted = await encryptPayload(aesKey, JSON.stringify(content));

    const request: UpdateVaultNoteRequest = {
      encryptedPayload: encrypted.encryptedPayload,
      nonce: encrypted.nonce,
      authTag: encrypted.authTag,
      isPinned: patch.isPinned ?? existing.isPinned
    };

    const updatedDto = await firstValueFrom(
      this.http.put<VaultNoteDto>(`/api/vault/notes/${id}?partitionToken=${partitionToken}`, request)
    );

    const updated = this.toDecryptedNote(updatedDto, content);
    this.notes.update((current) => current.map((n) => (n.id === id ? updated : n)));
    return updated;
  }

  /** Flips the todo checkbox, stamping the completion time like normal notes. */
  public toggleTodo(id: string): Promise<DecryptedVaultNote> {
    const note = this.notes().find((n) => n.id === id);
    const completed = note?.todoCompletedAtUtc ? null : new Date().toISOString();
    return this.updateNote(id, { todoCompletedAtUtc: completed });
  }

  /** Promotion path matches normal notes: Inbox -> Note -> Journal. */
  public promoteNote(id: string, level: NoteLevel): Promise<DecryptedVaultNote> {
    return this.updateNote(id, { level });
  }

  private requireUnlocked(): { partitionToken: string; aesKey: CryptoKey } {
    const partitionToken = this.currentPartitionToken();
    const aesKey = this.activeAesKey;
    if (!partitionToken || !aesKey) throw new Error('Vault is locked.');
    return { partitionToken, aesKey };
  }

  /** Normalizes input into the encrypted payload, defaulting metadata like a fresh normal note.
   * Vault has no trash: deletes are permanent, so new/updated notes are always live. */
  private buildContent(src: VaultNoteInput | DecryptedVaultNote): VaultNoteContent {
    return {
      title: src.title,
      bodyMarkdown: src.bodyMarkdown,
      tags: src.tags,
      level: src.level ?? 'Inbox',
      isTodo: src.isTodo ?? false,
      todoCompletedAtUtc: src.isTodo ? (src.todoCompletedAtUtc ?? null) : null,
      isTrashed: false,
      trashedAtUtc: null
    };
  }

  /** Merges server envelope fields with decrypted content. Legacy payloads without a level become Notes. */
  private toDecryptedNote(dto: VaultNoteDto, content: VaultNoteContent): DecryptedVaultNote {
    return {
      id: dto.id,
      partitionToken: dto.partitionToken,
      title: content.title,
      bodyMarkdown: content.bodyMarkdown,
      renderedHtml: renderVaultMarkdown(content.bodyMarkdown),
      tags: content.tags || [],
      level: content.level ?? 'Note',
      isTodo: content.isTodo ?? false,
      todoCompletedAtUtc: content.todoCompletedAtUtc ?? null,
      isTrashed: content.isTrashed ?? false,
      trashedAtUtc: content.trashedAtUtc ?? null,
      isPinned: dto.isPinned,
      pinnedAtUtc: dto.pinnedAtUtc,
      createdAtUtc: dto.createdAtUtc,
      updatedAtUtc: dto.updatedAtUtc,
      encryptedPayload: dto.encryptedPayload,
      nonce: dto.nonce,
      authTag: dto.authTag
    };
  }

  /**
   * Deletes a note in the currently unlocked vault.
   */
  public async deleteNote(id: string): Promise<void> {
    const partitionToken = this.currentPartitionToken();
    if (!partitionToken) throw new Error('Vault is locked.');

    this.resetAutoLockTimer();
    this.vaultDirty = true;

    await firstValueFrom(
      this.http.delete(`/api/vault/notes/${id}?partitionToken=${partitionToken}`)
    );

    this.notes.update((current) => current.filter((n) => n.id !== id));
  }

  /**
   * Toggles the pin state of a note.
   */
  public async togglePin(id: string): Promise<void> {
    const partitionToken = this.currentPartitionToken();
    if (!partitionToken) throw new Error('Vault is locked.');

    this.resetAutoLockTimer();
    this.vaultDirty = true;

    const updatedDto = await firstValueFrom(
      this.http.patch<VaultNoteDto>(`/api/vault/notes/${id}/pin?partitionToken=${partitionToken}`, {})
    );

    this.notes.update((current) =>
      current.map((n) =>
        n.id === id
          ? { ...n, isPinned: updatedDto.isPinned, pinnedAtUtc: updatedDto.pinnedAtUtc }
          : n
      )
    );
  }

  /**
   * Re-encrypts all notes in the currently unlocked vault with a new passphrase,
   * updates the canary and records on the server atomically, and updates active keys.
   */
  public async changePassphrase(newPassphrase: string): Promise<{ success: boolean; error?: string }> {
    const oldPartitionToken = this.currentPartitionToken();
    const oldAesKey = this.activeAesKey;
    if (!oldPartitionToken || !oldAesKey) {
      return { success: false, error: 'Vault is locked.' };
    }

    if (!newPassphrase || !newPassphrase.trim()) {
      return { success: false, error: 'New passphrase cannot be empty.' };
    }

    this.isLoading.set(true);
    try {
      const { partitionToken: newPartitionToken, aesKey: newAesKey } = await deriveVaultKeys(newPassphrase.trim());

      const newCanary = await encryptPayload(newAesKey, 'JOURNALT_VAULT_OK');

      const currentNotes = this.notes();
      const migratedNotes: MigrateVaultNoteItem[] = [];

      for (const note of currentNotes) {
        const content = this.buildContent(note);
        const encrypted = await encryptPayload(newAesKey, JSON.stringify(content));
        migratedNotes.push({
          id: note.id,
          encryptedPayload: encrypted.encryptedPayload,
          nonce: encrypted.nonce,
          authTag: encrypted.authTag,
          isPinned: note.isPinned
        });
      }

      const request: ChangeVaultPassphraseRequest = {
        oldPartitionToken,
        newPartitionToken,
        newEncryptedCanary: newCanary.encryptedPayload,
        newNonce: newCanary.nonce,
        newAuthTag: newCanary.authTag,
        notes: migratedNotes
      };

      await firstValueFrom(this.http.post('/api/vault/change-passphrase', request));

      this.activeAesKey = newAesKey;
      this.currentPartitionToken.set(newPartitionToken);
      this.resetAutoLockTimer();
      this.vaultDirty = true;
      await this.loadNotes();
      this.isLoading.set(false);
      return { success: true };
    } catch (err: any) {
      this.isLoading.set(false);
      return { success: false, error: err?.message || 'Failed to change passphrase.' };
    }
  }

  /**
   * Seeds realistic sample notes for a newly initialized vault.
   * Useful for creating believable decoy vaults.
   */
  private async seedDecoyNotes(): Promise<void> {
    const sampleNotes = [
      {
        title: 'Apartment Maintenance & Paint Codes',
        body: '### Paint Codes\n- Living Room: Behr Swiss Coffee (Eggshell)\n- Accent Wall: SW 6244 Naval (Satin)\n\n### Air Filters\n- Size: 16x25x1 (MERV 11)\n- Replaced every 90 days\n\n### Landlord Contact\n- Office: 555-0199 (Mon-Fri 9-5)',
        tags: ['home', 'maintenance'],
        level: 'Note' as NoteLevel,
        pinned: true
      },
      {
        title: 'Book Recommendations 2026',
        body: '### Fiction\n- *Project Hail Mary* by Andy Weir\n- *Children of Time* by Adrian Tchaikovsky\n\n### Non-Fiction\n- *Designing Data-Intensive Applications* by Martin Kleppmann\n- *Thinking, Fast and Slow* by Daniel Kahneman',
        tags: ['reading', 'books'],
        level: 'Note' as NoteLevel,
        pinned: false
      },
      {
        title: 'Gift Ideas & Wishlist',
        body: '### Birthday & Holidays\n- Mechanical Keyboard lube kit\n- Insulated thermos travel mug (16oz)\n- Wool hiking socks\n- Aeropress coffee filters',
        tags: ['gifts', 'shopping'],
        level: 'Inbox' as NoteLevel,
        pinned: false
      },
      {
        title: 'Weekend Reset',
        body: 'Quiet week. Finished the book, cleaned the apartment, cooked a big batch of soup.',
        tags: ['weekly'],
        level: 'Journal' as NoteLevel,
        pinned: false
      }
    ];

    for (const sample of sampleNotes) {
      await this.createNote({
        title: sample.title,
        bodyMarkdown: sample.body,
        tags: sample.tags,
        level: sample.level,
        isPinned: sample.pinned
      });
    }
  }

  public resetAutoLockTimer(targetSeconds = AUTO_LOCK_DEFAULT_SECONDS): void {
    this.sessionTimeoutSeconds = targetSeconds;
    this.lastActivityReset = Date.now();
    this.autoLockSecondsRemaining.set(this.sessionTimeoutSeconds);
    this.clearAutoLockTimer();

    this.autoLockTimer = setInterval(() => {
      const remaining = this.autoLockSecondsRemaining() - 1;
      if (remaining <= 0) {
        this.lock();
      } else {
        this.autoLockSecondsRemaining.set(remaining);
      }
    }, 1000);
  }

  /**
   * Adds additional seconds to the current auto-lock timer countdown.
   */
  public addAutoLockTime(additionalSeconds: number): void {
    if (!this.isUnlocked() || additionalSeconds <= 0) return;
    const current = this.autoLockSecondsRemaining();
    const newRemaining = current + additionalSeconds;
    this.sessionTimeoutSeconds = Math.max(this.sessionTimeoutSeconds, newRemaining);
    this.autoLockSecondsRemaining.set(newRemaining);
    this.lastActivityReset = Date.now();
  }

  private clearAutoLockTimer(): void {
    if (this.autoLockTimer) {
      clearInterval(this.autoLockTimer);
      this.autoLockTimer = null;
    }
  }

  /**
   * Resets the auto-lock countdown timer if the vault is unlocked,
   * throttled to avoid excessive timer churn during continuous interactions.
   */
  public recordActivity(): void {
    if (!this.isUnlocked()) return;
    const now = Date.now();
    if (now - this.lastActivityReset >= 2000 && this.autoLockSecondsRemaining() < this.sessionTimeoutSeconds) {
      this.lastActivityReset = now;
      this.resetAutoLockTimer(this.sessionTimeoutSeconds);
    }
  }

  /**
   * Automatically resets the inactivity timer when the user interacts
   * with notes or the vault UI (opening, editing, reading, scrolling, searching).
   *
   * Captured centrally via capture-phase listeners on window, avoiding
   * boilerplate event handlers spread across individual components and templates.
   */
  private setupActivityListeners(): void {
    if (typeof window === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      const onUserActivity = (event: Event) => {
        if (!this.isUnlocked()) return;

        // Skip Escape key to avoid interfering with panic hotkey
        if (event instanceof KeyboardEvent && event.key === 'Escape') return;

        // Only track activity when on the vault page or within a vault overlay
        const currentUrl = this.router.url;
        if (!currentUrl || !currentUrl.startsWith('/vault')) return;

        const now = Date.now();
        if (now - this.lastActivityReset >= 2000 && this.autoLockSecondsRemaining() < this.sessionTimeoutSeconds) {
          this.lastActivityReset = now;
          this.ngZone.run(() => {
            this.resetAutoLockTimer(this.sessionTimeoutSeconds);
          });
        }
      };

      const eventOptions: AddEventListenerOptions = { capture: true, passive: true };
      window.addEventListener('pointerdown', onUserActivity, eventOptions);
      window.addEventListener('keydown', onUserActivity, eventOptions);
      window.addEventListener('wheel', onUserActivity, eventOptions);
      window.addEventListener('scroll', onUserActivity, eventOptions);
    });
  }

  /**
   * Panic hotkey: 3 Escape key presses within 1.5 seconds instantly locks
   * and navigates to the dashboard.
   */
  private setupPanicHotkey(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.isUnlocked()) {
        const now = Date.now();
        this.escapePressTimestamps.push(now);

        // Keep only events from the last 1500ms
        this.escapePressTimestamps = this.escapePressTimestamps.filter(
          (t) => now - t <= 1500
        );

        if (this.escapePressTimestamps.length >= 3) {
          this.escapePressTimestamps = [];
          this.lock();
          this.router.navigate(['/dashboard']);
        }
      }
    });
  }
}
