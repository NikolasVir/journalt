import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';

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
  public readonly note = input<NoteResponse | null>(null);

  public readonly close = output<void>();
  public readonly save = output<NoteDialogSavePayload>();
  public readonly trash = output<string>();
  public readonly promote = output<{ id: string; targetLevel: NoteLevel }>();

  protected readonly editTitle = signal<string>('');
  protected readonly editBody = signal<string>('');
  protected readonly editTags = signal<string>('');
  protected readonly editIsTodo = signal<boolean>(false);

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
      }
    });
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
