import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TypeDefinitionResponse } from '@core/models/type-definition.model';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';

export interface MetadataFieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
}

export interface SectionFieldDef {
  heading: string;
  level: number;
  required: boolean;
  allowMultiple: boolean;
}

export function parseSchemaFields(schemaJson?: string | null): MetadataFieldDef[] {
  if (!schemaJson) return [];
  try {
    const parsed = JSON.parse(schemaJson);
    if (!parsed || typeof parsed !== 'object' || !parsed.properties) return [];
    const req: string[] = Array.isArray(parsed.required) ? parsed.required : [];
    const validTypes: MetadataFieldDef['type'][] = ['string', 'number', 'boolean', 'array'];
    return Object.entries(parsed.properties).map(([name, conf]) => {
      const prop = conf as { type?: string };
      const fieldType = validTypes.includes(prop?.type as MetadataFieldDef['type'])
        ? (prop.type as MetadataFieldDef['type'])
        : 'string';
      return {
        name,
        type: fieldType,
        required: req.includes(name),
      };
    });
  } catch {
    return [];
  }
}

export function buildSchemaJson(fields: MetadataFieldDef[]): string {
  const properties: Record<string, { type: string }> = {};
  const required: string[] = [];

  for (const f of fields) {
    const key = f.name.trim();
    if (!key) continue;
    properties[key] = { type: f.type };
    if (f.required) {
      required.push(key);
    }
  }

  const obj: Record<string, unknown> = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) {
    obj['required'] = required;
  }
  return JSON.stringify(obj, null, 2);
}

export function parseSections(sectionsJson?: string | null): SectionFieldDef[] {
  if (!sectionsJson) return [];
  try {
    const parsed = JSON.parse(sectionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        heading: (item.heading || item.title || '').trim(),
        level: typeof item.level === 'number' && item.level >= 1 && item.level <= 6 ? item.level : 2,
        required: item.required ?? true,
        allowMultiple: item.allowMultiple ?? item.repeatable ?? false,
      }))
      .filter((s) => s.heading.length > 0);
  } catch {
    return [];
  }
}

export function buildSectionsJson(sections: SectionFieldDef[]): string | null {
  const list = sections
    .filter((s) => s.heading.trim().length > 0)
    .map((s) => ({
      heading: s.heading.trim(),
      level: s.level || 2,
      required: !!s.required,
      allowMultiple: !!s.allowMultiple,
    }));
  return list.length > 0 ? JSON.stringify(list, null, 2) : null;
}

