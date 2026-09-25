import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { LibraryTreeResponse } from '@core/models/library.model';
import { NoteResponse, NoteWikiIndexItem } from '@core/models/note.model';
import { LibraryService } from '@core/services/library.service';
import { NoteService } from '@core/services/note.service';
import { NotificationService } from '@core/services/notification.service';
import { ExploreLibraryTreeComponent } from './components/explore-library-tree/explore-library-tree.component';
import { ExploreNoteViewerComponent } from './components/explore-note-viewer/explore-note-viewer.component';
import { ExplorePaneResizerComponent } from './components/explore-pane-resizer/explore-pane-resizer.component';
import { ExploreNode, UNFILED_NODE_ID } from './explore-page.types';
import { LayoutService } from '@layout/layout.service';

/**
 * Explore is the wiki surface: one navigation column where libraries hold their
 * notes as leaves, and a read-only reader whose wiki-links navigate in place.
 * The global sidebar is hidden on this route (data: { hideSidebar: true }) so
 * the tree occupies the left edge instead of sitting beside a second column.
 */
@Component({
  selector: 'app-explore-page',
  standalone: true,
  imports: [
    ExploreLibraryTreeComponent,
    ExplorePaneResizerComponent,
    ExploreNoteViewerComponent,
  ],
  templateUrl: './explore-page.component.html',
  styleUrl: './explore-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  private readonly libraryService = inject(LibraryService);
  private readonly notification = inject(NotificationService);
  protected readonly layoutService = inject(LayoutService);

  protected readonly isLoading = signal<boolean>(true);
  protected readonly isLoadingNote = signal<boolean>(false);
  protected readonly selectedLibraryId = signal<string | null>(null);
  protected readonly selectedNoteId = signal<string | null>(null);
  protected readonly selectedNote = signal<NoteResponse | null>(null);
  protected readonly query = signal<string>('');

  private readonly libraryTree = signal<LibraryTreeResponse[]>([]);
  private readonly wikiIndex = signal<NoteWikiIndexItem[]>([]);

  /**
   * Journal notes are always wiki members. A Quick note joins once filed into a
   * library or referenced by another note, so scratch notes never dilute the
   * tree. Inbox is excluded. The server applies this filter; repeating it
   * client-side keeps a stale payload from leaking scratch notes.
   */
  private readonly isWikiMember = (item: NoteWikiIndexItem): boolean =>
    item.level === 'Journal' || item.libraryId != null || item.isReferenced;

  protected readonly tree = signal<ExploreNode[]>([]);

  /** Tree column width, driven by the drag handle and persisted by LayoutService. */
  protected readonly treeWidth = this.layoutService.exploreTreeWidth;

  /** Library the New Journal Note button files into. */
  protected readonly createTargetLibraryId = computed<string | null>(() => {
    const libId = this.selectedLibraryId();
    if (libId) return libId === UNFILED_NODE_ID ? null : libId;
    return this.selectedNote()?.libraryId ?? null;
  });

  protected readonly canCreate = computed(
    () => !!this.selectedLibraryId() || !!this.selectedNote(),
  );

  /**
   * Narrow viewports cannot show two columns at once, so the tree shows until
   * a note is picked, then the reader takes over. CSS keys off this one value.
   */
  protected readonly mobilePane = computed<'tree' | 'preview'>(() =>
    this.selectedNote() ? 'preview' : 'tree',
  );

  public ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const libId = params.get('libraryId');
      if (libId !== this.selectedLibraryId()) {
        this.selectedLibraryId.set(libId || null);
      }

      const noteId = params.get('note');
      if (noteId && noteId !== this.selectedNoteId()) {
        void this.loadNote(noteId);
      } else if (!noteId) {
        this.selectedNoteId.set(null);
        this.selectedNote.set(null);
      }
    });

    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    let pending = 2;
    const done = (): void => {
      pending -= 1;
      if (pending === 0) this.isLoading.set(false);
    };

    this.libraryService.getTree().subscribe({
      next: (tree) => {
        this.libraryTree.set(tree ?? []);
        this.rebuildTree();
        done();
      },
      error: () => {
        this.libraryTree.set([]);
        this.rebuildTree();
        done();
      },
    });

    this.noteService.getWikiIndex().subscribe({
      next: (index) => {
        this.wikiIndex.set(index ?? []);
        this.rebuildTree();
        done();
      },
      error: () => {
        this.wikiIndex.set([]);
        this.rebuildTree();
        this.notification.showError('Failed to load notes for Explore.');
        done();
      },
    });
  }

  // ------------------------------------------------------------------ tree

  private rebuildTree(): void {
    const index = this.wikiIndex().filter((item) => this.isWikiMember(item));
    this.tree.set(this.buildNodes(this.libraryTree(), index, 0));
  }

  /** Folders first, then that library's own notes, each group sorted by name. */
  private buildNodes(
    libraries: LibraryTreeResponse[],
    index: NoteWikiIndexItem[],
    depth: number,
  ): ExploreNode[] {
    const nodes: ExploreNode[] = (libraries ?? []).map((lib) => {
      const children = this.buildNodes(lib.children ?? [], index, depth + 1);
      const notes = this.noteNodes(index, lib.id, depth + 1);
      return {
        kind: 'library' as const,
        id: lib.id,
        label: lib.name,
        depth,
        noteCount: notes.length + children.reduce((sum, c) => sum + c.noteCount, 0),
        expandable: children.length > 0 || notes.length > 0,
        children: [...children, ...notes],
      };
    });

    if (depth === 0) {
      nodes.push(this.unfiledNode(index, depth));
    }

    return nodes;
  }

  private unfiledNode(index: NoteWikiIndexItem[], depth: number): ExploreNode {
    const notes = this.noteNodes(index, null, depth + 1);
    return {
      kind: 'unfiled',
      id: UNFILED_NODE_ID,
      label: 'Unfiled',
      depth,
      noteCount: notes.length,
      expandable: notes.length > 0,
      children: notes,
    };
  }

  private noteNodes(
    index: NoteWikiIndexItem[],
    libraryId: string | null,
    depth: number,
  ): ExploreNode[] {
    return index
      .filter((item) => (item.libraryId ?? null) === libraryId)
      .sort(byTitle)
      .map((item) => ({
        kind: 'note' as const,
        id: item.id,
        label: item.title || 'Untitled Note',
        depth,
        noteCount: 0,
        expandable: false,
        noteLevel: item.level,
        isReferenced: item.isReferenced,
        children: [] as ExploreNode[],
      }));
  }

  // ------------------------------------------------------------- selection

  public selectLibrary(libraryId: string): void {
    void this.router.navigate([], {
      queryParams: { libraryId, note: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  public selectUnfiled(): void {
    this.selectLibrary(UNFILED_NODE_ID);
  }

  public onQueryChange(query: string): void {
    this.query.set(query);
  }

  public createJournalNote(): void {
    void this.router.navigate(['/notes', 'new'], {
      queryParams: {
        level: 'Journal',
        libraryId: this.createTargetLibraryId(),
      },
    });
  }

  public reload(): void {
    this.load();
  }

  // ---------------------------------------------------------------- reader

  public selectNote(id: string): void {
    // Pushes a history entry (no replaceUrl) so the browser back button walks
    // back through the note trail instead of leaving Explore entirely.
    void this.router.navigate([], {
      queryParams: { note: id },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Opens the full editor with a return ticket: after save, cancel, or trash
   * the editor navigates back to this exact Explore state instead of home.
   */
  public editNote(id: string): void {
    void this.router.navigate(['/notes', id], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  private async loadNote(id: string): Promise<void> {
    this.selectedNoteId.set(id);
    this.isLoadingNote.set(true);
    try {
      this.selectedNote.set(await firstValueFrom(this.noteService.getById(id)));
    } catch {
      this.selectedNote.set(null);
      this.notification.showError('Failed to load note.');
    } finally {
      this.isLoadingNote.set(false);
    }
  }
}

function byTitle(a: NoteWikiIndexItem, b: NoteWikiIndexItem): number {
  return (a.title || '').localeCompare(b.title || '');
}
