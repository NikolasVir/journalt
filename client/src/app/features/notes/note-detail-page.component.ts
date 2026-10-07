import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LibraryResponse } from '@core/models/library.model';
import { formatTag, NoteLevel, NoteResponse, TagDto } from '@core/models/note.model';
import { SectionDefinition, TypeDefinitionResponse } from '@core/models/type-definition.model';
import { AuthService } from '@core/services/auth.service';
import { LibraryService } from '@core/services/library.service';
import { NoteService } from '@core/services/note.service';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import { TypedTagSelectorComponent } from '@shared/components/typed-tag-selector/typed-tag-selector.component';
import { NoteContentEditorComponent } from '@shared/components/note-content-editor/note-content-editor.component';
import { NoteMetadataViewComponent } from '@shared/components/note-metadata-view/note-metadata-view.component';

interface NoteForm {
  title: FormControl<string>;
  bodyMarkdown: FormControl<string>;
  level: FormControl<NoteLevel>;
  typeId: FormControl<string | null>;
  libraryId: FormControl<string | null>;
  isTodo: FormControl<boolean>;
  typedTags: FormControl<TagDto[]>;
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
    MatChipsModule,
    MatAutocompleteModule,
    TypedTagSelectorComponent,
    NoteContentEditorComponent,
    NoteMetadataViewComponent,
  ],
  templateUrl: './note-detail-page.component.html',
  styleUrl: './note-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteDetailPageComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  private readonly typeService = inject(TypeDefinitionService);
  private readonly libraryService = inject(LibraryService);
  private readonly notification = inject(NotificationService);
  private readonly authService = inject(AuthService);

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly contentEditor = viewChild(NoteContentEditorComponent);

  protected readonly noteId = signal<string | null>(null);
  protected readonly collabUser = computed(() => {
    const user = this.authService.currentUser();
    const name = user?.userName || 'User';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const color = `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
    return { name, color };
  });
  protected readonly currentNote = signal<NoteResponse | null>(null);
  protected readonly isSaving = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly typeValidationWarnings = signal<string[]>([]);
  protected readonly typeDefinitions = signal<TypeDefinitionResponse[]>([]);
  protected readonly libraries = signal<LibraryResponse[]>([]);
  protected readonly legacyTags = signal<TagDto[]>([]);
  protected readonly promotionTarget = signal<NoteLevel | null>(null);
  /**
   * Optional return ticket (e.g. from Explore): after save, cancel, or trash,
   * go back to the exact previous state instead of the dashboard.
   */
  protected readonly returnUrl = signal<string | null>(null);

  protected readonly separatorKeysCodes = [ENTER, COMMA] as const;
  protected readonly freeFormTags = signal<string[]>([]);
  protected readonly tagInputQuery = signal<string>('');
  protected readonly tagSuggestions = signal<string[]>([]);
  protected readonly tagInput = viewChild<ElementRef<HTMLInputElement>>('tagInput');

  protected readonly filteredTagSuggestions = computed(() => {
    const query = this.tagInputQuery().toLowerCase().trim();
    const current = new Set(this.freeFormTags().map((t) => t.toLowerCase()));
    return this.tagSuggestions()
      .filter((tag) => !current.has(tag.toLowerCase()))
      .filter((tag) => !query || tag.toLowerCase().includes(query));
  });

  protected readonly form = new FormGroup<NoteForm>({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    bodyMarkdown: new FormControl('', { nonNullable: true }),
    level: new FormControl<NoteLevel>('Note', { nonNullable: true }),
    typeId: new FormControl<string | null>(null),
    libraryId: new FormControl<string | null>(null),
    isTodo: new FormControl(false, { nonNullable: true }),
    typedTags: new FormControl<TagDto[]>([], { nonNullable: true }),
  });

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const requestedLevel = this.route.snapshot.queryParamMap.get('level') as NoteLevel | null;
    const promoteTo = this.route.snapshot.queryParamMap.get('promoteTo') as NoteLevel | null;
    // Explore links here with the library already chosen, so the note is
    // filed on create instead of landing unfiled.
    const requestedLibraryId = this.route.snapshot.queryParamMap.get('libraryId');

    // Optional return ticket honored on save, cancel, and trash. Only
    // internal paths are accepted, so a crafted URL cannot bounce outward.
    const requestedReturn = this.route.snapshot.queryParamMap.get('returnUrl');
    if (requestedReturn?.startsWith('/')) {
      this.returnUrl.set(requestedReturn);
    }

    this.libraryService.list().subscribe({
      next: (libs) => this.libraries.set(libs),
      error: () => this.libraries.set([])
    });

    this.noteService.getTags().subscribe({
      next: (tags) => this.tagSuggestions.set(tags),
      error: () => this.tagSuggestions.set([]),
    });

    this.typeService.list(false).subscribe({
      next: (types) => {
        this.typeDefinitions.set(types);
        if (
          this.form.controls.level.value === 'Journal' &&
          !this.form.controls.typeId.value &&
          types.length > 0
        ) {
          this.form.controls.typeId.setValue(types[0].id);
        }
      },
    });

    this.form.controls.level.valueChanges.subscribe((lvl) => {
      if (lvl === 'Journal') {
        if (this.freeFormTags().length > 0) {
          this.freeFormTags.set([]);
          this.errorMessage.set(
            'Draft free-form tags were removed. Select registered Journal tags instead.',
          );
        }
        if (!this.form.controls.typeId.value && this.typeDefinitions().length > 0) {
          this.form.controls.typeId.setValue(this.typeDefinitions()[0].id);
        }
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
                sections.map((s) => `${'#'.repeat(s.level || 2)} ${s.heading || s.title}\n\n`).join(''),
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
        this.promotionTarget.set(promoteTo);
        this.form.controls.level.setValue(promoteTo);
      }
    } else {
      if (requestedLevel) {
        this.form.controls.level.setValue(requestedLevel);
      }
      if (requestedLibraryId) {
        this.form.controls.libraryId.setValue(requestedLibraryId);
      }
    }
  }

  public ngAfterViewInit(): void {
    // Writing-first flow: new notes start in Title, existing notes in the editor.
    if (this.noteId()) {
      this.contentEditor()?.focus();
    } else {
      this.titleInput()?.nativeElement.focus();
    }
  }

  /** Ctrl/Cmd+S saves without leaving the keyboard (browser save dialog suppressed). */
  @HostListener('window:keydown', ['$event'])
  protected onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.onSubmit();
    }
  }

  private loadNote(id: string): void {
    this.noteService.getById(id).subscribe({
      next: (note: NoteResponse) => {
        this.currentNote.set(note);
        const tags = note.tags ?? [];
        const typedTags = tags.filter((tag) => tag.tagType === 'Typed');
        const nonTypedTags = tags.filter((tag) => tag.tagType !== 'Typed');
        const isPromotingToJournal = this.promotionTarget() === 'Journal';

        this.form.patchValue({
          title: note.title,
          bodyMarkdown: note.bodyMarkdown,
          level: note.level,
          typeId: note.typeId ?? null,
          libraryId: note.libraryId ?? null,
          isTodo: note.isTodo,
          typedTags,
        });

        if (note.level === 'Note' && !isPromotingToJournal) {
          this.freeFormTags.set(
            tags.map((t) => (t.value ?? '').trim().replace(/^#/, '')).filter(Boolean),
          );
        } else {
          this.freeFormTags.set([]);
        }

        this.typeValidationWarnings.set(note.typeValidationWarnings ?? []);

        if (note.level === 'Journal' || isPromotingToJournal) {
          this.legacyTags.set(nonTypedTags);
          if (nonTypedTags.length > 0) {
            this.errorMessage.set(
              'This note contains legacy free-form tags. Remove them explicitly or replace them with registered Journal tags before saving.',
            );
          }
        } else if (tags.some((tag) => tag.tagType === 'Typed')) {
          this.errorMessage.set(
            'This Note contains legacy typed tags. Replace them with free-form tags before saving.',
          );
        }
      },
      error: () => {
        this.errorMessage.set('Note not found.');
      },
    });
  }

  protected addFreeFormTag(event: MatChipInputEvent): void {
    const value = (event.value || '').replace(/^#/, '').trim();
    if (value && !this.freeFormTags().some((t) => t.toLowerCase() === value.toLowerCase())) {
      this.freeFormTags.update((tags) => [...tags, value]);
    }
    event.chipInput?.clear();
    this.tagInputQuery.set('');
  }

  protected removeFreeFormTag(tagToRemove: string): void {
    this.freeFormTags.update((tags) => tags.filter((t) => t !== tagToRemove));
  }

  protected selectedFreeFormTag(event: MatAutocompleteSelectedEvent): void {
    const rawVal = (event.option.value ?? event.option.viewValue ?? '') as string;
    const tag = rawVal.replace(/^#/, '').trim();
    if (tag && !this.freeFormTags().some((t) => t.toLowerCase() === tag.toLowerCase())) {
      this.freeFormTags.update((tags) => [...tags, tag]);
    }
    const inputEl = this.tagInput()?.nativeElement;
    if (inputEl) {
      inputEl.value = '';
    }
    this.tagInputQuery.set('');
    event.option.deselect();
  }

  public onSubmit(): void {
    if (this.form.invalid || this.isSaving()) return;
    if (this.legacyTags().length > 0) {
      this.errorMessage.set('Resolve the legacy tags before saving this Journal note.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const val = this.form.getRawValue();
    const isJournal = val.level === 'Journal';
    const tags: (TagDto | string)[] = isJournal ? val.typedTags : this.freeFormTags();
    const typeId = isJournal ? val.typeId || undefined : undefined;
    const id = this.noteId();
    const selectedTypeDef =
      isJournal && typeId ? this.typeDefinitions().find((type) => type.id === typeId) : null;

    if (id && this.promotionTarget() === 'Journal') {
      const typedMetadataJson = selectedTypeDef
        ? buildDefaultMetadata(selectedTypeDef.schemaJson)
        : undefined;

      this.noteService
        .promote(id, {
          targetLevel: 'Journal',
          typeId,
          typedMetadataJson,
          tags: val.typedTags,
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.goBack();
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.error?.detail ?? 'Failed to promote note.');
          },
        });
      return;
    }

    if (id) {
      this.noteService
        .update(id, {
          title: val.title,
          bodyMarkdown: val.bodyMarkdown,
          typeId,
          libraryId: val.libraryId,
          isTodo: val.isTodo,
          tags,
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.goBack();
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.error?.detail ?? 'Failed to save note.');
          },
        });
    } else {
      const typedMetadataJson =
        isJournal && selectedTypeDef ? buildDefaultMetadata(selectedTypeDef.schemaJson) : undefined;

      this.noteService
        .create({
          level: val.level,
          title: val.title,
          bodyMarkdown: val.bodyMarkdown,
          typeId,
          libraryId: val.libraryId,
          typedMetadataJson,
          isTodo: val.isTodo,
          tags,
        })
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.goBack();
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSaving.set(false);
            this.errorMessage.set(err.error?.detail ?? 'Failed to create note.');
          },
        });
    }
  }

  /** Leaves the editor: back to the return ticket when present, else home. */
  public goBack(): void {
    const returnUrl = this.returnUrl();
    if (returnUrl) {
      void this.router.navigateByUrl(returnUrl);
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }

  public removeLegacyTags(): void {
    this.legacyTags.set([]);
    this.errorMessage.set(null);
  }

  public onDelete(): void {
    const id = this.noteId();
    if (!id) return;
    const currentReturnUrl = this.returnUrl();

    this.noteService.trash(id).subscribe({
      next: () => {
        this.goBack();
        this.notification.showUndo('Note moved to trash.', () => {
          this.noteService.restore(id).subscribe({
            next: () => {
              void this.router.navigate(['/notes', id], {
                queryParams: currentReturnUrl ? { returnUrl: currentReturnUrl } : undefined,
              });
              this.notification.showSuccess('Note restored.');
            },
            error: () => {
              this.notification.showError('Failed to restore note.');
            },
          });
        });
      },
      error: () => {
        this.notification.showError('Failed to move note to trash.');
      },
    });
  }
}
