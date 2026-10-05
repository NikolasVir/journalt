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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { formatTag, NoteResponse } from '@core/models/note.model';
import { MarkdownEnhancerService } from '@core/services/markdown-enhancer.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import { NoteEditButtonComponent } from '@shared/components/note-edit-button/note-edit-button.component';
import { NoteMetadataViewComponent } from '@shared/components/note-metadata-view/note-metadata-view.component';

/**
 * Right pane of Explore. Renders a note read-only and intercepts wiki-links so
 * following a link swaps the preview in place instead of leaving the wiki.
 */
@Component({
  selector: 'app-explore-note-viewer',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatButtonModule, NoteEditButtonComponent, NoteMetadataViewComponent],
  templateUrl: './explore-note-viewer.component.html',
  styleUrl: './explore-note-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreNoteViewerComponent {
  private readonly markdownEnhancer = inject(MarkdownEnhancerService);
  private readonly typeService = inject(TypeDefinitionService);

  public readonly note = input<NoteResponse | null>(null);
  public readonly isLoading = input.required<boolean>();

  public readonly noteSelected = output<string>();
  public readonly editRequested = output<string>();
  public readonly backToTreeRequested = output<void>();

  private readonly bodyRef = viewChild<ElementRef<HTMLElement>>('bodyRef');

  /** Type names by id, so the header can name the type instead of a bare "Typed". */
  private readonly typeNames = signal<Record<string, string>>({});

  protected readonly tagCount = computed(() => this.note()?.tags?.length ?? 0);
  protected readonly outbound = computed(() => this.note()?.outboundRelations ?? []);
  protected readonly backlinks = computed(() => this.note()?.backlinks ?? []);
  protected readonly sources = computed(() => this.note()?.sources ?? []);
  protected readonly unresolved = computed(() => this.note()?.unresolvedWikiLinks ?? []);

  /** Human label for the note's type, e.g. "Concept v2". Null while loading. */
  protected readonly typeLabel = computed(() => {
    const typeId = this.note()?.typeId;
    if (!typeId) return null;
    return this.typeNames()[typeId] ?? null;
  });

  public constructor() {
    effect(() => {
      const container = this.bodyRef()?.nativeElement;
      if (container) {
        void this.markdownEnhancer.enhance(container);
      }
    });

    // Resolve the type name once per id; Journal notes always carry a typeId.
    toObservable(this.note)
      .pipe(
        map((n) => n?.typeId),
        filter((typeId): typeId is string => !!typeId && !this.typeNames()[typeId]),
        switchMap((typeId) =>
          this.typeService.getById(typeId).pipe(
            map((type) => ({ typeId, name: type.name })),
            catchError(() => of({ typeId, name: 'Typed' }))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ typeId, name }) => {
        this.typeNames.update((names) => ({
          ...names,
          [typeId]: name,
        }));
      });
  }

  public formatTagValue(tag: Parameters<typeof formatTag>[0]): string {
    return formatTag(tag);
  }

  /**
   * Wiki-links render as `/notes/{id}` anchors. Unresolved links render as
   * spans, so only real anchors are intercepted.
   */
  public onBodyClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    const match = /^\/notes\/([0-9a-fA-F-]{36})/.exec(anchor.getAttribute('href') ?? '');
    if (!match) return;
    event.preventDefault();
    this.noteSelected.emit(match[1]);
  }
}
