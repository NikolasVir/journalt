import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { LayoutService } from '@layout/layout.service';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '@core/services/notification.service';
import { NoteCardComponent } from '@shared/components/note-card/note-card.component';
import { NoteDialogComponent, NoteDialogSavePayload } from '@shared/components/note-dialog/note-dialog.component';
import { QuickCaptureComponent, QuickCapturePayload } from '@shared/components/quick-capture/quick-capture.component';

@Component({
  selector: 'app-notes-page',
  standalone: true,
  imports: [MatIconModule, QuickCaptureComponent, NoteCardComponent, NoteDialogComponent],
  templateUrl: './notes-page.component.html',
  styleUrl: './notes-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  protected readonly layoutService = inject(LayoutService);
  private readonly notification = inject(NotificationService);

  private readonly routeData = toSignal(this.route.data);

  protected readonly notes = signal<NoteResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly selectedNote = signal<NoteResponse | null>(null);

  public readonly currentLevel = computed<NoteLevel | undefined>(() => {
    return this.routeData()?.['level'] as NoteLevel | undefined;
  });

  public readonly pageTitle = computed(() => {
    const level = this.currentLevel();
    if (level === 'Inbox') return 'Inbox';
    if (level === 'Quick') return 'Quick Notes';
    if (level === 'Journal') return 'Journal';
    return 'All Notes';
  });

  public readonly pageSubtitle = computed(() => {
    const level = this.currentLevel();
    if (level === 'Inbox') return 'Minimal captures awaiting triage or promotion to Quick Note.';
    if (level === 'Quick') return 'Durable free-form notes with tags and relations.';
    if (level === 'Journal') return 'Structured notes validated against type schemas.';
    return 'Browse and manage your personal knowledge records.';
  });

  protected readonly filteredNotes = computed<NoteResponse[]>(() => {
    const query = this.layoutService.searchQuery().toLowerCase().trim();
    const level = this.currentLevel();

    return this.notes().filter((n) => {
      if (n.isTrashed) return false;
      if (level && n.level !== level) return false;
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
      // Reload or filter when route data changes
      const lvl = this.currentLevel();
      this.loadNotes(lvl);
    });
  }

  public ngOnInit(): void {
    this.loadNotes(this.currentLevel());
  }

  public loadNotes(level?: NoteLevel): void {
    this.isLoading.set(true);
    this.noteService.list({ level, isTrashed: false }).subscribe({
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
    this.noteService.trash(note.id).subscribe({
      next: () => {
        this.notes.update((list) => list.filter((n) => n.id !== note.id));
      }
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
