import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { DecryptedVaultNote } from '@core/models/vault.model';
import { NotificationService } from '@core/services/notification.service';
import { VaultService } from '@core/services/vault.service';
import { LayoutService } from '@layout/layout.service';
import { NoteCardComponent } from '@shared/components/note-card/note-card.component';
import {
  VaultNoteDialogComponent,
  VaultNoteDialogResult
} from './vault-note-dialog/vault-note-dialog.component';
import { ChangePassphraseDialogComponent } from './change-passphrase-dialog/change-passphrase-dialog.component';

export interface VaultTimelineGroup {
  dateKey: string;
  dateLabel: string;
  relativeLabel?: string;
  notes: NoteResponse[];
}

/** Maps a decrypted vault note onto the shared NoteResponse shape so the
 * vault reuses the exact same card component as normal notes. Sharing is
 * disabled and trash does not exist: every note is live. */
export function toVaultNoteResponse(note: DecryptedVaultNote): NoteResponse {
  return {
    id: note.id,
    userId: '',
    level: note.level,
    format: 'Markdown',
    title: note.title,
    bodyMarkdown: note.bodyMarkdown,
    renderedHtml: note.renderedHtml ?? '',
    isTodo: note.isTodo,
    todoCompletedAtUtc: note.todoCompletedAtUtc,
    isTrashed: false,
    trashedAtUtc: null,
    createdAtUtc: note.createdAtUtc,
    updatedAtUtc: note.updatedAtUtc,
    tags: (note.tags ?? []).map((t) => ({
      tagType: 'FreeForm' as const,
      category: null,
      value: t
    })),
    isOwner: true,
    isShared: false,
    isPinned: note.isPinned,
    pinnedAtUtc: note.pinnedAtUtc
  };
}

