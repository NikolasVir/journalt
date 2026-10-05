import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TypeDefinitionResponse } from '@core/models/type-definition.model';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import {
  MetadataFieldDef,
  parseSchemaFields,
  parseSections,
  SectionFieldDef,
} from './type-builder.utils';

export type {
  MetadataFieldDef,
  SectionFieldDef,
} from './type-builder.utils';
export {
  parseSchemaFields,
  buildSchemaJson,
  parseSections,
  buildSectionsJson,
} from './type-builder.utils';

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
    MatExpansionModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './types-page.component.html',
  styleUrl: './types-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypesPageComponent implements OnInit {
  private readonly typeService = inject(TypeDefinitionService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly types = signal<TypeDefinitionResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isHelpOpen = signal<boolean>(false);

  // Duplicate / Clone modal state
  protected readonly duplicatingType = signal<TypeDefinitionResponse | null>(null);
  protected readonly duplicateName = signal<string>('');
  protected get cloningType() { return this.duplicatingType; }
  protected get cloneName() { return this.duplicateName; }

  // Blocked delete modal state
  protected readonly blockedDeleteType = signal<TypeDefinitionResponse | null>(null);

  public closeBlockedDeleteDialog(): void {
    this.blockedDeleteType.set(null);
  }

  public getNextDuplicateName(baseName: string): string {
    const names = new Set(this.types().map((t) => t.name.toLowerCase()));
    const firstTry = `${baseName} (Copy)`;
    if (!names.has(firstTry.toLowerCase())) {
      return firstTry;
    }
    let counter = 2;
    while (names.has(`${baseName} (Copy ${counter})`.toLowerCase())) {
      counter++;
    }
    return `${baseName} (Copy ${counter})`;
  }

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
    void this.router.navigate(['/types/new']);
  }

  public openEdit(type: TypeDefinitionResponse): void {
    void this.router.navigate(['/types', type.id]);
  }

  public openNewVersion(type: TypeDefinitionResponse): void {
    this.openEdit(type);
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

  public openDuplicate(type: TypeDefinitionResponse): void {
    this.duplicatingType.set(type);
    this.duplicateName.set(this.getNextDuplicateName(type.name));
  }

  public cancelDuplicate(): void {
    this.duplicatingType.set(null);
  }

  public submitDuplicate(): void {
    const type = this.duplicatingType();
    const name = this.duplicateName().trim();
    if (!type || !name || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.typeService.duplicate(type.id, { newName: name }).subscribe({
      next: () => {
        this.duplicatingType.set(null);
        this.isSubmitting.set(false);
        this.notification.showSuccess(`Type "${name}" created.`);
        this.loadTypes();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.isSubmitting.set(false);
        this.notification.showError(err.error?.detail ?? 'Failed to duplicate type definition.');
      },
    });
  }

  public openClone(type: TypeDefinitionResponse): void {
    this.openDuplicate(type);
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
      error: (err: { error?: { detail?: string } }) => {
        this.isSubmitting.set(false);
        this.notification.showError(err.error?.detail ?? 'Failed to clone type definition.');
      },
    });
  }

  public deleteType(type: TypeDefinitionResponse): void {
    if ((type.notesCount ?? 0) > 0) {
      this.blockedDeleteType.set(type);
      return;
    }

    if (!confirm(`Delete type definition "${type.name}"?`)) return;

    this.typeService.delete(type.id).subscribe({
      next: () => {
        this.types.update((list) => list.filter((t) => t.id !== type.id));
        this.notification.showSuccess(`Type "${type.name}" deleted.`);
      },
      error: (err: { error?: { detail?: string } }) => {
        this.notification.showError(err.error?.detail ?? 'Types that have notes cannot be deleted.');
      },
    });
  }
}