@Component({
  selector: 'app-types-page',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatExpansionModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  templateUrl: './types-page.component.html',
  styleUrl: './types-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypesPageComponent implements OnInit {
  private readonly typeService = inject(TypeDefinitionService);
  private readonly notification = inject(NotificationService);

  protected readonly types = signal<TypeDefinitionResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isHelpOpen = signal<boolean>(false);

  // Guided Builder state
  protected readonly showBuilder = signal<boolean>(false);
  protected readonly builderMode = signal<'visual' | 'json'>('visual');
  protected readonly editingType = signal<TypeDefinitionResponse | null>(null);

  protected readonly name = signal<string>('');
  protected readonly description = signal<string>('');
  protected readonly fields = signal<MetadataFieldDef[]>([]);
  protected readonly sections = signal<SectionFieldDef[]>([]);

  protected readonly rawSchemaJson = signal<string>('{}');
  protected readonly rawSectionsJson = signal<string>('');

  // Clone modal state
  protected readonly cloningType = signal<TypeDefinitionResponse | null>(null);
  protected readonly cloneName = signal<string>('');

  public ngOnInit(): void {
    this.loadTypes();
  }

  public loadTypes(): void {
    this.isLoading.set(true);
    this.typeService.list(true).subscribe({
      next: (list) => {
        this.types.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.notification.showError('Failed to load type definitions.');
      },
    });
  }

  public toggleHelp(): void {
    this.isHelpOpen.update((v) => !v);
  }

  public getFields(type: TypeDefinitionResponse): MetadataFieldDef[] {
    return parseSchemaFields(type.schemaJson);
  }

  public getSections(type: TypeDefinitionResponse): SectionFieldDef[] {
    return parseSections(type.sectionsJson);
  }

  public formatTypeLabel(type: string): string {
    switch (type) {
      case 'string':
        return 'Text';
      case 'number':
        return 'Number';
      case 'boolean':
        return 'Boolean';
      case 'array':
        return 'List';
      default:
        return type;
    }
  }

  public formatJson(raw?: string | null): string {
    if (!raw) return '';
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  public openCreate(): void {
    this.editingType.set(null);
    this.name.set('');
    this.description.set('');
    this.fields.set([]);
    this.sections.set([]);
    this.builderMode.set('visual');
    this.showBuilder.set(true);
  }

  public openNewVersion(type: TypeDefinitionResponse): void {
    this.editingType.set(type);
    this.name.set(type.name);
    this.description.set(type.description || '');
    this.fields.set(parseSchemaFields(type.schemaJson));
    this.sections.set(parseSections(type.sectionsJson));
    this.builderMode.set('visual');
    this.showBuilder.set(true);
  }

  public cancelBuilder(): void {
    this.showBuilder.set(false);
    this.editingType.set(null);
    this.name.set('');
    this.description.set('');
    this.fields.set([]);
    this.sections.set([]);
  }

  public setBuilderMode(mode: 'visual' | 'json'): void {
    if (mode === 'json' && this.builderMode() === 'visual') {
      this.rawSchemaJson.set(buildSchemaJson(this.fields()));
      this.rawSectionsJson.set(buildSectionsJson(this.sections()) ?? '');
    } else if (mode === 'visual' && this.builderMode() === 'json') {
      this.fields.set(parseSchemaFields(this.rawSchemaJson()));
      this.sections.set(parseSections(this.rawSectionsJson()));
    }
    this.builderMode.set(mode);
  }

  public applyPreset(preset: 'meeting' | 'decision' | 'book'): void {
    if (preset === 'meeting') {
      this.name.set('Meeting Note');
      this.description.set('Standard template for team and project meetings');
      this.fields.set([
        { name: 'meetingDate', type: 'string', required: true },
        { name: 'attendees', type: 'array', required: false },
      ]);
      this.sections.set([
        { heading: 'Summary', level: 2, required: true, allowMultiple: false },
        { heading: 'Discussion Points', level: 2, required: false, allowMultiple: false },
        { heading: 'Action Items', level: 2, required: true, allowMultiple: false },
      ]);
    } else if (preset === 'decision') {
      this.name.set('Decision Record');
      this.description.set('Architecture or team decision rationale and outcome');
      this.fields.set([
        { name: 'status', type: 'string', required: true },
        { name: 'decider', type: 'string', required: false },
      ]);
      this.sections.set([
        { heading: 'Context & Problem', level: 2, required: true, allowMultiple: false },
        { heading: 'Considered Options', level: 2, required: false, allowMultiple: false },
        { heading: 'Decision Outcome', level: 2, required: true, allowMultiple: false },
        { heading: 'Consequences', level: 2, required: false, allowMultiple: false },
      ]);
    } else if (preset === 'book') {
      this.name.set('Book Review');
      this.description.set('Notes, takeaways, and key ideas from a book');
      this.fields.set([
        { name: 'author', type: 'string', required: true },
        { name: 'rating', type: 'number', required: false },
        { name: 'recommend', type: 'boolean', required: false },
      ]);
      this.sections.set([
        { heading: 'Key Takeaways', level: 2, required: true, allowMultiple: false },
        { heading: 'Chapter Notes', level: 2, required: false, allowMultiple: true },
        { heading: 'Quotes & References', level: 2, required: false, allowMultiple: false },
      ]);
    }
  }

  public addField(): void {
    this.fields.update((list) => [...list, { name: '', type: 'string', required: false }]);
  }

  public removeField(index: number): void {
    this.fields.update((list) => list.filter((_, i) => i !== index));
  }

  public updateFieldName(index: number, val: string): void {
    this.fields.update((list) =>
      list.map((f, i) => (i === index ? { ...f, name: val } : f)),
    );
  }

  public updateFieldType(index: number, val: 'string' | 'number' | 'boolean' | 'array'): void {
    this.fields.update((list) =>
      list.map((f, i) => (i === index ? { ...f, type: val } : f)),
    );
  }

  public updateFieldRequired(index: number, val: boolean): void {
    this.fields.update((list) =>
      list.map((f, i) => (i === index ? { ...f, required: val } : f)),
    );
  }

  public addSection(): void {
    this.sections.update((list) => [
      ...list,
      { heading: '', level: 2, required: true, allowMultiple: false },
    ]);
  }

  public removeSection(index: number): void {
    this.sections.update((list) => list.filter((_, i) => i !== index));
  }

  public moveSection(index: number, direction: 'up' | 'down'): void {
    this.sections.update((list) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return list;
      const copy = [...list];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }

  public updateSectionHeading(index: number, val: string): void {
    this.sections.update((list) =>
      list.map((s, i) => (i === index ? { ...s, heading: val } : s)),
    );
  }

  public updateSectionLevel(index: number, val: number): void {
    this.sections.update((list) =>
      list.map((s, i) => (i === index ? { ...s, level: val } : s)),
    );
  }

  public updateSectionRequired(index: number, val: boolean): void {
    this.sections.update((list) =>
      list.map((s, i) => (i === index ? { ...s, required: val } : s)),
    );
  }

  public updateSectionAllowMultiple(index: number, val: boolean): void {
    this.sections.update((list) =>
      list.map((s, i) => (i === index ? { ...s, allowMultiple: val } : s)),
    );
  }

  public saveType(): void {
    const name = this.name().trim();
    if (!name || this.isSubmitting()) return;

    let schemaJson: string;
    let sectionsJson: string | null = null;

    if (this.builderMode() === 'visual') {
      const fieldList = this.fields();
      const fieldNames = fieldList.map((f) => f.name.trim()).filter(Boolean);
      const uniqueNames = new Set(fieldNames);
      if (uniqueNames.size !== fieldNames.length) {
        this.notification.showError('Field names must be unique.');
        return;
      }

      schemaJson = buildSchemaJson(fieldList);
      sectionsJson = buildSectionsJson(this.sections());
    } else {
      schemaJson = this.rawSchemaJson().trim();
      try {
        JSON.parse(schemaJson);
      } catch {
        this.notification.showError('Type schema must be valid JSON.');
        return;
      }

      const rawSec = this.rawSectionsJson().trim();
      if (rawSec) {
        try {
          const parsed = JSON.parse(rawSec);
          if (!Array.isArray(parsed)) {
            this.notification.showError('Sections must be a JSON array.');
            return;
          }
          sectionsJson = rawSec;
        } catch {
          this.notification.showError('Sections must be valid JSON.');
          return;
        }
      }
    }

    this.isSubmitting.set(true);
    const existing = this.editingType();

    if (existing) {
      this.typeService
        .createNewVersion(existing.id, {
          description: this.description().trim() || undefined,
          schemaJson,
          sectionsJson,
        })
        .subscribe({
          next: (created) => {
            this.cancelBuilder();
            this.isSubmitting.set(false);
            this.notification.showSuccess(`Version ${created.version} of "${created.name}" published.`);
            this.loadTypes();
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSubmitting.set(false);
            this.notification.showError(err.error?.detail ?? 'Failed to publish new version.');
          },
        });
    } else {
      this.typeService
        .create({
          name,
          description: this.description().trim() || undefined,
          schemaJson,
          sectionsJson,
        })
        .subscribe({
          next: (created) => {
            this.cancelBuilder();
            this.isSubmitting.set(false);
            this.notification.showSuccess(`Type "${created.name}" created.`);
            this.loadTypes();
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSubmitting.set(false);
            this.notification.showError(err.error?.detail ?? 'Failed to create type definition.');
          },
        });
    }
  }

  public toggleActive(type: TypeDefinitionResponse): void {
    this.typeService.toggleActive(type.id).subscribe({
      next: () => {
        this.types.update((list) =>
          list.map((t) => (t.id === type.id ? { ...t, isActive: !t.isActive } : t)),
        );
        const status = !type.isActive ? 'activated' : 'deactivated';
        this.notification.showSuccess(`Type "${type.name}" ${status}.`);
      },
      error: () => {
        this.notification.showError('Failed to update type status.');
      },
    });
  }

  public openClone(type: TypeDefinitionResponse): void {
    this.cloningType.set(type);
    this.cloneName.set(`${type.name} (Copy)`);
  }

  public submitClone(): void {
    const type = this.cloningType();
    const name = this.cloneName().trim();
    if (!type || !name || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.typeService.clone(type.id, { newName: name }).subscribe({
      next: () => {
        this.cloningType.set(null);
        this.isSubmitting.set(false);
        this.notification.showSuccess(`Type cloned as "${name}".`);
        this.loadTypes();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.notification.showError('Failed to clone type definition.');
      },
    });
  }

  public deleteType(type: TypeDefinitionResponse): void {
    if (!confirm(`Delete type definition "${type.name}"?`)) return;

    this.typeService.delete(type.id).subscribe({
      next: () => {
        this.types.update((list) => list.filter((t) => t.id !== type.id));
        this.notification.showSuccess(`Type "${type.name}" deleted.`);
      },
      error: () => {
        this.notification.showError('Failed to delete type definition.');
      },
    });
  }
}