@Component({
  selector: 'app-vault-page',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NoteCardComponent
  ],
  templateUrl: './vault-page.component.html',
  styleUrl: './vault-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VaultPageComponent implements OnDestroy {
  protected readonly vaultService = inject(VaultService);
  protected readonly layoutService = inject(LayoutService);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(NotificationService);

  // Locked View State
  public readonly passphrase = signal<string>('');
  public readonly showPassword = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);

  // Unlocked View State: single page with everything, no tabs, no trash.
  public readonly searchQuery = signal<string>('');
  public readonly activeTag = signal<string | null>(null);
  public readonly timelineBasis = signal<'createdAt' | 'updatedAt'>('createdAt');
  public readonly sortDirection = signal<'desc' | 'asc'>('desc');

  public readonly filteredNotes = computed<NoteResponse[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const tag = this.activeTag()?.toLowerCase().trim();

    return this.vaultService
      .notes()
      .map(toVaultNoteResponse)
      .filter((n) => {
        if (tag && !n.tags?.some((t) => formatTag(t).toLowerCase() === tag)) return false;
        if (!q) return true;
        return (
          (n.title || '').toLowerCase().includes(q) ||
          (n.bodyMarkdown || '').toLowerCase().includes(q) ||
          n.tags?.some((t) => formatTag(t).toLowerCase().includes(q))
        );
      });
  });

  public readonly timelineGroups = computed<VaultTimelineGroup[]>(() => {
    const notes = this.filteredNotes();
    if (notes.length === 0) return [];

    const basis = this.timelineBasis();
    const isDesc = this.sortDirection() === 'desc';

    const sorted = [...notes].sort((a, b) => {
      const timeA = new Date(basis === 'createdAt' ? a.createdAtUtc : a.updatedAtUtc).getTime() || 0;
      const timeB = new Date(basis === 'createdAt' ? b.createdAtUtc : b.updatedAtUtc).getTime() || 0;
      return isDesc ? timeB - timeA : timeA - timeB;
    });

    const groupsMap = new Map<string, { date: Date; notes: NoteResponse[] }>();
    for (const note of sorted) {
      const rawDate = basis === 'createdAt' ? note.createdAtUtc : note.updatedAtUtc;
      const d = new Date(rawDate);
      const validDate = Number.isNaN(d.getTime()) ? new Date(0) : d;
      const year = validDate.getFullYear();
      const month = String(validDate.getMonth() + 1).padStart(2, '0');
      const day = String(validDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      let group = groupsMap.get(dateKey);
      if (!group) {
        group = { date: validDate, notes: [] };
        groupsMap.set(dateKey, group);
      }
      group.notes.push(note);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const result: VaultTimelineGroup[] = [];

    for (const [dateKey, { date, notes: groupNotes }] of groupsMap) {
      const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffTime = today.getTime() - targetDay.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let relativeLabel: string | undefined;
      if (diffDays === 0) relativeLabel = 'Today';
      else if (diffDays === 1) relativeLabel = 'Yesterday';
      else if (diffDays === -1) relativeLabel = 'Tomorrow';

      const dateLabel = date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      result.push({ dateKey, dateLabel, relativeLabel, notes: groupNotes });
    }

    return result;
  });

  public readonly formattedTimer = computed(() => {
    const total = this.vaultService.autoLockSecondsRemaining();
    if (total <= 0) return '0:00';
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  public setTimelineBasis(basis: 'createdAt' | 'updatedAt'): void {
    this.timelineBasis.set(basis);
  }

  public toggleSortDirection(): void {
    this.sortDirection.update((d) => (d === 'desc' ? 'asc' : 'desc'));
  }

  public onTagClick(tag: string): void {
    const current = this.activeTag();
    this.activeTag.set(current?.toLowerCase() === tag.toLowerCase() ? null : tag);
  }

  public clearTagFilter(): void {
    this.activeTag.set(null);
  }

  public clearSearchFilter(): void {
    this.searchQuery.set('');
  }

  public clearAllFilters(): void {
    this.searchQuery.set('');
    this.activeTag.set(null);
  }

  public onResetTimer(): void {
    this.vaultService.resetAutoLockTimer();
    this.notification.showInfo('Vault auto-lock timer reset to 5 minutes.');
  }

  public onAddTime(minutes: number): void {
    this.vaultService.addAutoLockTime(minutes * 60);
    this.notification.showInfo(`Added ${minutes} minutes to vault auto-lock timer.`);
  }

  public togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  public async onUnlock(): Promise<void> {
    this.errorMessage.set(null);
    const pass = this.passphrase().trim();
    if (!pass) return;

    const result = await this.vaultService.unlock(pass);

    // No vault exists for this passphrase: create one silently (seeded with
    // realistic notes) and open it. The lack of a confirmation step is
    // intentional: it preserves plausible deniability for decoy vaults, so an
    // observer cannot tell whether the vault already existed.
    if (result.needsInit) {
      const initResult = await this.vaultService.initializeVault(pass);
      if (!initResult.success) {
        this.errorMessage.set(initResult.error ?? 'Failed to initialize vault.');
        return;
      }
      this.passphrase.set('');
      return;
    }

    if (!result.success) {
      this.errorMessage.set(result.error ?? 'Invalid passphrase.');
      return;
    }

    this.passphrase.set('');
  }

  public onLock(): void {
    this.vaultService.lock();
    this.passphrase.set('');
    this.errorMessage.set(null);
    this.searchQuery.set('');
    this.activeTag.set(null);
  }

  /**
   * Leaving the vault page counts as exiting the vault: lock immediately so the
   * keys are wiped and an auto-created, unused vault is discarded.
   */
  public ngOnDestroy(): void {
    this.vaultService.lock();
  }

  public openCreateDialog(): void {
    const ref = this.dialog.open(VaultNoteDialogComponent, {
      width: '560px',
      data: { defaultLevel: 'Note' as NoteLevel }
    });

    ref.afterClosed().subscribe((res: VaultNoteDialogResult | undefined) => {
      if (res) {
        void this.vaultService.createNote(res);
      }
    });
  }

  public openEditDialog(note: NoteResponse): void {
    const current = this.vaultService.notes().find((n) => n.id === note.id);
    if (!current) return;
    const ref = this.dialog.open(VaultNoteDialogComponent, {
      width: '560px',
      data: { note: current }
    });

    ref.afterClosed().subscribe((res: VaultNoteDialogResult | undefined) => {
      if (res) {
        void this.vaultService.updateNote(note.id, res);
      }
    });
  }

  public async handleTogglePin(note: NoteResponse): Promise<void> {
    await this.vaultService.togglePin(note.id);
  }

  public async handleToggleTodo(note: NoteResponse): Promise<void> {
    await this.vaultService.toggleTodo(note.id);
  }

  public async handlePromoteNote(event: { note: NoteResponse; targetLevel: NoteLevel }): Promise<void> {
    await this.vaultService.promoteNote(event.note.id, event.targetLevel);
    this.notification.showSuccess(`Promoted to ${event.targetLevel}.`);
  }

  /** Vault has no trash: deletes are permanent, so every delete needs a warning. */
  public async handleDeleteNote(note: NoteResponse): Promise<void> {
    if (!confirm(`Permanently delete "${note.title || 'Untitled note'}"? This cannot be undone.`)) {
      return;
    }
    await this.vaultService.deleteNote(note.id);
    this.notification.showSuccess('Note permanently deleted.');
  }

  public openChangePassphraseDialog(): void {
    this.dialog.open(ChangePassphraseDialogComponent, {
      width: '460px'
    });
  }
}
