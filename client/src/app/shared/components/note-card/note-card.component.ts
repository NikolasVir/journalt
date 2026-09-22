import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';

@Component({
  selector: 'app-note-card',
  standalone: true,
  imports: [MatCardModule, MatChipsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './note-card.component.html',
  styleUrl: './note-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoteCardComponent {
  public readonly note = input.required<NoteResponse>();

  public readonly cardClick = output<NoteResponse>();
  public readonly toggleTodo = output<NoteResponse>();
  public readonly trashNote = output<NoteResponse>();
  public readonly promoteNote = output<{ note: NoteResponse; targetLevel: NoteLevel }>();

  protected readonly formatTag = formatTag;

  protected readonly nextPromoteLevel = computed<NoteLevel | null>(() => {
    const level = this.note().level;
    if (level === 'Inbox') return 'Quick';
    if (level === 'Quick') return 'Journal';
    return null;
  });

  public onCardClick(): void {
    this.cardClick.emit(this.note());
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
