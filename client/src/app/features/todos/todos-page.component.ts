import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatTag, NoteResponse, NoteSummaryResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { NotificationService } from '@core/services/notification.service';
import { Router } from '@angular/router';
import { NoteEditButtonComponent } from '@shared/components/note-edit-button/note-edit-button.component';
import {
  NoteDialogComponent,
  NoteDialogSavePayload,
} from '@shared/components/note-dialog/note-dialog.component';

@Component({
  selector: 'app-todos-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTabsModule,
    MatTooltipModule,
    NoteDialogComponent,
    NoteEditButtonComponent,
  ],
  template: `
    <div class="todos-page">
      <header class="todos-page__header">
        <div class="todos-page__header-text">
          <h1 class="todos-page__title">Todos</h1>
          <p class="todos-page__subtitle">Tasks and action items derived from your notes.</p>
        </div>
      </header>

      <!-- Stat Summary Cards -->
      <div class="todos-page__stats">
        <mat-card appearance="outlined" class="stat-card">
          <span class="stat-card__label">Pending</span>
          <span class="stat-card__value stat-card__value--pending">{{
            pendingTodos().length
          }}</span>
        </mat-card>
        <mat-card appearance="outlined" class="stat-card">
          <span class="stat-card__label">Completed</span>
          <span class="stat-card__value stat-card__value--completed">{{
            completedTodos().length
          }}</span>
        </mat-card>
        <mat-card appearance="outlined" class="stat-card">
          <span class="stat-card__label">Total Tasks</span>
          <span class="stat-card__value">{{ allTodos().length }}</span>
        </mat-card>
      </div>

      <!-- Quick Task Input -->
      <mat-card appearance="outlined" class="todos-page__quick-add">
        <div class="quick-add">
          <mat-icon class="quick-add__icon">add_task</mat-icon>
          <input
            type="text"
            class="quick-add__input"
            placeholder="Add a new task... (press Enter to save)"
            [ngModel]="newTaskTitle()"
            (ngModelChange)="newTaskTitle.set($event)"
            (keydown.enter)="createQuickTodo()"
            [disabled]="isCreating()"
          />
          <button
            mat-flat-button
            color="primary"
            (click)="createQuickTodo()"
            [disabled]="!newTaskTitle().trim() || isCreating()"
          >
            Add Task
          </button>
        </div>
      </mat-card>

      <!-- Todos Tabbed View -->
      <mat-tab-group class="todos-page__tabs" animationDuration="200ms">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">check_box_outline_blank</mat-icon>
            <span>Pending ({{ pendingTodos().length }})</span>
          </ng-template>

          <div class="todos-list">
            @if (isLoading()) {
              <div class="todos-page__loading">
                <mat-icon class="spinning">sync</mat-icon>
                <span>Loading tasks...</span>
              </div>
            } @else if (pendingTodos().length === 0) {
              <div class="todos-page__empty">
                <mat-icon class="todos-page__empty-icon">task_alt</mat-icon>
                <p class="todos-page__empty-title">All caught up!</p>
                <p class="todos-page__empty-desc">You have completed all pending tasks.</p>
              </div>
            } @else {
              @for (todo of pendingTodos(); track todo.id) {
                <mat-card appearance="outlined" class="todo-card">
                  <div class="todo-card__main">
                    <mat-checkbox
                      [checked]="false"
                      (change)="toggleTodo(todo)"
                      color="primary"
                      aria-label="Mark task complete"
                    ></mat-checkbox>

                    <div class="todo-card__details" (click)="openDialog(todo)">
                      <span class="todo-card__title">{{ todo.title || 'Untitled task' }}</span>
                      @if (todo.bodyMarkdown) {
                        <p class="todo-card__body">{{ todo.bodyMarkdown }}</p>
                      }

                      @if ((todo.tags?.length ?? 0) > 0) {
                        <mat-chip-set class="todo-card__chips">
                          @for (tag of todo.tags ?? []; track formatTag(tag)) {
                            <mat-chip class="todo-card__chip">#{{ formatTag(tag) }}</mat-chip>
                          }
                        </mat-chip-set>
                      }
                    </div>
                  </div>

                  <div class="todo-card__actions">
                    <app-note-edit-button
                      tooltip="Edit task"
                      ariaLabel="Edit task"
                      (editRequested)="openFullEditor(todo)"
                    />
                    <button
                      mat-icon-button
                      (click)="trashTodo(todo)"
                      matTooltip="Move to trash"
                      aria-label="Trash task"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </mat-card>
              }
            }
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">check_circle</mat-icon>
            <span>Completed ({{ completedTodos().length }})</span>
          </ng-template>

          <div class="todos-list">
            @if (completedTodos().length === 0) {
              <div class="todos-page__empty">
                <mat-icon class="todos-page__empty-icon">check_circle_outline</mat-icon>
                <p class="todos-page__empty-title">No completed tasks yet</p>
                <p class="todos-page__empty-desc">Completed tasks will appear here.</p>
              </div>
            } @else {
              @for (todo of completedTodos(); track todo.id) {
                <mat-card appearance="outlined" class="todo-card todo-card--completed">
                  <div class="todo-card__main">
                    <mat-checkbox
                      [checked]="true"
                      (change)="toggleTodo(todo)"
                      color="primary"
                      aria-label="Mark task pending"
                    ></mat-checkbox>

                    <div class="todo-card__details" (click)="openDialog(todo)">
                      <span class="todo-card__title todo-card__title--done">
                        {{ todo.title || 'Untitled task' }}
                      </span>
                      @if (todo.todoCompletedAtUtc) {
                        <span class="todo-card__done-date">
                          Done {{ todo.todoCompletedAtUtc | date: 'mediumDate' }}
                        </span>
                      }
                    </div>
                  </div>

                  <div class="todo-card__actions">
                    <app-note-edit-button
                      tooltip="Edit task"
                      ariaLabel="Edit task"
                      (editRequested)="openFullEditor(todo)"
                    />
                    <button
                      mat-icon-button
                      (click)="trashTodo(todo)"
                      matTooltip="Delete"
                      aria-label="Trash task"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </mat-card>
              }
            }
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Edit Note Dialog -->
      @if (selectedTodo(); as note) {
        <app-note-dialog
          [note]="note"
          (save)="saveDialog($event)"
          (trash)="trashTodo($event)"
          (close)="selectedTodo.set(null)"
        />
      }
    </div>
  `,
  styles: `
    @use 'mixins' as *;

    .todos-page {
      @include flex-column;
      gap: var(--spacing-lg);
      width: 100%;
      max-width: 960px;
      margin: 0 auto;

      &__header {
        border-bottom: 1px solid var(--color-border-card);
        padding-bottom: var(--spacing-md);
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

      &__stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--spacing-sm);
      }

      &__quick-add {
        border-radius: var(--radius-md);
        background-color: var(--color-bg-surface);
        border-color: var(--color-border-card);
      }

      &__tabs {
        margin-top: var(--spacing-sm);
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
    }

    .stat-card {
      @include flex-column;
      padding: var(--spacing-md);
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);

      &__label {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      &__value {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        margin-top: var(--spacing-2xs);

        &--pending {
          color: var(--color-primary);
        }

        &--completed {
          color: var(--color-success);
        }
      }
    }

    .quick-add {
      @include flex-row;
      align-items: center;
      padding: var(--spacing-sm) var(--spacing-md);
      gap: var(--spacing-sm);

      &__icon {
        color: var(--color-text-muted);
      }

      &__input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: var(--font-size-base);
        color: var(--color-text-primary);
        font-family: inherit;

        &::placeholder {
          color: var(--color-text-muted);
        }
      }
    }

    .tab-icon {
      margin-right: var(--spacing-xs);
      font-size: 18px;
      width: 18px;
      height: 18px;
      vertical-align: middle;
    }

    .todos-list {
      @include flex-column;
      gap: var(--spacing-xs);
      padding: var(--spacing-md) 0;
    }

    .todo-card {
      @include flex-row;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--color-bg-surface-hover);
      }

      &--completed {
        opacity: 0.75;
      }

      &__main {
        @include flex-row;
        align-items: flex-start;
        gap: var(--spacing-sm);
        flex: 1;
      }

      &__details {
        @include flex-column;
        gap: var(--spacing-2xs);
        flex: 1;
        cursor: pointer;
      }

      &__title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);

        &--done {
          text-decoration: line-through;
          color: var(--color-text-muted);
        }
      }

      &__body {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      &__done-date {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      &__chips {
        margin-top: var(--spacing-2xs);
      }

      &__chip {
        font-size: var(--font-size-xs);
        min-height: 24px;
      }

      &__actions {
        @include flex-row;
        gap: var(--spacing-2xs);
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
export class TodosPageComponent implements OnInit {
  private readonly noteService = inject(NoteService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly formatTag = formatTag;
  protected readonly allTodos = signal<NoteSummaryResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isCreating = signal<boolean>(false);
  protected readonly newTaskTitle = signal<string>('');
  protected readonly selectedTodo = signal<NoteResponse | null>(null);

  protected readonly pendingTodos = computed(() =>
    this.allTodos().filter((t) => !t.todoCompletedAtUtc),
  );

  protected readonly completedTodos = computed(() =>
    this.allTodos().filter((t) => !!t.todoCompletedAtUtc),
  );

  public ngOnInit(): void {
    this.loadTodos();
  }

  public loadTodos(): void {
    this.isLoading.set(true);
    this.noteService.getTodoSummary().subscribe({
      next: (summary) => {
        this.allTodos.set([...summary.pendingTodos, ...summary.recentCompletedTodos]);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.notification.showError('Failed to load todos.');
      },
    });
  }

  public createQuickTodo(): void {
    const title = this.newTaskTitle().trim();
    if (!title || this.isCreating()) return;

    this.isCreating.set(true);
    this.noteService
      .create({
        level: 'Note',
        title,
        isTodo: true,
      })
      .subscribe({
        next: (created) => {
          this.allTodos.update((list) => [created, ...list]);
          this.newTaskTitle.set('');
          this.isCreating.set(false);
          this.notification.showSuccess('Task added.');
        },
        error: () => {
          this.isCreating.set(false);
          this.notification.showError('Failed to create task.');
        },
      });
  }

  public toggleTodo(todo: NoteSummaryResponse): void {
    this.noteService.toggleTodo(todo.id).subscribe({
      next: (updated) => {
        this.allTodos.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
        const stateMsg = updated.todoCompletedAtUtc ? 'Task completed' : 'Task marked pending';
        this.notification.showSuccess(stateMsg);
      },
      error: () => {
        this.notification.showError('Failed to update task state.');
      },
    });
  }

  public trashTodo(todo: NoteSummaryResponse): void {
    const originalIndex = this.allTodos().findIndex((t) => t.id === todo.id);
    this.noteService.trash(todo.id).subscribe({
      next: () => {
        this.allTodos.update((list) => list.filter((t) => t.id !== todo.id));
        this.notification.showUndo('Task moved to trash.', () => {
          this.noteService.restore(todo.id).subscribe({
            next: () => {
              this.allTodos.update((list) => {
                if (list.some((t) => t.id === todo.id)) return list;
                const next = [...list];
                if (originalIndex >= 0 && originalIndex <= next.length) {
                  next.splice(originalIndex, 0, todo);
                } else {
                  next.unshift(todo);
                }
                return next;
              });
              this.notification.showSuccess('Task restored.');
            },
            error: () => {
              this.notification.showError('Failed to restore task.');
            },
          });
        });
      },
      error: () => {
        this.notification.showError('Failed to trash task.');
      },
    });
  }

  public openDialog(todo: NoteSummaryResponse): void {
    this.noteService.getById(todo.id).subscribe({
      next: (note) => this.selectedTodo.set(note),
      error: () => this.notification.showError('Failed to load task details.'),
    });
  }

  /** Universal pen: full-page editor with return ticket to Todos. */
  public openFullEditor(todo: NoteSummaryResponse): void {
    void this.router.navigate(['/notes', todo.id], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  public saveDialog(payload: NoteDialogSavePayload): void {
    this.noteService
      .update(payload.id, {
        title: payload.title,
        bodyMarkdown: payload.bodyMarkdown,
        isTodo: payload.isTodo,
        libraryId: payload.libraryId,
        tags: payload.tags,
      })
      .subscribe({
        next: (updated) => {
          this.allTodos.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
          this.selectedTodo.set(null);
          this.notification.showSuccess('Task saved.');
        },
        error: () => {
          this.notification.showError('Failed to save task.');
        },
      });
  }
}
