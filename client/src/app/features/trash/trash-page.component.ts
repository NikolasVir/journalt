import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatTag, NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { NotificationService } from '@core/services/notification.service';

@Component({
  selector: 'app-trash-page',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="trash-page">
      <header class="trash-page__header">
        <div class="trash-page__header-text">
          <h1 class="trash-page__title">Trash</h1>
          <p class="trash-page__subtitle">
            Notes in Trash can be restored or permanently deleted.
          </p>
        </div>

        @if (trashedNotes().length > 0) {
          <button
            mat-stroked-button
            color="warn"
            (click)="emptyTrash()"
            [disabled]="isActionInProgress()"
            class="trash-page__empty-btn"
          >
            <mat-icon>delete_forever</mat-icon>
            <span>Empty Trash</span>
          </button>
        }
      </header>

      @if (isLoading()) {
        <div class="trash-page__loading">
          <mat-icon class="spinning">sync</mat-icon>
          <span>Loading trash...</span>
        </div>
      } @else if (trashedNotes().length === 0) {
        <div class="trash-page__empty">
          <mat-icon class="trash-page__empty-icon">delete_outline</mat-icon>
          <p class="trash-page__empty-title">Trash is empty</p>
          <p class="trash-page__empty-desc">Deleted notes will show up here before permanent removal.</p>
        </div>
      } @else {
        <div class="trash-page__grid">
          @for (note of trashedNotes(); track note.id) {
            <mat-card appearance="outlined" class="trash-card">
              <mat-card-header>
                <mat-card-title class="trash-card__title">
                  {{ note.title || 'Untitled note' }}
                </mat-card-title>
                <mat-card-subtitle class="trash-card__subtitle">
                  Deleted {{ note.trashedAtUtc | date:'mediumDate' }}
                </mat-card-subtitle>
              </mat-card-header>

              <mat-card-content class="trash-card__content">
                @if (note.renderedHtml) {
                  <div class="trash-card__body" [innerHTML]="note.renderedHtml"></div>
                } @else if (note.bodyMarkdown) {
                  <p class="trash-card__body-text">{{ note.bodyMarkdown }}</p>
                }

                @if ((note.tags?.length ?? 0) > 0) {
                  <mat-chip-set class="trash-card__chips">
                    @for (tag of note.tags ?? []; track tag.value) {
                      <mat-chip class="trash-card__chip">#{{ formatTag(tag) }}</mat-chip>
                    }
                  </mat-chip-set>
                }
              </mat-card-content>

              <mat-card-actions class="trash-card__actions">
                <button
                  mat-button
                  color="primary"
                  (click)="restoreNote(note)"
                  [disabled]="isActionInProgress()"
                >
                  <mat-icon>restore_from_trash</mat-icon>
                  <span>Restore</span>
                </button>
                <button
                  mat-button
                  color="warn"
                  (click)="deletePermanently(note)"
                  [disabled]="isActionInProgress()"
                >
                  <mat-icon>delete_forever</mat-icon>
                  <span>Delete Forever</span>
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: `
    @use 'mixins' as *;

    .trash-page {
      @include flex-column;
      gap: var(--spacing-lg);
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;

      &__header {
        @include flex-row;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--color-border-card);
        padding-bottom: var(--spacing-md);
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      &__title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      &__subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: var(--spacing-2xs) 0 0 0;
      }

      &__loading,
      &__empty {
        @include flex-column;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-2xl) 0;
        color: var(--color-text-muted);

        mat-icon {
          font-size: 56px;
          width: 56px;
          height: 56px;
        }
      }

      &__empty-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        margin: 0;
      }

      &__empty-desc {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        margin: 0;
      }

      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--spacing-md);
      }
    }

    .trash-card {
      @include flex-column;
      justify-content: space-between;
      height: 100%;
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);

      &__title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
      }

      &__subtitle {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      &__content {
        @include flex-column;
        gap: var(--spacing-xs);
        padding-top: var(--spacing-xs);
        flex-grow: 1;
      }

      &__body {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        max-height: 120px;
        overflow: hidden;
      }

      &__body-text {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      &__chips {
        margin-top: var(--spacing-2xs);
      }

      &__chip {
        font-size: var(--font-size-xs);
        min-height: 24px;
      }

      &__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-xs);
        border-top: 1px solid var(--color-border-card);
        padding: var(--spacing-xs) var(--spacing-sm);
      }
    }

    .spinning {
      animation: spin 1.2s linear infinite;
    }

    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrashPageComponent implements OnInit {
  private readonly noteService = inject(NoteService);
  private readonly notification = inject(NotificationService);

  protected readonly formatTag = formatTag;
  protected readonly trashedNotes = signal<NoteResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isActionInProgress = signal<boolean>(false);

  public ngOnInit(): void {
    this.loadTrashedNotes();
  }

  public loadTrashedNotes(): void {
    this.isLoading.set(true);
    this.noteService.list({ isTrashed: true }).subscribe({
      next: (res) => {
        this.trashedNotes.set(res.items);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.notification.showError('Failed to load trashed notes.');
      }
    });
  }

  public restoreNote(note: NoteResponse): void {
    this.isActionInProgress.set(true);
    this.noteService.restore(note.id).subscribe({
      next: () => {
        this.trashedNotes.update((list) => list.filter((n) => n.id !== note.id));
        this.isActionInProgress.set(false);
        this.notification.showSuccess(`"${note.title || 'Note'}" restored.`);
      },
      error: () => {
        this.isActionInProgress.set(false);
        this.notification.showError('Failed to restore note.');
      }
    });
  }

  public deletePermanently(note: NoteResponse): void {
    if (!confirm(`Permanently delete "${note.title || 'Untitled note'}"? This cannot be undone.`)) {
      return;
    }

    this.isActionInProgress.set(true);
    this.noteService.deletePermanent(note.id).subscribe({
      next: () => {
        this.trashedNotes.update((list) => list.filter((n) => n.id !== note.id));
        this.isActionInProgress.set(false);
        this.notification.showSuccess('Note permanently deleted.');
      },
      error: () => {
        this.isActionInProgress.set(false);
        this.notification.showError('Failed to permanently delete note.');
      }
    });
  }

  public emptyTrash(): void {
    const count = this.trashedNotes().length;
    if (!count) return;

    if (!confirm(`Permanently delete all ${count} notes in trash? This cannot be undone.`)) {
      return;
    }

    this.isActionInProgress.set(true);
    const notesToDelete = [...this.trashedNotes()];
    let completed = 0;

    notesToDelete.forEach((note) => {
      this.noteService.deletePermanent(note.id).subscribe({
        next: () => {
          completed++;
          if (completed === notesToDelete.length) {
            this.trashedNotes.set([]);
            this.isActionInProgress.set(false);
            this.notification.showSuccess('Trash emptied.');
          }
        },
        error: () => {
          completed++;
          if (completed === notesToDelete.length) {
            this.loadTrashedNotes();
            this.isActionInProgress.set(false);
          }
        }
      });
    });
  }
}
