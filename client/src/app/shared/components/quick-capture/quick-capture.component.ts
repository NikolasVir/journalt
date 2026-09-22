import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { NoteLevel } from '@core/models/note.model';

export interface QuickCapturePayload {
  title: string;
  bodyMarkdown: string;
  level: NoteLevel;
  tags?: string[];
}

@Component({
  selector: 'app-quick-capture',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule
  ],
  templateUrl: './quick-capture.component.html',
  styleUrl: './quick-capture.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickCaptureComponent {
  public readonly defaultLevel = input<NoteLevel>('Quick');
  public readonly createNote = output<QuickCapturePayload>();

  protected readonly isExpanded = signal<boolean>(false);
  protected readonly selectedLevel = signal<NoteLevel>('Quick');
  protected readonly title = signal<string>('');
  protected readonly bodyMarkdown = signal<string>('');
  protected readonly tagsInput = signal<string>('');

  constructor() {
    effect(() => {
      this.selectedLevel.set(this.defaultLevel());
    });
  }

  public expand(level?: NoteLevel): void {
    if (level) {
      this.selectedLevel.set(level);
    }
    this.isExpanded.set(true);
  }

  public collapse(): void {
    this.isExpanded.set(false);
    this.resetFields();
  }

  public selectLevel(level: NoteLevel): void {
    this.selectedLevel.set(level);
  }

  public submit(): void {
    const body = this.bodyMarkdown().trim();
    const title = this.title().trim();

    if (!body && !title) {
      this.collapse();
      return;
    }

    const tags = this.tagsInput()
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    this.createNote.emit({
      title: title || (body.slice(0, 30) + '...'),
      bodyMarkdown: body,
      level: this.selectedLevel(),
      tags: tags.length > 0 ? tags : undefined
    });

    this.collapse();
  }

  private resetFields(): void {
    this.title.set('');
    this.bodyMarkdown.set('');
    this.tagsInput.set('');
    this.selectedLevel.set(this.defaultLevel());
  }
}
