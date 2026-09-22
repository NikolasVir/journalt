import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LibraryResponse, LibraryTreeResponse } from '@core/models/library.model';
import { LibraryService } from '@core/services/library.service';
import { NotificationService } from '@core/services/notification.service';

@Component({
  selector: 'app-libraries-page',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule
  ],
  template: `
    <div class="libraries-page">
      <header class="libraries-page__header">
        <div class="libraries-page__header-text">
          <h1 class="libraries-page__title">Libraries</h1>
          <p class="libraries-page__subtitle">
            Hierarchical folders for organizing your personal knowledge base.
          </p>
        </div>

        <button
          mat-flat-button
          color="primary"
          (click)="showCreateModal.set(true)"
          class="libraries-page__new-btn"
        >
          <mat-icon>create_new_folder</mat-icon>
          <span>New Library</span>
        </button>
      </header>

      <!-- Create / Subfolder Modal Form -->
      @if (showCreateModal()) {
        <mat-card appearance="outlined" class="create-card">
          <mat-card-header>
            <mat-card-title class="create-card__title">
              {{ createParentId() ? 'Create Sub-Library' : 'Create New Library' }}
            </mat-card-title>
          </mat-card-header>

          <mat-card-content class="create-card__content">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Library Name</mat-label>
              <input
                matInput
                placeholder="e.g. Work, Research, Personal"
                [ngModel]="newLibraryName()"
                (ngModelChange)="newLibraryName.set($event)"
                (keydown.enter)="createLibrary()"
                #libNameInput
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Parent Library (Optional)</mat-label>
              <mat-select
                [ngModel]="createParentId()"
                (ngModelChange)="createParentId.set($event)"
              >
                <mat-option [value]="null">None (Top Level Root)</mat-option>
                @for (flat of flatLibraries(); track flat.id) {
                  <mat-option [value]="flat.id">{{ flat.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </mat-card-content>

          <mat-card-actions class="create-card__actions">
            <button mat-button (click)="cancelCreate()">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              (click)="createLibrary()"
              [disabled]="!newLibraryName().trim() || isSubmitting()"
            >
              Create
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <!-- Rename Modal Form -->
      @if (editingLibrary(); as lib) {
        <mat-card appearance="outlined" class="create-card">
          <mat-card-header>
            <mat-card-title class="create-card__title">Rename Library</mat-card-title>
          </mat-card-header>

          <mat-card-content class="create-card__content">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>New Name</mat-label>
              <input
                matInput
                [ngModel]="editLibraryName()"
                (ngModelChange)="editLibraryName.set($event)"
                (keydown.enter)="saveRename()"
              />
            </mat-form-field>
          </mat-card-content>

          <mat-card-actions class="create-card__actions">
            <button mat-button (click)="editingLibrary.set(null)">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              (click)="saveRename()"
              [disabled]="!editLibraryName().trim() || isSubmitting()"
            >
              Save
            </button>
          </mat-card-actions>
        </mat-card>
      }

      <!-- Content / Tree -->
      @if (isLoading()) {
        <div class="libraries-page__loading">
          <mat-icon class="spinning">sync</mat-icon>
          <span>Loading libraries...</span>
        </div>
      } @else if (libraryTree().length === 0) {
        <div class="libraries-page__empty">
          <mat-icon class="libraries-page__empty-icon">folder_off</mat-icon>
          <p class="libraries-page__empty-title">No libraries created yet</p>
          <p class="libraries-page__empty-desc">
            Organize your notes into folders and nested categories.
          </p>
          <button
            mat-stroked-button
            color="primary"
            (click)="showCreateModal.set(true)"
            class="libraries-page__empty-cta"
          >
            <mat-icon>add</mat-icon>
            <span>Create First Library</span>
          </button>
        </div>
      } @else {
        <div class="libraries-tree">
          @for (root of libraryTree(); track root.id) {
            <ng-container
              *ngTemplateOutlet="nodeTmpl; context: { $implicit: root, level: 0 }"
            />
          }
        </div>
      }

      <!-- Recursive Node Template -->
      <ng-template #nodeTmpl let-node let-level="level">
        <mat-card
          appearance="outlined"
          class="tree-node"
          [style.margin-left.px]="level * 28"
        >
          <div class="tree-node__main">
            <mat-icon class="tree-node__icon">
              {{ (node.children?.length ?? 0) > 0 ? 'folder_open' : 'folder' }}
            </mat-icon>

            <div class="tree-node__info">
              <span class="tree-node__name">{{ node.name }}</span>
              <span class="tree-node__meta">
                Created {{ node.createdAtUtc | date:'mediumDate' }}
                @if ((node.children?.length ?? 0) > 0) {
                  • {{ node.children.length }} subfolder{{ node.children.length > 1 ? 's' : '' }}
                }
              </span>
            </div>
          </div>

          <div class="tree-node__actions">
            <button
              mat-icon-button
              (click)="openSubfolderCreate(node)"
              matTooltip="Add subfolder"
              aria-label="Add subfolder"
            >
              <mat-icon>create_new_folder</mat-icon>
            </button>
            <button
              mat-icon-button
              (click)="openRename(node)"
              matTooltip="Rename"
              aria-label="Rename library"
            >
              <mat-icon>edit</mat-icon>
            </button>
          </div>
        </mat-card>

        @for (child of node.children ?? []; track child.id) {
          <ng-container
            *ngTemplateOutlet="nodeTmpl; context: { $implicit: child, level: level + 1 }"
          />
        }
      </ng-template>
    </div>
  `,
  styles: `
    @use 'mixins' as *;

    .libraries-page {
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

    .libraries-tree {
      @include flex-column;
      gap: var(--spacing-xs);
    }

    .tree-node {
      @include flex-row;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.02));
      }

      &__main {
        @include flex-row;
        align-items: center;
        gap: var(--spacing-md);
      }

      &__icon {
        color: var(--color-primary-main, #1976d2);
      }

      &__info {
        @include flex-column;
        gap: 2px;
      }

      &__name {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      &__meta {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      &__actions {
        @include flex-row;
        gap: var(--spacing-3xs);
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LibrariesPageComponent implements OnInit {
  private readonly libraryService = inject(LibraryService);
  private readonly notification = inject(NotificationService);

  protected readonly libraryTree = signal<LibraryTreeResponse[]>([]);
  protected readonly flatLibraries = signal<LibraryResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly showCreateModal = signal<boolean>(false);
  protected readonly createParentId = signal<string | null>(null);
  protected readonly newLibraryName = signal<string>('');

  protected readonly editingLibrary = signal<LibraryResponse | LibraryTreeResponse | null>(null);
  protected readonly editLibraryName = signal<string>('');

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    this.isLoading.set(true);
    this.libraryService.getTree().subscribe({
      next: (tree) => {
        this.libraryTree.set(tree);
        this.loadFlat();
      },
      error: () => {
        this.isLoading.set(false);
        this.notification.showError('Failed to load libraries.');
      }
    });
  }

  private loadFlat(): void {
    this.libraryService.list().subscribe({
      next: (flat) => {
        this.flatLibraries.set(flat);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  public openSubfolderCreate(parent: LibraryTreeResponse): void {
    this.createParentId.set(parent.id);
    this.newLibraryName.set('');
    this.showCreateModal.set(true);
  }

  public cancelCreate(): void {
    this.showCreateModal.set(false);
    this.createParentId.set(null);
    this.newLibraryName.set('');
  }

  public createLibrary(): void {
    const name = this.newLibraryName().trim();
    if (!name || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.libraryService
      .create({
        name,
        parentLibraryId: this.createParentId() || undefined
      })
      .subscribe({
        next: () => {
          this.cancelCreate();
          this.isSubmitting.set(false);
          this.notification.showSuccess(`Library "${name}" created.`);
          this.loadData();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.notification.showError('Failed to create library.');
        }
      });
  }

  public openRename(lib: LibraryTreeResponse): void {
    this.editingLibrary.set(lib);
    this.editLibraryName.set(lib.name);
  }

  public saveRename(): void {
    const lib = this.editingLibrary();
    const name = this.editLibraryName().trim();
    if (!lib || !name || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.libraryService
      .rename(lib.id, { name })
      .subscribe({
        next: () => {
          this.editingLibrary.set(null);
          this.isSubmitting.set(false);
          this.notification.showSuccess(`Library renamed to "${name}".`);
          this.loadData();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.notification.showError('Failed to rename library.');
        }
      });
  }
}
