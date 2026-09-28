import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { LayoutService } from '@layout/layout.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '@core/services/notification.service';
import { NoteCardComponent } from '@shared/components/note-card/note-card.component';
import { NoteDialogComponent, NoteDialogSavePayload } from '@shared/components/note-dialog/note-dialog.component';
import { QuickCaptureComponent, QuickCapturePayload } from '@shared/components/quick-capture/quick-capture.component';
import { openNoteEditor } from '@shared/utils/note-navigation';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, QuickCaptureComponent, NoteCardComponent, NoteDialogComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  protected readonly layoutService = inject(LayoutService);
  private readonly notification = inject(NotificationService);

  // Router inputs provided by withComponentInputBinding()
  public readonly q = input<string>();
  public readonly tag = input<string>();
  public readonly libraryId = input<string>();

  protected readonly notes = signal<NoteResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly selectedNote = signal<NoteResponse | null>(null);

  protected readonly activeTag = signal<string | null>(null);
  protected readonly activeLibraryId = signal<string | null>(null);

  protected readonly filteredNotes = computed<NoteResponse[]>(() => {
    const query = this.layoutService.searchQuery().toLowerCase().trim();
    const tag = this.activeTag()?.toLowerCase().trim();
    const libId = this.activeLibraryId();
    const all = this.notes().filter((n) => !n.isTrashed);

    return all.filter((n) => {
      if (libId && n.libraryId !== libId) return false;
      if (tag && !n.tags?.some((t) => formatTag(t).toLowerCase() === tag)) return false;
      if (!query) return true;

      return (
        (n.title || '').toLowerCase().includes(query) ||
        (n.bodyMarkdown || '').toLowerCase().includes(query) ||
        n.tags?.some((t) => formatTag(t).toLowerCase().includes(query))
      );
    });
  });

  constructor() {
    effect(() => {
      const query = this.q();
      if (query !== undefined && query !== this.layoutService.searchQuery()) {
        this.layoutService.setSearchQuery(query);
      }
      this.activeTag.set(this.tag() || null);
      this.activeLibraryId.set(this.libraryId() || null);
    });
  }

  public ngOnInit(): void {
    this.loadNotes();
  }

  public onTagClick(tag: string): void {
    const currentTag = this.activeTag();
    const nextTag = currentTag?.toLowerCase() === tag.toLowerCase() ? null : tag;
    void this.router.navigate([], {
      queryParams: { tag: nextTag },
      queryParamsHandling: 'merge'
    });
  }

  public clearTagFilter(): void {
    void this.router.navigate([], {
      queryParams: { tag: null },
      queryParamsHandling: 'merge'
    });
  }

  public clearLibraryFilter(): void {
    void this.router.navigate([], {
      queryParams: { libraryId: null },
      queryParamsHandling: 'merge'
    });
  }

  public clearSearchFilter(): void {
    this.layoutService.setSearchQuery('');
    void this.router.navigate([], {
      queryParams: { q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public clearAllFilters(): void {
    this.layoutService.setSearchQuery('');
    void this.router.navigate([], {
      queryParams: { q: null, tag: null, libraryId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public loadNotes(): void {
    this.isLoading.set(true);
    this.noteService.list({ isTrashed: false }).subscribe({
      next: (result) => {
        this.notes.set(result.items);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  public handleCreateNote(payload: QuickCapturePayload): void {
    this.noteService
      .create({
        level: payload.level,
        title: payload.title,
        bodyMarkdown: payload.bodyMarkdown,
        isTodo: payload.isTodo,
        libraryId: payload.libraryId,
        typeId: payload.typeId,
        typedMetadataJson: payload.typedMetadataJson,
        tags: payload.tags
      })
      .subscribe({
        next: (created) => {
          this.notes.update((list) => [created, ...list]);
          this.notification.showSuccess('Note created successfully.');
        },
        error: (err: { error?: { detail?: string } }) => {
          this.notification.showError(err.error?.detail ?? 'Failed to create note.');
        }
      });
  }

  public handleToggleTodo(note: NoteResponse): void {
    this.noteService.toggleTodo(note.id).subscribe({
      next: (updated) => {
        this.notes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
        if (this.selectedNote()?.id === updated.id) {
          this.selectedNote.set(updated);
        }
      }
    });
  }

  public handleTrashNote(note: NoteResponse): void {
    const originalIndex = this.notes().findIndex((n) => n.id === note.id);
    this.noteService.trash(note.id).subscribe({
      next: () => {
        this.notes.update((list) => list.filter((n) => n.id !== note.id));
        this.notification.showUndo('Note moved to trash.', () => {
          this.noteService.restore(note.id).subscribe({
            next: () => {
              this.notes.update((list) => {
                if (list.some((n) => n.id === note.id)) return list;
                const next = [...list];
                if (originalIndex >= 0 && originalIndex <= next.length) {
                  next.splice(originalIndex, 0, note);
                } else {
                  next.unshift(note);
                }
                return next;
              });
              this.notification.showSuccess('Note restored.');
            },
            error: () => {
              this.notification.showError('Failed to restore note.');
            },
          });
        });
      },
      error: () => {
        this.notification.showError('Failed to move note to trash.');
      },
    });
  }

  public handlePromoteNote(event: { note: NoteResponse; targetLevel: NoteLevel }): void {
    if (event.targetLevel === 'Journal') {
      void this.router.navigate(['/notes', event.note.id], { queryParams: { promoteTo: 'Journal' } });
      return;
    }

    this.noteService
      .promote(event.note.id, {
        targetLevel: event.targetLevel
      })
      .subscribe({
        next: (promoted) => {
          this.notes.update((list) => list.map((n) => (n.id === promoted.id ? promoted : n)));
          this.notification.showSuccess(`Promoted to ${event.targetLevel}.`);
        },
        error: (err: { error?: { detail?: string } }) => {
          this.notification.showError(err.error?.detail ?? 'Failed to promote note.');
        }
      });
  }

  public handleSaveDialog(payload: NoteDialogSavePayload): void {
    this.noteService
      .update(payload.id, {
        title: payload.title,
        bodyMarkdown: payload.bodyMarkdown,
        isTodo: payload.isTodo,
        libraryId: payload.libraryId,
        tags: payload.tags
      })
      .subscribe({
        next: (updated) => {
          this.notes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
        }
      });
  }

  public openNoteDialog(note: NoteResponse): void {
    this.selectedNote.set(note);
  }

  /** Universal pen: full-page editor with return ticket to this tab. */
  public openFullEditor(note: NoteResponse): void {
    void openNoteEditor(this.router, note.id);
  }
}
