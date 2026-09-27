import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { NoteContentEditorComponent } from '@shared/components/note-content-editor/note-content-editor.component';
import { NoteEditButtonComponent } from '@shared/components/note-edit-button/note-edit-button.component';

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
    TypedTagSelectorComponent,
    NoteContentEditorComponent,
    NoteEditButtonComponent,
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

  public readonly note = input<NoteResponse | null>(null);

  public readonly close = output<void>();
  public readonly save = output<NoteDialogSavePayload>();
  public readonly trash = output<string>();
  public readonly promote = output<{ id: string; targetLevel: NoteLevel }>();

  protected readonly renderedContainer = viewChild<ElementRef<HTMLElement>>('renderedContainer');

  protected readonly editTitle = signal<string>('');
  protected readonly editBody = signal<string>('');
  protected readonly editTags = signal<string>('');
  protected readonly editTypedTags = signal<TagDto[]>([]);
  protected readonly legacyTags = signal<TagDto[]>([]);
  protected readonly isTagsExpanded = signal<boolean>(false);
  protected readonly tagCount = computed(() => {
    const current = this.note();
    if (!current) return 0;
    if (current.level === 'Journal') {
      return this.editTypedTags().length;
    }
    if (current.level === 'Quick') {
      const raw = this.editTags() ?? '';
      return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean).length;
    }
    return 0;
  });
  protected readonly editIsTodo = signal<boolean>(false);
  protected readonly editLibraryId = signal<string | null>(null);
  protected readonly libraries = signal<LibraryResponse[]>([]);
  protected readonly selectedLibraryName = computed(() => {
    const libId = this.editLibraryId();
    if (!libId) return 'Unfiled';
    const found = this.libraries().find((l) => l.id === libId);
    return found ? found.name : 'Unfiled';
  });
  protected readonly sources = signal<NoteSourceResponse[]>([]);
  protected readonly isSourcesExpanded = signal<boolean>(false);
  protected readonly newCitation = signal<string>('');
  protected readonly newUrl = signal<string>('');
  protected readonly isAddingSource = signal<boolean>(false);
  protected readonly isSubmittingSource = signal<boolean>(false);
  protected readonly sourceError = signal<string | null>(null);
  protected readonly viewMode = signal<'rendered' | 'markdown'>('rendered');
  protected readonly renderedHtml = signal<string>('');

  private lastRenderedBody = '';
  private pointerDownOnBackdrop = false;

  constructor() {
    this.libraryService.list().subscribe({
      next: (libs) => this.libraries.set(libs),
      error: () => this.libraries.set([])
    });

    effect(() => {
      const current = this.note();
      if (current) {
        this.editTitle.set(current.title ?? '');
        this.editBody.set(current.bodyMarkdown ?? '');
        this.editLibraryId.set(current.libraryId ?? null);
        const tags = current.tags ?? [];
        const typedTags = tags.filter((tag) => tag.tagType === 'Typed');
        const nonTypedTags = tags.filter((tag) => tag.tagType !== 'Typed');
        this.editTags.set(
          current.level === 'Quick' ? tags.map(formatTag).filter(Boolean).join(', ') : '',
        );
        this.editTypedTags.set(current.level === 'Journal' ? typedTags : []);
        this.legacyTags.set(current.level === 'Journal' ? nonTypedTags : []);
        this.editIsTodo.set(current.isTodo ?? false);

        if (current.level === 'Journal' && nonTypedTags.length > 0) {
          this.isTagsExpanded.set(true);
        } else {
          this.isTagsExpanded.set(false);
        }

        this.noteService.getSources(current.id).subscribe({
          next: (s) => this.sources.set(s ?? []),
          error: () => this.sources.set([]),
        });
        this.isAddingSource.set(false);
        this.newCitation.set('');
        this.newUrl.set('');

        const html = current.renderedHtml ?? '';
        this.renderedHtml.set(html);
        this.lastRenderedBody = current.bodyMarkdown ?? '';

        if (!current.bodyMarkdown?.trim()) {
          this.viewMode.set('markdown');
        } else {
          this.viewMode.set('rendered');
        }
      }
    });

    effect(() => {
      const containerRef = this.renderedContainer();
      const html = this.renderedHtml();
      const mode = this.viewMode();
      if (mode === 'rendered' && containerRef?.nativeElement && html) {
        setTimeout(() => {
          if (containerRef.nativeElement) {
            void this.markdownEnhancer.enhance(containerRef.nativeElement);
          }
        }, 0);
      }
    });
  }

  public setViewMode(mode: 'rendered' | 'markdown'): void {
    if (mode === 'rendered' && this.viewMode() !== 'rendered') {
      const currentBody = this.editBody().trim();
      if (currentBody !== this.lastRenderedBody.trim()) {
        if (!currentBody) {
          this.renderedHtml.set('');
          this.lastRenderedBody = '';
        } else {
          this.noteService.renderPreview(currentBody).subscribe({
            next: (res) => {
              this.renderedHtml.set(res.renderedHtml);
              this.lastRenderedBody = currentBody;
            },
            error: () => {
              // fallback: keep existing renderedHtml
            },
          });
        }
      }
    }
    this.viewMode.set(mode);
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
    const level = this.note()?.level;
    if (level === 'Inbox') return 'Quick';
    if (level === 'Quick') return 'Journal';
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
      this.trash.emit(current.id);
      this.close.emit();
    }
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

  public onBodyChange(next: string): void {
    this.editBody.set(next ?? '');
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

    this.noteService.deleteSource(current.id, sourceId).subscribe({
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
