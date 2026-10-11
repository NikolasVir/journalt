import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
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
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
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
          (click)="openRootCreate()"
          class="libraries-page__new-btn"
        >
          <mat-icon>create_new_folder</mat-icon>
          <span>New Library</span>
        </button>
      </header>

      <!-- Content / Tree -->
      @if (isLoading()) {
        <div class="libraries-page__loading">
          <mat-icon class="spinning">sync</mat-icon>
          <span>Loading libraries...</span>
        </div>
      } @else if (libraryTree().length === 0 && !isCreating()) {
        <div class="libraries-page__empty">
          <mat-icon class="libraries-page__empty-icon">folder_off</mat-icon>
          <p class="libraries-page__empty-title">No libraries created yet</p>
          <p class="libraries-page__empty-desc">
            Organize your notes into folders and nested categories.
          </p>
          <button
            mat-stroked-button
            color="primary"
            (click)="openRootCreate()"
            class="libraries-page__empty-cta"
          >
            <mat-icon>add</mat-icon>
            <span>Create First Library</span>
          </button>
        </div>
      } @else {
        <div class="libraries-tree">
          @if (isCreating() && createParentId() === null) {
            <ng-container
              *ngTemplateOutlet="inlineCreateTmpl; context: { level: 0 }"
            />
          }

          @for (root of libraryTree(); track root.id) {
            <ng-container
              *ngTemplateOutlet="nodeTmpl; context: { $implicit: root, level: 0 }"
            />
          }
        </div>
      }

      <!-- Inline Create Template -->
      <ng-template #inlineCreateTmpl let-level="level">
        <mat-card
          appearance="outlined"
          class="tree-node tree-node--inline-create"
          [style.margin-left.px]="level * 28"
        >
          <div class="tree-node__main">
            <mat-icon class="tree-node__icon">create_new_folder</mat-icon>
            <div class="tree-node__inline-form">
              <input
                type="text"
                class="tree-node__inline-input"
                placeholder="Folder name..."
                [ngModel]="newLibraryName()"
                (ngModelChange)="newLibraryName.set($event)"
                (keydown.enter)="createLibrary()"
                (keydown.escape)="cancelCreate()"
                aria-label="Library name"
              />
            </div>
          </div>

          <div class="tree-node__actions">
            <button
              mat-icon-button
              color="primary"
              (click)="createLibrary()"
              [disabled]="!newLibraryName().trim() || isSubmitting()"
              matTooltip="Create (Enter)"
              aria-label="Create library"
            >
              <mat-icon>check</mat-icon>
            </button>
            <button
              mat-icon-button
              (click)="cancelCreate()"
              matTooltip="Cancel (Esc)"
              aria-label="Cancel"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </mat-card>
      </ng-template>

      <!-- Recursive Node Template -->
      <ng-template #nodeTmpl let-node let-level="level">
        <mat-card
          appearance="outlined"
          class="tree-node"
          [class.tree-node--editing]="editingLibrary()?.id === node.id"
          [style.margin-left.px]="level * 28"
        >
          <div class="tree-node__main">
            <mat-icon class="tree-node__icon">
              {{ (node.children?.length ?? 0) > 0 ? 'folder_open' : 'folder' }}
            </mat-icon>

            @if (editingLibrary()?.id === node.id) {
              <div class="tree-node__inline-form">
                <input
                  type="text"
                  class="tree-node__inline-input"
                  [ngModel]="editLibraryName()"
                  (ngModelChange)="editLibraryName.set($event)"
                  (keydown.enter)="saveRename()"
                  (keydown.escape)="cancelRename()"
                  aria-label="Rename library"
                />
              </div>
            } @else {
              <div class="tree-node__info">
                <span class="tree-node__name">{{ node.name }}</span>
                <span class="tree-node__meta">
                  Created {{ node.createdAtUtc | date:'mediumDate' }}
                  @if ((node.children?.length ?? 0) > 0) {
                    • {{ node.children.length }} subfolder{{ node.children.length > 1 ? 's' : '' }}
                  }
                  @if ((node.notesCount ?? 0) > 0) {
                    • {{ node.notesCount }} note{{ node.notesCount === 1 ? '' : 's' }}
                  }
                </span>
              </div>
            }
          </div>

          <div class="tree-node__actions">
            @if (editingLibrary()?.id === node.id) {
              <button
                mat-icon-button
                color="primary"
                (click)="saveRename()"
                [disabled]="!editLibraryName().trim() || isSubmitting()"
                matTooltip="Save (Enter)"
                aria-label="Save rename"
              >
                <mat-icon>check</mat-icon>
              </button>
              <button
                mat-icon-button
                (click)="cancelRename()"
                matTooltip="Cancel (Esc)"
                aria-label="Cancel rename"
              >
                <mat-icon>close</mat-icon>
              </button>
            } @else {
              <a
                mat-icon-button
                [routerLink]="['/notes']"
                [queryParams]="{ libraryId: node.id }"
                matTooltip="View notes in library"
                aria-label="View notes in library"
              >
                <mat-icon>open_in_new</mat-icon>
              </a>
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
              <button
                mat-icon-button
                class="tree-node__action-delete"
                (click)="deleteLibrary(node)"
                matTooltip="Delete library"
                aria-label="Delete library"
              >
                <mat-icon>delete</mat-icon>
              </button>
            }
          </div>
        </mat-card>

        @if (isCreating() && createParentId() === node.id) {
          <ng-container
            *ngTemplateOutlet="inlineCreateTmpl; context: { level: level + 1 }"
          />
        }

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
      transition: background-color 0.2s, border-color 0.2s;

      &:hover {
        background-color: var(--color-bg-surface-hover);
      }

      &--inline-create {
        border-style: dashed;
        border-color: var(--color-primary);
        background-color: var(--color-bg-surface);
      }

      &--editing {
        border-color: var(--color-primary);
      }

      &__main {
        @include flex-row;
        align-items: center;
        gap: var(--spacing-md);
        flex: 1;
        min-width: 0;
      }

      &__icon {
        color: var(--color-primary);
        flex-shrink: 0;
      }

      &__inline-form {
        flex: 1;
        max-width: 420px;
      }

      &__inline-input {
        width: 100%;
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-sm);
        background-color: var(--color-bg-input, #f1f3f4);
        color: var(--color-text-primary);
        font-family: inherit;
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        outline: none;
        box-shadow: 0 0 0 2px var(--color-primary-light);
        transition: border-color 0.15s, box-shadow 0.15s;

        &:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-light);
        }

        &::placeholder {
          color: var(--color-text-muted);
          font-weight: var(--font-weight-regular);
        }
      }

      &__info {
        @include flex-column;
        gap: var(--spacing-2xs);
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
        align-items: center;
        gap: var(--spacing-xs);
        flex-shrink: 0;
      }

      &__action-delete {
        color: var(--color-text-secondary);

        &:hover {
          color: var(--color-error);
        }
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

  // In-place creation state
  protected readonly isCreating = signal<boolean>(false);
  protected readonly createParentId = signal<string | null>(null);
  protected readonly newLibraryName = signal<string>('');

  // In-place rename state
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

  public openRootCreate(): void {
    this.createParentId.set(null);
    this.newLibraryName.set('');
    this.editingLibrary.set(null);
    this.isCreating.set(true);
    this.focusInlineCreateInput();
  }

  public openSubfolderCreate(parent: LibraryTreeResponse): void {
    this.createParentId.set(parent.id);
    this.newLibraryName.set('');
    this.editingLibrary.set(null);
    this.isCreating.set(true);
    this.focusInlineCreateInput();
  }

  public cancelCreate(): void {
    this.isCreating.set(false);
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
    this.cancelCreate();
    this.editingLibrary.set(lib);
    this.editLibraryName.set(lib.name);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.tree-node--editing .tree-node__inline-input');
      el?.focus();
      el?.select();
    }, 50);
  }

  public cancelRename(): void {
    this.editingLibrary.set(null);
    this.editLibraryName.set('');
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
          this.cancelRename();
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

  public deleteLibrary(node: LibraryTreeResponse): void {
    if ((node.notesCount ?? 0) > 0) {
      this.notification.showError('Libraries that contain notes cannot be deleted.');
      return;
    }

    if ((node.children?.length ?? 0) > 0) {
      this.notification.showError('Libraries that have subfolders cannot be deleted.');
      return;
    }

    if (!confirm(`Delete library "${node.name}"?`)) {
      return;
    }

    this.isSubmitting.set(true);
    this.libraryService.delete(node.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.notification.showSuccess(`Library "${node.name}" deleted.`);
        this.loadData();
      },
      error: (err: { error?: { detail?: string; message?: string } }) => {
        this.isSubmitting.set(false);
        const msg = err.error?.detail || err.error?.message || 'Failed to delete library.';
        this.notification.showError(msg);
      }
    });
  }

  private focusInlineCreateInput(): void {
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.tree-node--inline-create .tree-node__inline-input');
      el?.focus();
      el?.select();
    }, 50);
  }
}
