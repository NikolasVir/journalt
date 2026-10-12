import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { LibraryResponse } from '@core/models/library.model';
import {
  formatTag,
  NoteLevel,
  NoteResponse,
  NoteSourceResponse,
  TagDto,
} from '@core/models/note.model';
import { LibraryService } from '@core/services/library.service';
import { MarkdownEnhancerService } from '@core/services/markdown-enhancer.service';
import { NoteService } from '@core/services/note.service';
import { NotificationService } from '@core/services/notification.service';
import { TypedTagSelectorComponent } from '@shared/components/typed-tag-selector/typed-tag-selector.component';
import { NoteEditButtonComponent } from '@shared/components/note-edit-button/note-edit-button.component';
import { NoteMetadataViewComponent } from '@shared/components/note-metadata-view/note-metadata-view.component';
import { ChecklistEditorComponent } from '@shared/components/checklist-editor/checklist-editor.component';
import { ShareDialogComponent } from '@shared/components/share-dialog/share-dialog.component';

export interface NoteDialogSavePayload {
  id: string;
  title: string;
  bodyMarkdown: string;
  isTodo: boolean;
  tags: (TagDto | string)[];
  libraryId?: string | null;
}

@Component({
  selector: 'app-note-dialog',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    TypedTagSelectorComponent,
    NoteEditButtonComponent,
    NoteMetadataViewComponent,
    ChecklistEditorComponent,
  ],
  templateUrl: './note-dialog.component.html',
  styleUrl: './note-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteDialogComponent {
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  private readonly libraryService = inject(LibraryService);
  private readonly markdownEnhancer = inject(MarkdownEnhancerService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  public readonly note = input<NoteResponse | null>(null);

  public readonly close = output<void>();
  public readonly save = output<NoteDialogSavePayload>();
  public readonly trash = output<NoteResponse>();
  public readonly promote = output<{ id: string; targetLevel: NoteLevel }>();
  public readonly pin = output<NoteResponse>();

  protected readonly renderedContainer = viewChild<ElementRef<HTMLElement>>('renderedContainer');

  protected readonly editTitle = linkedSignal(() => this.note()?.title ?? '');
  protected readonly editBody = linkedSignal(() => this.note()?.bodyMarkdown ?? '');
  protected readonly editTags = linkedSignal(() => {
    const current = this.note();
    if (!current || current.level !== 'Note') return '';
    return (current.tags ?? []).map(formatTag).filter(Boolean).join(', ');
  });
  protected readonly editTypedTags = linkedSignal<TagDto[]>(() => {
    const current = this.note();
    if (!current || current.level !== 'Journal') return [];
    return (current.tags ?? []).filter((tag) => tag.tagType === 'Typed');
  });
  protected readonly legacyTags = linkedSignal<TagDto[]>(() => {
    const current = this.note();
    if (!current || current.level !== 'Journal') return [];
    return (current.tags ?? []).filter((tag) => tag.tagType !== 'Typed');
  });
  protected readonly isTagsExpanded = linkedSignal<boolean>(() => {
    const current = this.note();
    if (!current || current.level !== 'Journal') return false;
    return (current.tags ?? []).some((tag) => tag.tagType !== 'Typed');
  });
  protected readonly tagCount = computed(() => {
    const current = this.note();
    if (!current) return 0;
    if (current.level === 'Journal') {
      return this.editTypedTags().length;
    }
    if (current.level === 'Note') {
      const raw = this.editTags() ?? '';
      return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean).length;
    }
    return 0;
  });
  protected readonly editIsTodo = linkedSignal(() => this.note()?.isTodo ?? false);
  protected readonly editLibraryId = linkedSignal(() => this.note()?.libraryId ?? null);
  protected readonly libraries = signal<LibraryResponse[]>([]);
  protected readonly selectedLibraryName = computed(() => {
    const libId = this.editLibraryId();
    if (!libId) return 'Unfiled';
    const found = this.libraries().find((l) => l.id === libId);
    if (!found) return 'Unfiled';
    return found.name + (found.isShared && found.ownerUserName ? ` (@${found.ownerUserName})` : '');
  });
  protected readonly sources = signal<NoteSourceResponse[]>([]);
  protected readonly isSourcesExpanded = signal<boolean>(false);
  protected readonly newCitation = signal<string>('');
  protected readonly newUrl = signal<string>('');
  protected readonly isAddingSource = signal<boolean>(false);
  protected readonly isSubmittingSource = signal<boolean>(false);
  protected readonly sourceError = signal<string | null>(null);
  protected readonly renderedHtml = linkedSignal(() => this.note()?.renderedHtml ?? '');
  protected readonly typeValidationWarnings = signal<string[]>([]);
  protected readonly detailedNote = signal<NoteResponse | null>(null);
  protected readonly typedMetadata = computed(
    () => this.detailedNote()?.typedMetadataJson ?? this.note()?.typedMetadataJson ?? null
  );
  protected readonly summary = computed(
    () => this.detailedNote()?.summary ?? this.note()?.summary ?? null
  );
  private pointerDownOnBackdrop = false;

  constructor() {
    this.libraryService
      .list()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (libs) => this.libraries.set(libs),
        error: () => this.libraries.set([])
      });

    // Reactively fetch sources when active note changes, automatically cancelling in-flight requests
    toObservable(this.note)
      .pipe(
        switchMap((current) => {
          if (!current) return of([]);
          return this.noteService.getSources(current.id).pipe(catchError(() => of([])));
        }),
        takeUntilDestroyed()
      )
      .subscribe((s) => {
        this.sources.set(s ?? []);
        this.isAddingSource.set(false);
        this.newCitation.set('');
        this.newUrl.set('');
      });

    // Reactively fetch full note details (typed metadata, validation warnings) for Journal notes
    toObservable(this.note)
      .pipe(
        switchMap((current) => {
          if (!current || current.level !== 'Journal' || !current.typeId) {
            return of(null);
          }
          if (
            current.typedMetadataJson !== undefined &&
            current.typeValidationWarnings !== undefined &&
            current.typeValidationWarnings !== null
          ) {
            return of(current);
          }
          if (typeof this.noteService.getById !== 'function') {
            return of(null);
          }
          return this.noteService.getById(current.id).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed()
      )
      .subscribe((detailedNote) => {
        this.detailedNote.set(detailedNote);
        this.typeValidationWarnings.set(detailedNote?.typeValidationWarnings ?? []);
      });

    effect(() => {
      const containerRef = this.renderedContainer();
      const html = this.renderedHtml();
      if (containerRef?.nativeElement && html) {
        setTimeout(() => {
          if (containerRef.nativeElement) {
            void this.markdownEnhancer.enhance(containerRef.nativeElement);
          }
        }, 0);
      }
    });
  }

  public onRenderedContentClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest('a');
    if (target) {
      const href = target.getAttribute('href');
      if (href && href.startsWith('/notes/')) {
        event.preventDefault();
        this.onClose();
        void this.router.navigateByUrl(href);
      }
    }
  }

  public get nextPromoteLevel(): NoteLevel | null {
    const current = this.note();
    if (!current) return null;
    if (current.level === 'Inbox') return 'Note';
    if (current.level === 'Note' && current.format !== 'List') return 'Journal';
    return null;
  }

  public onClose(): void {
    const current = this.note();
    if (current) {
      if (current.level === 'Journal' && this.legacyTags().length > 0) return;

      const tags: (TagDto | string)[] =
        current.level === 'Journal'
          ? this.editTypedTags()
          : (this.editTags() ?? '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean);

      this.save.emit({
        id: current.id,
        title: (this.editTitle() ?? '').trim() || current.title,
        bodyMarkdown: (this.editBody() ?? '').trim(),
        isTodo: this.editIsTodo(),
        tags,
        libraryId: this.editLibraryId(),
      });
    }
    this.close.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  public onEscapeKey(event: Event): void {
    if (this.note()) {
      event.preventDefault();
      this.onClose();
    }
  }

  public onOpenShare(): void {
    const current = this.note();
    if (!current) return;

    const ref = this.dialog.open(ShareDialogComponent, {
      width: '440px',
      data: {
        noteId: current.id,
        noteTitle: this.editTitle() || current.title || 'Untitled Note',
      },
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.leftNote) {
        this.close.emit();
      }
    });
  }

  public removeLegacyTags(): void {
    this.legacyTags.set([]);
  }

  public onBackdropPointerDown(event: PointerEvent): void {
    this.pointerDownOnBackdrop = event.target === event.currentTarget;
  }

  public onBackdropPointerCancel(): void {
    this.pointerDownOnBackdrop = false;
  }

  public onBackdropClick(event: MouseEvent): void {
    const shouldClose = this.pointerDownOnBackdrop && event.target === event.currentTarget;
    this.pointerDownOnBackdrop = false;

    if (shouldClose) {
      this.onClose();
    }
  }

  public onTrash(): void {
    const current = this.note();
    if (current) {
      this.trash.emit(current);
      this.close.emit();
    }
  }

  public onTogglePin(): void {
    const current = this.note();
    if (!current) return;
    this.noteService.togglePin(current.id).subscribe({
      next: (updated) => {
        this.pin.emit(updated);
        this.notification.showSuccess(updated.isPinned ? 'Note pinned.' : 'Note unpinned.');
      },
      error: () => this.notification.showError('Failed to update pin.')
    });
  }

  public onPromote(): void {
    const current = this.note();
    const next = this.nextPromoteLevel;
    if (current && next) {
      this.promote.emit({ id: current.id, targetLevel: next });
      this.close.emit();
    }
  }

  public toggleTodo(): void {
    this.editIsTodo.update((v) => !v);
  }

  public onTitleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editTitle.set(input.value);
  }

  /** Escalate quick dialog to full-page editor, preserving quick edits first. */
  public openInFullEditor(): void {
    const current = this.note();
    if (!current) return;
    const returnUrl = this.router.url;
    this.onClose();
    void this.router.navigate(['/notes', current.id], {
      queryParams: { returnUrl },
    });
  }

  public onTagsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editTags.set(input.value);
  }

  public toggleSources(): void {
    this.isSourcesExpanded.update((v) => !v);
  }

  public toggleTags(): void {
    this.isTagsExpanded.update((v) => !v);
  }

  public formatExternalUrl(url?: string | null): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  private extractErrorMessage(err: unknown, defaultMsg: string): string {
    if (!err || typeof err !== 'object') return defaultMsg;
    const httpErr = err as {
      error?: { errors?: Record<string, string[]>; detail?: string; title?: string };
      message?: string;
    };
    if (httpErr.error?.errors && typeof httpErr.error.errors === 'object') {
      const messages = Object.values(httpErr.error.errors)
        .filter((v): v is string[] => Array.isArray(v))
        .flat();
      if (messages.length > 0) {
        return messages.join(' ');
      }
    }
    if (httpErr.error?.detail) {
      return httpErr.error.detail;
    }
    if (httpErr.error?.title) {
      return httpErr.error.title;
    }
    return httpErr.message || defaultMsg;
  }

  public openAddSource(): void {
    this.sourceError.set(null);
    this.isAddingSource.set(true);
  }

  public cancelAddSource(): void {
    this.sourceError.set(null);
    this.isAddingSource.set(false);
    this.isSubmittingSource.set(false);
    this.newCitation.set('');
    this.newUrl.set('');
  }

  public addSource(): void {
    const citation = this.newCitation().trim();
    const rawUrl = this.newUrl().trim();
    const url = rawUrl ? this.formatExternalUrl(rawUrl) : null;
    const current = this.note();
    if (!citation || !current || this.isSubmittingSource()) return;

    this.sourceError.set(null);
    this.isSubmittingSource.set(true);

    this.noteService
      .addSource(current.id, {
        title: citation,
        citation,
        url,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.sources.update((list) => [...list, created]);
          this.cancelAddSource();
          this.notification.showSuccess('Source added');
        },
        error: (err) => {
          this.isSubmittingSource.set(false);
          const msg = this.extractErrorMessage(err, 'Failed to add source.');
          this.sourceError.set(msg);
          this.notification.showError(msg);
        },
      });
  }

  public deleteSource(sourceId: string, event?: Event): void {
    event?.stopPropagation();
    const current = this.note();
    if (!current) return;

    this.noteService
      .deleteSource(current.id, sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sources.update((list) => list.filter((s) => s.id !== sourceId));
          this.notification.showSuccess('Source removed');
        },
        error: (err) => {
          const msg = this.extractErrorMessage(err, 'Failed to remove source.');
          this.notification.showError(msg);
        },
      });
  }
}
