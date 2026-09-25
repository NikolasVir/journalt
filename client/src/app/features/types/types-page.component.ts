import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TypeDefinitionResponse } from '@core/models/type-definition.model';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';

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
    MatTooltipModule
  ],
  template: `
    <div class="types-page">
      <header class="types-page__header">
        <div class="types-page__header-text">
          <h1 class="types-page__title">Type Definitions</h1>
          <p class="types-page__subtitle">
            Manage JSON Schemas and section templates for structured Journal notes.
          </p>
        </div>

        <button
          mat-flat-button
          color="primary"
          (click)="showCreateModal.set(true)"
          class="types-page__new-btn"
        >
          <mat-icon>add</mat-icon>
          <span>New Type Definition</span>
        </button>
      </header>

      <!-- Create Type Definition Form -->
      @if (showCreateModal()) {
        <mat-card appearance="outlined" class="create-card">
          <mat-card-header>
            <mat-card-title class="create-card__title">Create Type Definition</mat-card-title>
          </mat-card-header>

          <mat-card-content class="create-card__content">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Type Name</mat-label>
              <input
                matInput
                placeholder="e.g. Meeting Note, Book Summary, Daily Log"
                [ngModel]="newName()"
                (ngModelChange)="newName.set($event)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <input
                matInput
                placeholder="Brief description of this note type"
                [ngModel]="newDescription()"
                (ngModelChange)="newDescription.set($event)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>JSON Schema</mat-label>
              <textarea
                matInput
                rows="6"
                [ngModel]="newSchemaJson()"
                (ngModelChange)="newSchemaJson.set($event)"
                class="code-font"
              ></textarea>
              <mat-hint>Valid JSON Schema defining typed metadata fields.</mat-hint>
            </mat-form-field>
          </mat-card-content>

          <mat-card-actions class="create-card__actions">
            <button mat-button (click)="cancelCreate()">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              (click)="createTypeDefinition()"
              [disabled]="!newName().trim() || !newSchemaJson().trim() || isSubmitting()"
            >
              Create Type
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <!-- Clone Type Modal -->
      @if (cloningType(); as type) {
        <mat-card appearance="outlined" class="create-card">
          <mat-card-header>
            <mat-card-title class="create-card__title">Clone "{{ type.name }}"</mat-card-title>
          </mat-card-header>

          <mat-card-content class="create-card__content">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>New Type Name</mat-label>
              <input
                matInput
                [ngModel]="cloneName()"
                (ngModelChange)="cloneName.set($event)"
              />
            </mat-form-field>
          </mat-card-content>

          <mat-card-actions class="create-card__actions">
            <button mat-button (click)="cloningType.set(null)">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              (click)="submitClone()"
              [disabled]="!cloneName().trim() || isSubmitting()"
            >
              Clone
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <!-- Content -->
      @if (isLoading()) {
        <div class="types-page__loading">
          <mat-icon class="spinning">sync</mat-icon>
          <span>Loading type definitions...</span>
        </div>
      } @else if (types().length === 0) {
        <div class="types-page__empty">
          <mat-icon class="types-page__empty-icon">schema</mat-icon>
          <p class="types-page__empty-title">No type definitions created yet</p>
          <p class="types-page__empty-desc">
            Define structured schemas and validation rules for Journal notes.
          </p>
          <button
            mat-stroked-button
            color="primary"
            (click)="showCreateModal.set(true)"
            class="types-page__empty-cta"
          >
            <mat-icon>add</mat-icon>
            <span>Create First Type</span>
          </button>
        </div>
      } @else {
        <div class="types-page__list">
          @for (type of types(); track type.id) {
            <mat-card appearance="outlined" class="type-card">
              <mat-card-header>
                <div class="type-card__header-top">
                  <div class="type-card__title-row">
                    <mat-icon class="type-card__icon">schema</mat-icon>
                    <mat-card-title class="type-card__name">{{ type.name }}</mat-card-title>
                    <span class="type-card__version">v{{ type.version }}</span>
                  </div>

                  <div class="type-card__actions">
                    <mat-slide-toggle
                      [checked]="type.isActive"
                      (change)="toggleActive(type)"
                      color="primary"
                      matTooltip="Toggle Active Status"
                    >
                      {{ type.isActive ? 'Active' : 'Inactive' }}
                    </mat-slide-toggle>

                    <button
                      mat-icon-button
                      (click)="openClone(type)"
                      matTooltip="Clone Type"
                      aria-label="Clone Type"
                    >
                      <mat-icon>content_copy</mat-icon>
                    </button>

                    <button
                      mat-icon-button
                      (click)="deleteType(type)"
                      matTooltip="Delete Type"
                      aria-label="Delete Type"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>

                @if (type.description) {
                  <mat-card-subtitle class="type-card__desc">
                    {{ type.description }}
                  </mat-card-subtitle>
                }
              </mat-card-header>

              <mat-card-content class="type-card__content">
                <mat-expansion-panel class="type-card__panel">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon class="panel-icon">data_object</mat-icon>
                      <span>Schema & Sections JSON</span>
                    </mat-panel-title>
                  </mat-expansion-panel-header>

                  <div class="type-card__schema">
                    <span class="type-card__schema-label">Schema:</span>
                    <pre class="code-block">{{ formatJson(type.schemaJson) }}</pre>

                    @if (type.sectionsJson) {
                      <span class="type-card__schema-label">Sections:</span>
                      <pre class="code-block">{{ formatJson(type.sectionsJson) }}</pre>
                    }
                  </div>
                </mat-expansion-panel>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: `
    @use 'mixins' as *;

    .types-page {
      @include flex-column;
      gap: var(--spacing-lg);
      width: 100%;
      max-width: 960px;
      margin: 0 auto;

      &__header {
        @include flex-row;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--color-border-card);
        padding-bottom: var(--spacing-md);
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      &__title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      &__subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: var(--spacing-2xs) 0 0 0;
      }

      &__loading,
      &__empty {
        @include flex-column;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-2xl) 0;
        color: var(--color-text-muted);

        mat-icon {
          font-size: 56px;
          width: 56px;
          height: 56px;
        }
      }

      &__empty-title {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        margin: 0;
      }

      &__empty-desc {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        margin: 0;
      }

      &__empty-cta {
        margin-top: var(--spacing-sm);
      }

      &__list {
        @include flex-column;
        gap: var(--spacing-md);
      }
    }

    .create-card {
      padding: var(--spacing-md);
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);

      &__title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        margin-bottom: var(--spacing-sm);
      }

      &__content {
        @include flex-column;
        gap: var(--spacing-sm);
      }

      &__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-xs);
        padding-top: var(--spacing-xs);
      }
    }

    .full-width {
      width: 100%;
    }

    .code-font {
      font-family: monospace;
      font-size: var(--font-size-xs);
    }

    .type-card {
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);

      &__header-top {
        @include flex-row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      &__title-row {
        @include flex-row;
        align-items: center;
        gap: var(--spacing-xs);
      }

      &__icon {
        color: var(--color-primary);
      }

      &__name {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      &__version {
        font-size: var(--font-size-xs);
        background-color: var(--color-border-card);
        padding: var(--spacing-2xs) var(--spacing-xs);
        border-radius: var(--radius-sm);
        color: var(--color-text-secondary);
      }

      &__actions {
        @include flex-row;
        align-items: center;
        gap: var(--spacing-sm);
      }

      &__desc {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin-top: var(--spacing-2xs);
      }

      &__content {
        padding-top: var(--spacing-sm);
      }

      &__panel {
        box-shadow: none !important;
        border: 1px solid var(--color-border-card);
        border-radius: var(--radius-sm);
      }

      &__schema {
        @include flex-column;
        gap: var(--spacing-xs);
      }

      &__schema-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-secondary);
      }
    }

    .panel-icon {
      margin-right: var(--spacing-xs);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .code-block {
      background-color: var(--color-bg-app, #f8f9fa);
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
      font-family: monospace;
      font-size: var(--font-size-xs);
      color: var(--color-text-primary);
      overflow-x: auto;
      margin: 0;
    }

    .spinning {
      animation: spin 1.2s linear infinite;
    }

    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TypesPageComponent implements OnInit {
  private readonly typeService = inject(TypeDefinitionService);
  private readonly notification = inject(NotificationService);

  protected readonly types = signal<TypeDefinitionResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly showCreateModal = signal<boolean>(false);
  protected readonly newName = signal<string>('');
  protected readonly newDescription = signal<string>('');
  protected readonly newSchemaJson = signal<string>(
    JSON.stringify(
      {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['topic']
      },
      null,
      2
    )
  );

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
      }
    });
  }

  public formatJson(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  public cancelCreate(): void {
    this.showCreateModal.set(false);
    this.newName.set('');
    this.newDescription.set('');
  }

  public createTypeDefinition(): void {
    const name = this.newName().trim();
    const schemaJson = this.newSchemaJson().trim();
    if (!name || !schemaJson || this.isSubmitting()) return;

    try {
      JSON.parse(schemaJson);
    } catch {
      this.notification.showError('Schema must be valid JSON.');
      return;
    }

    this.isSubmitting.set(true);
    this.typeService
      .create({
        name,
        description: this.newDescription().trim() || undefined,
        schemaJson
      })
      .subscribe({
        next: () => {
          this.cancelCreate();
          this.isSubmitting.set(false);
          this.notification.showSuccess(`Type "${name}" created.`);
          this.loadTypes();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.notification.showError('Failed to create type definition.');
        }
      });
  }

  public toggleActive(type: TypeDefinitionResponse): void {
    this.typeService.toggleActive(type.id).subscribe({
      next: () => {
        this.types.update((list) =>
          list.map((t) => (t.id === type.id ? { ...t, isActive: !t.isActive } : t))
        );
        const status = !type.isActive ? 'activated' : 'deactivated';
        this.notification.showSuccess(`Type "${type.name}" ${status}.`);
      },
      error: () => {
        this.notification.showError('Failed to update type status.');
      }
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
      }
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
      }
    });
  }
}
