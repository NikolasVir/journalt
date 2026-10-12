import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NoteLevel } from '@core/models/note.model';
import { DecryptedVaultNote } from '@core/models/vault.model';

export interface VaultNoteDialogData {
  note?: DecryptedVaultNote;
  /** Level preselected for new notes. */
  defaultLevel?: NoteLevel;
}

export interface VaultNoteDialogResult {
  title: string;
  bodyMarkdown: string;
  tags: string[];
  isPinned: boolean;
  level: NoteLevel;
  isTodo: boolean;
}

@Component({
  selector: 'app-vault-note-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule
  ],
  templateUrl: './vault-note-dialog.component.html',
  styleUrl: './vault-note-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VaultNoteDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<VaultNoteDialogComponent>);
  public readonly data: VaultNoteDialogData = inject(MAT_DIALOG_DATA) || {};

  public readonly isEdit = !!this.data.note;
  public readonly title = signal<string>(this.data.note?.title ?? '');
  public readonly bodyMarkdown = signal<string>(this.data.note?.bodyMarkdown ?? '');
  public readonly tagsString = signal<string>(this.data.note?.tags?.join(', ') ?? '');
  public readonly isPinned = signal<boolean>(this.data.note?.isPinned ?? false);
  public readonly level = signal<NoteLevel>(this.data.note?.level ?? this.data.defaultLevel ?? 'Inbox');
  public readonly isTodo = signal<boolean>(this.data.note?.isTodo ?? false);
  public readonly levels: NoteLevel[] = ['Inbox', 'Note', 'Journal'];

  public togglePin(): void {
    this.isPinned.update((v) => !v);
  }

  public onSave(): void {
    const rawTitle = this.title().trim();
    if (!rawTitle) return;

    const tags = this.tagsString()
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);

    const result: VaultNoteDialogResult = {
      title: rawTitle,
      bodyMarkdown: this.bodyMarkdown(),
      tags,
      isPinned: this.isPinned(),
      level: this.level(),
      isTodo: this.isTodo()
    };

    this.dialogRef.close(result);
  }

  public onCancel(): void {
    this.dialogRef.close();
  }
}
