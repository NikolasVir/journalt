import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formatTag, NoteLevel, NoteResponse } from '@core/models/note.model';
import { SectionDefinition, TypeDefinitionResponse } from '@core/models/type-definition.model';
import { NoteService } from '@core/services/note.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';

interface NoteForm {
  title: FormControl<string>;
  bodyMarkdown: FormControl<string>;
  level: FormControl<NoteLevel>;
  typeId: FormControl<string | null>;
  isTodo: FormControl<boolean>;
  tagsInput: FormControl<string>;
}

function buildDefaultMetadata(schemaJson?: string | null): string {
  if (!schemaJson) return '{}';
  try {
    const schema = JSON.parse(schemaJson) as { properties?: Record<string, { type?: string }> };
    if (!schema || typeof schema !== 'object' || !schema.properties) return '{}';
    const metadata: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      const type = prop?.type;
      if (type === 'string') metadata[key] = '';
      else if (type === 'number' || type === 'integer') metadata[key] = 0;
      else if (type === 'boolean') metadata[key] = false;
      else if (type === 'array') metadata[key] = [];
      else if (type === 'object') metadata[key] = {};
      else metadata[key] = null;
    }
    return JSON.stringify(metadata);
  } catch {
    return '{}';
  }
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
    MatSelectModule,
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
  private readonly typeService = inject(TypeDefinitionService);

  protected readonly noteId = signal<string | null>(null);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly typeDefinitions = signal<TypeDefinitionResponse[]>([]);

  protected readonly form = new FormGroup<NoteForm>({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    bodyMarkdown: new FormControl('', { nonNullable: true }),
    level: new FormControl<NoteLevel>('Quick', { nonNullable: true }),
    typeId: new FormControl<string | null>(null),
    isTodo: new FormControl(false, { nonNullable: true }),
    tagsInput: new FormControl('', { nonNullable: true })
  });

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const requestedLevel = this.route.snapshot.queryParamMap.get('level') as NoteLevel | null;
    const promoteTo = this.route.snapshot.queryParamMap.get('promoteTo') as NoteLevel | null;

    this.typeService.list(false).subscribe({
      next: (types) => {
        this.typeDefinitions.set(types);
        if (this.form.controls.level.value === 'Journal' && !this.form.controls.typeId.value && types.length > 0) {
          this.form.controls.typeId.setValue(types[0].id);
        }
      }
    });

    this.form.controls.level.valueChanges.subscribe((lvl) => {
      if (lvl === 'Journal' && !this.form.controls.typeId.value && this.typeDefinitions().length > 0) {
        this.form.controls.typeId.setValue(this.typeDefinitions()[0].id);
      }
    });

    this.form.controls.typeId.valueChanges.subscribe((typeId) => {
      if (typeId && !this.form.controls.bodyMarkdown.value.trim()) {
        const selected = this.typeDefinitions().find((t) => t.id === typeId);
        if (selected?.sectionsJson) {
          try {
            const sections = JSON.parse(selected.sectionsJson) as SectionDefinition[];
            if (Array.isArray(sections) && sections.length > 0) {
              this.form.controls.bodyMarkdown.setValue(
                sections.map((s) => `## ${s.title}\n\n`).join('')
              );
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    });

    if (id && id !== 'new') {
      this.noteId.set(id);
      this.loadNote(id);
      if (promoteTo) {
        this.form.controls.level.setValue(promoteTo);
      }
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
          typeId: note.typeId ?? null,
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

    const isJournal = val.level === 'Journal';
    const typeId = isJournal ? (val.typeId || undefined) : undefined;
    const id = this.noteId();

    if (id) {
      this.noteService
        .update(id, {
          title: val.title,
          bodyMarkdown: val.bodyMarkdown,
          typeId,
          isTodo: val.isTodo,
          tags
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            void this.router.navigate(['/dashboard']);
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.error?.detail ?? 'Failed to save note.');
          }
        });
    } else {
      const selectedTypeDef = isJournal && typeId ? this.typeDefinitions().find((t) => t.id === typeId) : null;
      const typedMetadataJson = isJournal && selectedTypeDef ? buildDefaultMetadata(selectedTypeDef.schemaJson) : undefined;

      this.noteService
        .create({
          level: val.level,
          title: val.title,
          bodyMarkdown: val.bodyMarkdown,
          typeId,
          typedMetadataJson,
          isTodo: val.isTodo,
          tags
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            void this.router.navigate(['/dashboard']);
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.error?.detail ?? 'Failed to create note.');
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
