import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import {
  buildSchemaJson,
  buildSectionsJson,
  MetadataFieldDef,
  parseSchemaFields,
  parseSections,
  SectionFieldDef,
} from './type-builder.utils';

@Component({
  selector: 'app-type-detail-page',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatCheckboxModule,
  ],
  templateUrl: './type-detail-page.component.html',
  styleUrl: './type-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeDetailPageComponent implements OnInit {
  private readonly typeService = inject(TypeDefinitionService);
  private readonly notification = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly typeId = signal<string | null>(null);
  protected readonly isEdit = computed(() => !!this.typeId());
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  // Builder mode
  protected readonly builderMode = signal<'visual' | 'json'>('visual');

  // Form values
  protected readonly name = signal<string>('');
  protected readonly description = signal<string>('');
  protected readonly fields = signal<MetadataFieldDef[]>([]);
  protected readonly sections = signal<SectionFieldDef[]>([]);

  // Raw JSON representation
  protected readonly rawSchemaJson = signal<string>('{}');
  protected readonly rawSectionsJson = signal<string>('');

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.typeId.set(id);
      this.loadType(id);
    }
  }

  private loadType(id: string): void {
    this.isLoading.set(true);
    this.typeService.getById(id).subscribe({
      next: (typeDef) => {
        this.isLoading.set(false);
        this.name.set(typeDef.name);
        this.description.set(typeDef.description || '');
        this.fields.set(parseSchemaFields(typeDef.schemaJson));
        this.sections.set(parseSections(typeDef.sectionsJson));
        this.rawSchemaJson.set(typeDef.schemaJson || '{}');
        this.rawSectionsJson.set(typeDef.sectionsJson || '');
      },
      error: () => {
        this.isLoading.set(false);
        this.notification.showError('Type definition not found.');
        void this.router.navigate(['/settings/types']);
      },
    });
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
        { heading: 'Discussion', level: 2, required: false, allowMultiple: false },
        { heading: 'Action Items', level: 2, required: true, allowMultiple: false },
      ]);
    } else if (preset === 'decision') {
      this.name.set('Decision Record');
      this.description.set('Architecture or process decision record (ADR)');
      this.fields.set([
        { name: 'status', type: 'string', required: true },
        { name: 'deciders', type: 'array', required: false },
      ]);
      this.sections.set([
        { heading: 'Context & Problem Statement', level: 2, required: true, allowMultiple: false },
        { heading: 'Decision Outcome', level: 2, required: true, allowMultiple: false },
        { heading: 'Consequences & Trade-offs', level: 2, required: false, allowMultiple: false },
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

  public goBack(): void {
    void this.router.navigate(['/settings/types']);
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
    const id = this.typeId();

    if (id) {
      this.typeService
        .update(id, {
          name,
          description: this.description().trim() || undefined,
          schemaJson,
          sectionsJson,
        })
        .subscribe({
          next: (updated) => {
            this.isSubmitting.set(false);
            this.notification.showSuccess(`Type "${updated.name}" updated successfully.`);
            this.goBack();
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSubmitting.set(false);
            this.notification.showError(err.error?.detail ?? 'Failed to update type.');
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
            this.isSubmitting.set(false);
            this.notification.showSuccess(`Type "${created.name}" created successfully.`);
            this.goBack();
          },
          error: (err: { error?: { detail?: string } }) => {
            this.isSubmitting.set(false);
            this.notification.showError(err.error?.detail ?? 'Failed to create type.');
          },
        });
    }
  }
}
