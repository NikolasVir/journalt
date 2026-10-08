import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { LibraryResponse } from '@core/models/library.model';
import { NoteFormat, NoteLevel, TagDto } from '@core/models/note.model';
import { SectionDefinition, TypeDefinitionResponse } from '@core/models/type-definition.model';
import { LibraryService } from '@core/services/library.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import { TypedTagSelectorComponent } from '@shared/components/typed-tag-selector/typed-tag-selector.component';
import { NoteContentEditorComponent } from '@shared/components/note-content-editor/note-content-editor.component';
import { ChecklistEditorComponent } from '@shared/components/checklist-editor/checklist-editor.component';

export interface QuickCapturePayload {
  title: string;
  bodyMarkdown: string;
  level: NoteLevel;
  format?: NoteFormat;
  isTodo: boolean;
  libraryId?: string | null;
  typeId?: string;
  typedMetadataJson?: string;
  tags?: (TagDto | string)[];
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
  selector: 'app-quick-capture',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatTooltipModule,
    TypedTagSelectorComponent,
    NoteContentEditorComponent,
    ChecklistEditorComponent,
  ],
  templateUrl: './quick-capture.component.html',
  styleUrl: './quick-capture.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickCaptureComponent implements OnInit {
  private readonly typeService = inject(TypeDefinitionService);
  private readonly libraryService = inject(LibraryService);

  public readonly defaultLevel = input<NoteLevel>('Note');
  public readonly createNote = output<QuickCapturePayload>();

  protected readonly isExpanded = signal<boolean>(false);
  protected readonly selectedLevel = signal<NoteLevel>('Note');
  protected readonly selectedFormat = signal<NoteFormat>('Markdown');
  protected readonly title = signal<string>('');
  protected readonly bodyMarkdown = signal<string>('');
  protected readonly isTodo = signal<boolean>(false);
  protected readonly tagsInput = signal<string>('');
  protected readonly typedTags = signal<TagDto[]>([]);
  protected readonly libraries = signal<LibraryResponse[]>([]);
  protected readonly selectedLibraryId = signal<string | null>(null);
  protected readonly selectedLibraryName = computed(() => {
    const libId = this.selectedLibraryId();
    if (!libId) return 'Unfiled';
    const found = this.libraries().find((l) => l.id === libId);
    return found ? found.name : 'Unfiled';
  });
  protected readonly typeDefinitions = signal<TypeDefinitionResponse[]>([]);
  protected readonly selectedTypeId = signal<string | null>(null);

  private pointerDownOnBackdrop = false;

  constructor() {
    effect(() => {
      const def = this.defaultLevel();
      this.selectedLevel.set(def);
      if (def === 'Journal') {
        this.ensureDefaultTypeSelected();
      }
    });
  }

  public ngOnInit(): void {
    this.typeService.list(false).subscribe({
      next: (types) => {
        this.typeDefinitions.set(types);
        if (this.selectedLevel() === 'Journal') {
          this.ensureDefaultTypeSelected();
        }
      },
    });

    this.libraryService.list().subscribe({
      next: (libs) => this.libraries.set(libs),
      error: () => this.libraries.set([]),
    });
  }

  public expand(level?: NoteLevel): void {
    this.selectedFormat.set('Markdown');
    if (level) {
      this.selectedLevel.set(level);
      if (level === 'Journal') {
        this.ensureDefaultTypeSelected();
      }
    }
    this.isExpanded.set(true);
  }

  public expandList(): void {
    this.selectedFormat.set('List');
    this.selectedLevel.set('Note');
    this.isExpanded.set(true);
  }

  public collapse(): void {
    this.isExpanded.set(false);
    this.resetFields();
  }

  public onBackdropPointerDown(event: PointerEvent): void {
    this.pointerDownOnBackdrop = event.target === event.currentTarget;
  }

  public onBackdropPointerCancel(): void {
    this.pointerDownOnBackdrop = false;
  }

  public onBackdropClick(event: MouseEvent): void {
    const shouldClose = this.pointerDownOnBackdrop && event.target === event.currentTarget;
    this.pointerDownOnBackdrop = false;

    if (shouldClose) {
      this.submit();
    }
  }

  public setFormat(format: NoteFormat): void {
    this.selectedFormat.set(format);
    if (format === 'List' && this.selectedLevel() !== 'Note') {
      this.selectedLevel.set('Note');
    }
  }

  public selectLevel(level: NoteLevel): void {
    this.selectedLevel.set(level);
    if (level !== 'Note') {
      this.selectedFormat.set('Markdown');
    }
    if (level === 'Journal') {
      this.tagsInput.set('');
      this.ensureDefaultTypeSelected();
    }
  }

  public onTypeChange(typeId: string): void {
    this.selectedTypeId.set(typeId);
    this.scaffoldSectionsForType(typeId);
  }

  public submit(): void {
    const body = this.bodyMarkdown().trim();
    const title = this.title().trim();

    if (!body && !title) {
      this.collapse();
      return;
    }

    const isJournal = this.selectedLevel() === 'Journal';
    const tags: (TagDto | string)[] = isJournal
      ? this.typedTags()
      : this.tagsInput()
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
    const typeId = isJournal ? (this.selectedTypeId() ?? undefined) : undefined;
    const selectedTypeDef =
      isJournal && typeId ? this.typeDefinitions().find((t) => t.id === typeId) : null;
    const typedMetadataJson =
      isJournal && selectedTypeDef ? buildDefaultMetadata(selectedTypeDef.schemaJson) : undefined;

    this.createNote.emit({
      title: title || body.slice(0, 30) + '...',
      bodyMarkdown: body,
      level: this.selectedLevel(),
      format: this.selectedFormat(),
      isTodo: this.isTodo(),
      libraryId: this.selectedLibraryId() ?? undefined,
      typeId,
      typedMetadataJson,
      tags: tags.length > 0 ? tags : undefined,
    });

    this.collapse();
  }

  private ensureDefaultTypeSelected(): void {
    if (!this.selectedTypeId() && this.typeDefinitions().length > 0) {
      const firstType = this.typeDefinitions()[0];
      this.selectedTypeId.set(firstType.id);
      this.scaffoldSectionsForType(firstType.id);
    }
  }

  private scaffoldSectionsForType(typeId: string): void {
    const typeDef = this.typeDefinitions().find((t) => t.id === typeId);
    if (typeDef?.sectionsJson && !this.bodyMarkdown().trim()) {
      try {
        const sections = JSON.parse(typeDef.sectionsJson) as SectionDefinition[];
        if (Array.isArray(sections) && sections.length > 0) {
          const template = sections.map((s) => `${'#'.repeat(s.level || 2)} ${s.heading || s.title}\n\n`).join('');
          this.bodyMarkdown.set(template);
        }
      } catch {
        // Ignore json parse errors for template scaffolding
      }
    }
  }

  private resetFields(): void {
    this.title.set('');
    this.bodyMarkdown.set('');
    this.isTodo.set(false);
    this.tagsInput.set('');
    this.typedTags.set([]);
    this.selectedLibraryId.set(null);
    this.selectedLevel.set(this.defaultLevel());
    this.selectedFormat.set('Markdown');
    if (this.defaultLevel() === 'Journal') {
      this.ensureDefaultTypeSelected();
    }
  }
}
