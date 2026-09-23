import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { MarkdownEnhancerService } from '@core/services/markdown-enhancer.service';
import { NoteService } from '@core/services/note.service';

export interface NoteDialogSavePayload {
  id: string;
  title: string;
  bodyMarkdown: string;
  isTodo: boolean;
  tags: string[];
}

@Component({
  selector: 'app-note-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './note-dialog.component.html',
  styleUrl: './note-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoteDialogComponent {
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  private readonly markdownEnhancer = inject(MarkdownEnhancerService);

  public readonly note = input<NoteResponse | null>(null);

  public readonly close = output<void>();
  public readonly save = output<NoteDialogSavePayload>();
  public readonly trash = output<string>();
  public readonly promote = output<{ id: string; targetLevel: NoteLevel }>();

  protected readonly renderedContainer = viewChild<ElementRef<HTMLElement>>('renderedContainer');

  protected readonly editTitle = signal<string>('');
  protected readonly editBody = signal<string>('');
  protected readonly editTags = signal<string>('');
  protected readonly editIsTodo = signal<boolean>(false);
  protected readonly viewMode = signal<'rendered' | 'markdown'>('rendered');
  protected readonly renderedHtml = signal<string>('');

  private lastRenderedBody = '';

  constructor() {
    effect(() => {
      const current = this.note();
      if (current) {
        this.editTitle.set(current.title ?? '');
        this.editBody.set(current.bodyMarkdown ?? '');
        this.editTags.set(
          (current.tags ?? []).map(formatTag).filter(Boolean).join(', ')
        );
        this.editIsTodo.set(current.isTodo ?? false);

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
            }
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
      const tags = (this.editTags() ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      this.save.emit({
        id: current.id,
        title: (this.editTitle() ?? '').trim() || current.title,
        bodyMarkdown: (this.editBody() ?? '').trim(),
        isTodo: this.editIsTodo(),
        tags
      });
    }
    this.close.emit();
  }

  public onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
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

  public onBodyInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.editBody.set(textarea.value);
  }

  public onTagsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editTags.set(input.value);
  }
}
