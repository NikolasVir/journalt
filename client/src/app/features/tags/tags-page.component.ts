import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TagDefinitionResponse } from '@core/models/tag-definition.model';
import { NotificationService } from '@core/services/notification.service';
import { TagDefinitionService } from '@core/services/tag-definition.service';

@Component({
  selector: 'app-tags-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <div class="tags-page">
      <header class="tags-page__header">
        <div class="tags-page__header-text">
          <h1 class="tags-page__title">Tag Registry</h1>
          <p class="tags-page__subtitle">
            Universal semantic categories and selectable values for Journal notes.
          </p>
        </div>

        <button
          mat-flat-button
          color="primary"
          (click)="showCreateModal.set(true)"
          class="tags-page__new-btn"
        >
          <mat-icon>new_label</mat-icon>
          <span>New Tag Definition</span>
        </button>
      </header>

      <!-- Create Tag Definition Form -->
      @if (showCreateModal()) {
        <mat-card appearance="outlined" class="create-card">
          <mat-card-header>
            <mat-card-title class="create-card__title">Define Tag Category</mat-card-title>
          </mat-card-header>

          <mat-card-content class="create-card__content">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Category Name</mat-label>
              <input
                matInput
                placeholder="e.g. status, priority, area"
                [ngModel]="newCategory()"
                (ngModelChange)="newCategory.set($event)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Closed Vocabulary (comma-separated)</mat-label>
              <input
                matInput
                placeholder="e.g. urgent, high, medium, low"
                [ngModel]="newAllowedValues()"
                (ngModelChange)="newAllowedValues.set($event)"
              />
              <mat-hint
                >Leave blank to create an open category whose values are registered later.</mat-hint
              >
            </mat-form-field>
          </mat-card-content>

          <mat-card-actions class="create-card__actions">
            <button mat-button (click)="cancelCreate()">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              (click)="createTagDefinition()"
              [disabled]="!newCategory().trim() || isSubmitting()"
            >
              Create
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <!-- Edit Tag Definition Form -->
      @if (editingTagDef(); as def) {
        <mat-card appearance="outlined" class="create-card">
          <mat-card-header>
            <mat-card-title class="create-card__title">
              Manage Values for "{{ def.category }}"
            </mat-card-title>
          </mat-card-header>

          <mat-card-content class="create-card__content">
            @if (def.allowedValuesJson) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Closed Vocabulary (comma-separated)</mat-label>
                <input
                  matInput
                  [ngModel]="editAllowedValues()"
                  (ngModelChange)="editAllowedValues.set($event)"
                />
                <mat-hint>Values currently used by notes cannot be removed.</mat-hint>
              </mat-form-field>
            } @else {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Registered Values (comma-separated)</mat-label>
                <input
                  matInput
                  [ngModel]="editKnownValues()"
                  (ngModelChange)="editKnownValues.set($event)"
                />
                <mat-hint>
                  Select this open category to add it as a tag, or register values below.
                </mat-hint>
              </mat-form-field>
            }
          </mat-card-content>

          <mat-card-actions class="create-card__actions">
            <button mat-button (click)="editingTagDef.set(null)">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              (click)="saveEditTagDefinition()"
              [disabled]="isSubmitting()"
            >
              Save
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <!-- Content -->
      @if (isLoading()) {
        <div class="tags-page__loading">
          <mat-icon class="spinning">sync</mat-icon>
          <span>Loading tag definitions...</span>
        </div>
      } @else if (tagDefinitions().length === 0) {
        <div class="tags-page__empty">
          <mat-icon class="tags-page__empty-icon">label_off</mat-icon>
          <p class="tags-page__empty-title">No tag definitions found</p>
          <p class="tags-page__empty-desc">
            Define a closed category or register values for an open category.
          </p>
          <button
            mat-stroked-button
            color="primary"
            (click)="showCreateModal.set(true)"
            class="tags-page__empty-cta"
          >
            <mat-icon>add</mat-icon>
            <span>Create First Tag Definition</span>
          </button>
        </div>
      } @else {
        <div class="tags-page__grid">
          @for (def of tagDefinitions(); track def.id) {
            <mat-card appearance="outlined" class="tag-card">
              <mat-card-header>
                <div class="tag-card__header-top">
                  <div class="tag-card__title-row">
                    <mat-icon class="tag-card__icon">label</mat-icon>
                    <mat-card-title class="tag-card__category">{{ def.category }}</mat-card-title>
                  </div>
                  <div class="tag-card__menu">
                    <button
                      mat-icon-button
                      (click)="openEdit(def)"
                      matTooltip="Manage selectable values"
                      aria-label="Manage selectable values"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      (click)="deleteTagDefinition(def)"
                      matTooltip="Delete tag definition"
                      aria-label="Delete tag definition"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
                <mat-card-subtitle class="tag-card__subtitle">
                  Created {{ def.createdAtUtc | date: 'mediumDate' }}
                </mat-card-subtitle>
              </mat-card-header>

              <mat-card-content class="tag-card__content">
                <div class="tag-card__mode-row">
                  <span class="tag-card__mode">{{
                    def.allowedValuesJson ? 'Closed vocabulary' : 'Open category'
                  }}</span>
                  <button mat-button type="button" (click)="openEdit(def)">
                    <mat-icon>edit</mat-icon>
                    Manage values
                  </button>
                </div>
                @if (selectableValues(def); as values) {
                  @if (values.length > 0) {
                    <span class="tag-card__values-label">Selectable Values:</span>
                    <mat-chip-set class="tag-card__chips">
                      @for (val of values; track val) {
                        <mat-chip class="tag-card__chip">{{ val }}</mat-chip>
                      }
                    </mat-chip-set>
                  } @else {
                    <span class="tag-card__values-empty">
                      {{
                        def.allowedValuesJson
                          ? 'No values registered yet'
                          : 'No values registered — this category can be used as a tag'
                      }}
                    </span>
                  }
                }
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: `
    @use 'mixins' as *;

    .tags-page {
      @include flex-column;
      gap: var(--spacing-lg);
      width: 100%;
      max-width: 1000px;
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

      &__grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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

    .tag-card {
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);

      &__header-top {
        @include flex-row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }

      &__title-row {
        @include flex-row;
        align-items: center;
        gap: var(--spacing-xs);
      }

      &__icon {
        color: var(--color-primary-main, #1976d2);
      }

      &__category {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }

      &__subtitle {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      &__content {
        padding-top: var(--spacing-sm);
      }

      &__mode-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
      }

      &__mode {
        padding: var(--spacing-3xs, 2px) var(--spacing-xs);
        border-radius: var(--radius-sm);
        background: var(--color-bg-input);
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
      }

      &__values-label {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        display: block;
        margin-bottom: var(--spacing-2xs);
      }

      &__values-empty {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        font-style: italic;
      }

      &__chips {
        margin-top: var(--spacing-2xs);
      }

      &__chip {
        font-size: var(--font-size-xs);
        min-height: 24px;
      }
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagsPageComponent implements OnInit {
  private readonly tagService = inject(TagDefinitionService);
  private readonly notification = inject(NotificationService);

  protected readonly tagDefinitions = signal<TagDefinitionResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly showCreateModal = signal<boolean>(false);
  protected readonly newCategory = signal<string>('');
  protected readonly newAllowedValues = signal<string>('');

  protected readonly editingTagDef = signal<TagDefinitionResponse | null>(null);
  protected readonly editAllowedValues = signal<string>('');
  protected readonly editKnownValues = signal<string>('');

  public ngOnInit(): void {
    this.loadTags();
  }

  public loadTags(): void {
    this.isLoading.set(true);
    this.tagService.list().subscribe({
      next: (tags) => {
        this.tagDefinitions.set(tags);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.notification.showError('Failed to load tag definitions.');
      },
    });
  }

  public parseAllowedValues(json?: string | null): string[] {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public selectableValues(def: TagDefinitionResponse): string[] {
    return this.parseAllowedValues(def.allowedValuesJson ?? def.knownValuesJson);
  }

  public cancelCreate(): void {
    this.showCreateModal.set(false);
    this.newCategory.set('');
    this.newAllowedValues.set('');
  }

  public createTagDefinition(): void {
    const category = this.newCategory().trim();
    if (!category || this.isSubmitting()) return;

    const values = this.newAllowedValues()
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const allowedValuesJson = values.length > 0 ? JSON.stringify(values) : null;

    this.isSubmitting.set(true);
    this.tagService
      .create({
        category,
        allowedValues: values.length > 0 ? values : undefined,
      })
      .subscribe({
        next: () => {
          this.cancelCreate();
          this.isSubmitting.set(false);
          this.notification.showSuccess(`Tag category "${category}" created.`);
          this.loadTags();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.notification.showError('Failed to create tag definition.');
        },
      });
  }

  public openEdit(def: TagDefinitionResponse): void {
    this.editingTagDef.set(def);
    this.editAllowedValues.set(this.parseAllowedValues(def.allowedValuesJson).join(', '));
    this.editKnownValues.set(this.parseAllowedValues(def.knownValuesJson).join(', '));
  }

  public saveEditTagDefinition(): void {
    const def = this.editingTagDef();
    if (!def || this.isSubmitting()) return;

    const input = def.allowedValuesJson ? this.editAllowedValues() : this.editKnownValues();
    const values = input
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    const isClosed = !!def.allowedValuesJson;

    this.isSubmitting.set(true);
    this.tagService
      .update(def.id, {
        allowedValues: isClosed && values.length > 0 ? values : undefined,
        knownValues: !isClosed && values.length > 0 ? values : undefined,
      })
      .subscribe({
        next: () => {
          this.editingTagDef.set(null);
          this.isSubmitting.set(false);
          this.notification.showSuccess(`Tag definition updated.`);
          this.loadTags();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.notification.showError('Failed to update tag definition.');
        },
      });
  }

  public deleteTagDefinition(def: TagDefinitionResponse): void {
    if (!confirm(`Delete tag category "${def.category}"?`)) return;

    this.tagService.delete(def.id).subscribe({
      next: () => {
        this.tagDefinitions.update((list) => list.filter((t) => t.id !== def.id));
        this.notification.showSuccess(`Tag category "${def.category}" deleted.`);
      },
      error: () => {
        this.notification.showError('Failed to delete tag definition.');
      },
    });
  }
}
