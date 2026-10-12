import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { LibraryService } from '@core/services/library.service';
import { LayoutService } from '@layout/layout.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from '@core/services/notification.service';
import { NoteCardComponent } from '@shared/components/note-card/note-card.component';
import { NoteDialogComponent, NoteDialogSavePayload } from '@shared/components/note-dialog/note-dialog.component';
import { QuickCaptureComponent, QuickCapturePayload } from '@shared/components/quick-capture/quick-capture.component';
import { openNoteEditor } from '@shared/utils/note-navigation';

export interface TimelineGroup {
  dateKey: string;
  dateLabel: string;
  relativeLabel?: string;
  notes: NoteResponse[];
}

@Component({
  selector: 'app-notes-page',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, QuickCaptureComponent, NoteCardComponent, NoteDialogComponent],
  templateUrl: './notes-page.component.html',
  styleUrl: './notes-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  protected readonly libraryService = inject(LibraryService);
  protected readonly layoutService = inject(LayoutService);
  private readonly notification = inject(NotificationService);

  // Router inputs provided by withComponentInputBinding()
  public readonly level = input<NoteLevel>();
  public readonly q = input<string>();
  public readonly tag = input<string>();
  public readonly libraryId = input<string>();

  public readonly activeSubTab = signal<'All' | 'Inbox' | 'Note' | 'Journal'>('All');

  protected readonly notes = signal<NoteResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly selectedNote = signal<NoteResponse | null>(null);

  protected readonly activeTag = signal<string | null>(null);

  public readonly currentLevel = computed<NoteLevel | undefined>(() => this.level());

  protected readonly subTabCounts = computed(() => {
    const nonTrashed = this.notes().filter((n) => !n.isTrashed);
    return {
      all: nonTrashed.length,
      inbox: nonTrashed.filter((n) => n.level === 'Inbox').length,
      note: nonTrashed.filter((n) => n.level === 'Note').length,
      journal: nonTrashed.filter((n) => n.level === 'Journal').length,
    };
  });

  public readonly pageTitle = computed(() => {
    const libId = this.libraryId();
    if (libId) {
      return this.libraryService.getLibraryName(libId) ?? 'Library';
    }
    const level = this.currentLevel();
    if (level === 'Inbox') return 'Inbox';
    if (level === 'Note') return 'Notes';
    if (level === 'Journal') return 'Journals';
    return 'Notes & Journals';
  });

  public readonly pageSubtitle = computed(() => {
    const libId = this.libraryId();
    if (libId) {
      return 'Browse and triage inbox captures, notes, and journals in this library.';
    }
    const level = this.currentLevel();
    if (level === 'Inbox') return 'Minimal captures awaiting triage or promotion to Notes.';
    if (level === 'Note') return 'Durable free-form notes with tags and relations.';
    if (level === 'Journal') return 'Structured notes validated against types.';
    return 'All notes and journal entries in a unified timeline.';
  });

  public readonly levelFilter = signal<'all' | 'note' | 'journal'>(this.getStoredLevelFilter());

  protected readonly filteredNotes = computed<NoteResponse[]>(() => {
    const query = this.layoutService.searchQuery().toLowerCase().trim();
    const tag = this.activeTag()?.toLowerCase().trim();
    const libId = this.libraryId();
    const level = this.currentLevel();
    const subTab = this.activeSubTab();
    const filter = this.levelFilter();

    return this.notes().filter((n) => {
      if (n.isTrashed) return false;
      if (level && n.level !== level) return false;
      if (!libId && !level) {
        if (n.level === 'Inbox') return false;
        if (filter === 'note' && n.level !== 'Note') return false;
        if (filter === 'journal' && n.level !== 'Journal') return false;
      }
      if (libId && n.libraryId !== libId) return false;
      if (libId && subTab !== 'All' && n.level !== subTab) return false;
      if (tag && !n.tags?.some((t) => formatTag(t).toLowerCase() === tag)) return false;
      if (!query) return true;

      return (
        (n.title || '').toLowerCase().includes(query) ||
        (n.bodyMarkdown || '').toLowerCase().includes(query) ||
        n.tags?.some((t) => formatTag(t).toLowerCase().includes(query))
      );
    });
  });

  public readonly timelineBasis = signal<'createdAt' | 'updatedAt'>(this.getStoredTimelineBasis());
  public readonly sortDirection = signal<'desc' | 'asc'>(this.getStoredSortDirection());

  public readonly timelineGroups = computed<TimelineGroup[]>(() => {
    const notes = this.filteredNotes();
    if (notes.length === 0) return [];

    const basis = this.timelineBasis();
    const isDesc = this.sortDirection() === 'desc';

    // 1. Sort notes chronologically by chosen date
    const sorted = [...notes].sort((a, b) => {
      const timeA = new Date(basis === 'createdAt' ? a.createdAtUtc : a.updatedAtUtc).getTime() || 0;
      const timeB = new Date(basis === 'createdAt' ? b.createdAtUtc : b.updatedAtUtc).getTime() || 0;
      return isDesc ? timeB - timeA : timeA - timeB;
    });

    // 2. Group notes by calendar day in local time
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

    const result: TimelineGroup[] = [];

    for (const [dateKey, { date, notes: groupNotes }] of groupsMap) {
      const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffTime = today.getTime() - targetDay.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let relativeLabel: string | undefined;
      if (diffDays === 0) {
        relativeLabel = 'Today';
      } else if (diffDays === 1) {
        relativeLabel = 'Yesterday';
      } else if (diffDays === -1) {
        relativeLabel = 'Tomorrow';
      }

      const dateLabel = date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      result.push({
        dateKey,
        dateLabel,
        relativeLabel,
        notes: groupNotes
      });
    }

    return result;
  });

  public setTimelineBasis(basis: 'createdAt' | 'updatedAt'): void {
    if (this.timelineBasis() === basis) return;
    this.timelineBasis.set(basis);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('journalt-timeline-basis', basis);
    }
    this.loadNotes();
  }

  public toggleSortDirection(): void {
    const next = this.sortDirection() === 'desc' ? 'asc' : 'desc';
    this.sortDirection.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('journalt-timeline-direction', next);
    }
    this.loadNotes();
  }

  private getStoredTimelineBasis(): 'createdAt' | 'updatedAt' {
    if (typeof localStorage === 'undefined') return 'createdAt';
    const stored = localStorage.getItem('journalt-timeline-basis');
    return stored === 'updatedAt' ? 'updatedAt' : 'createdAt';
  }

  private getStoredSortDirection(): 'desc' | 'asc' {
    if (typeof localStorage === 'undefined') return 'desc';
    const stored = localStorage.getItem('journalt-timeline-direction');
    return stored === 'asc' ? 'asc' : 'desc';
  }

  public setLevelFilter(filter: 'all' | 'note' | 'journal'): void {
    if (this.levelFilter() === filter) return;
    this.levelFilter.set(filter);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('journalt-notes-level-filter', filter);
    }
  }

  private getStoredLevelFilter(): 'all' | 'note' | 'journal' {
    if (typeof localStorage === 'undefined') return 'all';
    const stored = localStorage.getItem('journalt-notes-level-filter');
    return stored === 'note' || stored === 'journal' ? stored : 'all';
  }

  constructor() {
    effect(() => {
      // Reload notes whenever level route or libraryId changes
      const lvl = this.currentLevel();
      const libId = this.libraryId();
      untracked(() => {
        this.activeSubTab.set('All');
        this.loadNotes(lvl, libId);
      });
    });

    effect(() => {
      // Ensure library name is loaded if viewing library
      const libId = this.libraryId();
      if (libId) {
        untracked(() => this.libraryService.loadLibraries());
      }
    });

    effect(() => {
      // Sync query params smoothly via inputs
      const query = this.q();
      if (query !== undefined && query !== this.layoutService.searchQuery()) {
        this.layoutService.setSearchQuery(query);
      }
      this.activeTag.set(this.tag() || null);
    });
  }

  public ngOnInit(): void {
    // Initial fetch handled by effect() reacting to currentLevel() & libraryId()
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
      queryParams: { q: null, tag: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public loadNotes(level?: NoteLevel, libraryId?: string): void {
    this.isLoading.set(true);
    const effectiveLevel = level !== undefined ? level : this.currentLevel();
    const effectiveLibId = libraryId !== undefined ? libraryId : (this.libraryId() || undefined);

    this.noteService
      .list({
        level: effectiveLevel,
        libraryId: effectiveLibId,
        isTrashed: false,
        sortBy: this.timelineBasis(),
        sortOrder: this.sortDirection(),
        pageSize: 100
      })
      .subscribe({
        next: (result) => {
          this.notes.set(result.items);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
  }

  public handleCreateNote(payload: QuickCapturePayload): void {
    const targetLibraryId = payload.libraryId ?? this.libraryId() ?? undefined;
    this.noteService
      .create({
        level: payload.level,
        format: payload.format,
        title: payload.title,
        bodyMarkdown: payload.bodyMarkdown,
        isTodo: payload.isTodo,
        libraryId: targetLibraryId,
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

  public handleTogglePin(note: NoteResponse): void {
    this.noteService.togglePin(note.id).subscribe({
      next: (updated) => {
        this.notes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
        if (this.selectedNote()?.id === updated.id) {
          this.selectedNote.set(updated);
        }
        this.notification.showSuccess(updated.isPinned ? 'Note pinned.' : 'Note unpinned.');
      },
      error: (err: { error?: { detail?: string } }) => {
        this.notification.showError(err.error?.detail ?? 'Failed to update pin state.');
      }
    });
  }

  public handlePinDialog(updated: NoteResponse): void {
    this.notes.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
    this.selectedNote.set(updated);
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
