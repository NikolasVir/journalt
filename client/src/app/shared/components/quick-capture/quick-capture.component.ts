import { ChangeDetectionStrategy, Component, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { NoteLevel } from '@core/models/note.model';
import { SectionDefinition, TypeDefinitionResponse } from '@core/models/type-definition.model';
import { TypeDefinitionService } from '@core/services/type-definition.service';

export interface QuickCapturePayload {
  title: string;
  bodyMarkdown: string;
  level: NoteLevel;
  typeId?: string;
  typedMetadataJson?: string;
  tags?: string[];
}

@Component({
  selector: 'app-quick-capture',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule
  ],
  templateUrl: './quick-capture.component.html',
  styleUrl: './quick-capture.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickCaptureComponent implements OnInit {
  private readonly typeService = inject(TypeDefinitionService);

  public readonly defaultLevel = input<NoteLevel>('Quick');
  public readonly createNote = output<QuickCapturePayload>();

  protected readonly isExpanded = signal<boolean>(false);
  protected readonly selectedLevel = signal<NoteLevel>('Quick');
  protected readonly title = signal<string>('');
  protected readonly bodyMarkdown = signal<string>('');
  protected readonly tagsInput = signal<string>('');
  protected readonly typeDefinitions = signal<TypeDefinitionResponse[]>([]);
  protected readonly selectedTypeId = signal<string | null>(null);

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
      }
    });
  }

  public expand(level?: NoteLevel): void {
    if (level) {
      this.selectedLevel.set(level);
      if (level === 'Journal') {
        this.ensureDefaultTypeSelected();
      }
    }
    this.isExpanded.set(true);
  }

  public collapse(): void {
    this.isExpanded.set(false);
    this.resetFields();
  }

  public selectLevel(level: NoteLevel): void {
    this.selectedLevel.set(level);
    if (level === 'Journal') {
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

    const tags = this.tagsInput()
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const isJournal = this.selectedLevel() === 'Journal';
    const typeId = isJournal ? (this.selectedTypeId() ?? undefined) : undefined;

    this.createNote.emit({
      title: title || (body.slice(0, 30) + '...'),
      bodyMarkdown: body,
      level: this.selectedLevel(),
      typeId,
      tags: tags.length > 0 ? tags : undefined
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
          const template = sections.map((s) => `## ${s.title}\n\n`).join('');
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
    this.tagsInput.set('');
    this.selectedLevel.set(this.defaultLevel());
    if (this.defaultLevel() === 'Journal') {
      this.ensureDefaultTypeSelected();
    }
  }
}
