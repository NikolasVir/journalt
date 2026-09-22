import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';

interface NoteForm {
  title: FormControl<string>;
  bodyMarkdown: FormControl<string>;
  level: FormControl<NoteLevel>;
  isTodo: FormControl<boolean>;
  tagsInput: FormControl<string>;
}

@Component({
  selector: 'app-note-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './note-detail-page.component.html',
  styleUrl: './note-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoteDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);

  protected readonly noteId = signal<string | null>(null);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup<NoteForm>({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    bodyMarkdown: new FormControl('', { nonNullable: true }),
    level: new FormControl<NoteLevel>('Quick', { nonNullable: true }),
    isTodo: new FormControl(false, { nonNullable: true }),
    tagsInput: new FormControl('', { nonNullable: true })
  });

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const requestedLevel = this.route.snapshot.queryParamMap.get('level') as NoteLevel | null;

    if (id && id !== 'new') {
      this.noteId.set(id);
      this.loadNote(id);
    } else if (requestedLevel) {
      this.form.controls.level.setValue(requestedLevel);
    }
  }

  private loadNote(id: string): void {
    this.noteService.getById(id).subscribe({
      next: (note: NoteResponse) => {
        this.form.patchValue({
          title: note.title,
          bodyMarkdown: note.bodyMarkdown,
          level: note.level,
          isTodo: note.isTodo,
          tagsInput: (note.tags ?? []).map(formatTag).filter(Boolean).join(', ')
        });
      },
      error: () => {
        this.errorMessage.set('Note not found.');
      }
    });
  }

  public onSubmit(): void {
    if (this.form.invalid || this.isSaving()) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const val = this.form.getRawValue();
    const tags = val.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const id = this.noteId();

    if (id) {
      this.noteService
        .update(id, {
          title: val.title,
          bodyMarkdown: val.bodyMarkdown,
          isTodo: val.isTodo,
          tags
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            void this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.isSaving.set(false);
            this.errorMessage.set('Failed to save note.');
          }
        });
    } else {
      this.noteService
        .create({
          level: val.level,
          title: val.title,
          bodyMarkdown: val.bodyMarkdown,
          isTodo: val.isTodo,
          tags
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            void this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.isSaving.set(false);
            this.errorMessage.set('Failed to create note.');
          }
        });
    }
  }

  public onDelete(): void {
    const id = this.noteId();
    if (!id) return;

    this.noteService.trash(id).subscribe({
      next: () => {
        void this.router.navigate(['/dashboard']);
      }
    });
  }
}
