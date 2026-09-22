import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { LayoutService } from '@layout/layout.service';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '@core/services/notification.service';
import { NoteCardComponent } from '@shared/components/note-card/note-card.component';
import { NoteDialogComponent, NoteDialogSavePayload } from '@shared/components/note-dialog/note-dialog.component';
import { QuickCaptureComponent, QuickCapturePayload } from '@shared/components/quick-capture/quick-capture.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [MatIconModule, QuickCaptureComponent, NoteCardComponent, NoteDialogComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements OnInit {
  private readonly noteService = inject(NoteService);
  private readonly layoutService = inject(LayoutService);
  private readonly notification = inject(NotificationService);

  protected readonly notes = signal<NoteResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly selectedNote = signal<NoteResponse | null>(null);

  protected readonly filteredNotes = computed<NoteResponse[]>(() => {
    const query = this.layoutService.searchQuery().toLowerCase().trim();
    const all = this.notes().filter((n) => !n.isTrashed);

    if (!query) return all;

    return all.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(query) ||
        (n.bodyMarkdown || '').toLowerCase().includes(query) ||
        n.tags?.some((t) => formatTag(t).toLowerCase().includes(query))
    );
  });

  public ngOnInit(): void {
    this.loadNotes();
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
        tags: payload.tags
      })
      .subscribe({
        next: (created) => {
          this.notes.update((list) => [created, ...list]);
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
    this.noteService.trash(note.id).subscribe({
      next: () => {
        this.notes.update((list) => list.filter((n) => n.id !== note.id));
      }
    });
  }

  public handlePromoteNote(event: { note: NoteResponse; targetLevel: NoteLevel }): void {
    if (event.targetLevel === 'Journal') {
      this.notification.showInfo('Promotion to Journal requires choosing a Type Schema in note details.');
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
}
