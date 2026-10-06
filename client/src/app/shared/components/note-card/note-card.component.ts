import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatTag, NoteLevel, NoteResponse, TagDto } from '@core/models/note.model';
import { NoteEditButtonComponent } from '@shared/components/note-edit-button/note-edit-button.component';

@Component({
  selector: 'app-note-card',
  standalone: true,
  imports: [MatCardModule, MatChipsModule, MatButtonModule, MatIconModule, MatTooltipModule, NoteEditButtonComponent],
  templateUrl: './note-card.component.html',
  styleUrl: './note-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoteCardComponent {
  public readonly note = input.required<NoteResponse>();

  protected readonly tooltipText = computed<string>(() => {
    const n = this.note();
    const createdDate = new Date(n.createdAtUtc);
    const updatedDate = new Date(n.updatedAtUtc);
    const createdStr = Number.isNaN(createdDate.getTime()) ? '' : createdDate.toLocaleString();
    const updatedStr = Number.isNaN(updatedDate.getTime()) ? '' : updatedDate.toLocaleString();
    return `Created: ${createdStr}${updatedStr ? '\nModified: ' + updatedStr : ''}`;
  });

  public readonly cardClick = output<NoteResponse>();
  public readonly tagClick = output<string>();
  public readonly toggleTodo = output<NoteResponse>();
  public readonly trashNote = output<NoteResponse>();
  public readonly promoteNote = output<{ note: NoteResponse; targetLevel: NoteLevel }>();
  public readonly editRequested = output<NoteResponse>();

  protected readonly formatTag = formatTag;

  public onTagClick(event: Event, tag: TagDto): void {
    event.stopPropagation();
    this.tagClick.emit(formatTag(tag));
  }

  protected readonly nextPromoteLevel = computed<NoteLevel | null>(() => {
    const level = this.note().level;
    if (level === 'Inbox') return 'Quick';
    if (level === 'Quick') return 'Journal';
    return null;
  });

  public onCardClick(): void {
    this.cardClick.emit(this.note());
  }

  public onEdit(): void {
    this.editRequested.emit(this.note());
  }

  public onToggleTodo(event: Event): void {
    event.stopPropagation();
    this.toggleTodo.emit(this.note());
  }

  public onTrash(event: Event): void {
    event.stopPropagation();
    this.trashNote.emit(this.note());
  }

  public onPromote(event: Event): void {
    event.stopPropagation();
    const nextLevel = this.nextPromoteLevel();
    if (nextLevel) {
      this.promoteNote.emit({ note: this.note(), targetLevel: nextLevel });
    }
  }
}
