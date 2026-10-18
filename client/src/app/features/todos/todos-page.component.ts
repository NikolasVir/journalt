import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
import { of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';

@Component({
  selector: 'app-todos-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
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

      <div class="todos-page__layout">
        <!-- Left Column: Filter & Stats -->
        <aside class="todos-page__sidebar">
          <!-- Show Filter Section -->
          <div class="todos-page__filter-section">
            <h2 class="todos-page__section-title">Show:</h2>
            <mat-button-toggle-group
              hideSingleSelectionIndicator
              [value]="activeFilter()"
              (change)="activeFilter.set($event.value)"
              aria-label="Show tasks"
              class="todos-page__filter-toggle"
            >
              <mat-button-toggle value="pending">Pending</mat-button-toggle>
              <mat-button-toggle value="completed">Completed</mat-button-toggle>
            </mat-button-toggle-group>
          </div>

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
        </aside>

        <!-- Right Column: Search Bar & Todos List -->
        <main class="todos-page__main">
          <!-- Quick Search & Autocomplete Bar -->
          <mat-card
            appearance="outlined"
            class="todos-page__search-card"
            matAutocompleteOrigin
            #searchCardOrigin="matAutocompleteOrigin"
          >
            <div class="search-bar">
              <mat-icon class="search-bar__icon">search</mat-icon>
              <input
                type="text"
                class="search-bar__input"
                placeholder="Search existing notes to add as task..."
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchInput($event)"
                [matAutocomplete]="autoNotes"
                [matAutocompleteConnectedTo]="searchCardOrigin"
                (keydown.enter)="onEnterSearch()"
                [disabled]="isAssigning()"
              />
              @if (isSearching()) {
                <mat-icon class="search-bar__spinner spinning">sync</mat-icon>
              }
              <button
                mat-flat-button
                color="primary"
                type="button"
                class="search-bar__btn"
                (click)="onAddFromSearch()"
                [disabled]="!canAdd() || isAssigning()"
              >
                Add Task
              </button>

              <mat-autocomplete
                #autoNotes="matAutocomplete"
                [displayWith]="displayNoteFn"
                (optionSelected)="onNoteSelected($event)"
                panelClass="todos-search-panel"
              >
                @for (note of noteSuggestions(); track note.id) {
                  <mat-option [value]="note" class="todos-search-option">
                    <div class="search-option-row">
                      <div class="search-option-row__details">
                        <span class="search-option-row__title">{{ note.title || 'Untitled note' }}</span>
                        @if (getNoteSnippet(note)) {
                          <span class="search-option-row__snippet">{{ getNoteSnippet(note) }}</span>
                        }
                      </div>
                      <div class="search-option-row__meta">
                        <span class="search-option-row__level-badge">{{ note.level }}</span>
                        @if (isNotePending(note.id)) {
                          <span class="search-option-row__status search-option-row__status--pending">Pending</span>
                        } @else if (isNoteCompleted(note.id)) {
                          <span class="search-option-row__status search-option-row__status--completed">Completed</span>
                        } @else {
                          <button
                            mat-icon-button
                            type="button"
                            class="search-option-row__quick-add-btn"
                            (click)="onQuickAddClick($event, note)"
                            matTooltip="Add as task"
                            aria-label="Add as task"
                          >
                            <mat-icon>add_task</mat-icon>
                          </button>
                        }
                      </div>
                    </div>
                  </mat-option>
                }
                @if (searchQuery().trim() && noteSuggestions().length === 0 && !isSearching()) {
                  <mat-option disabled class="todos-search-option--empty">
                    <span>No existing notes found</span>
                  </mat-option>
                }
              </mat-autocomplete>
            </div>
          </mat-card>

          <!-- Todos List View -->
          <div class="todos-list">
            @if (isLoading()) {
              <div class="todos-page__loading">
                <mat-icon class="spinning">sync</mat-icon>
                <span>Loading tasks...</span>
              </div>
            } @else if (activeFilter() === 'pending') {
              @if (pendingTodos().length === 0) {
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
            } @else {
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
            }
          </div>
        </main>
      </div>

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

      &__layout {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: var(--spacing-xl);
        align-items: start;

        @media (max-width: 800px) {
          grid-template-columns: 1fr;
          gap: var(--spacing-lg);
        }
      }

      &__sidebar {
        @include flex-column;
        gap: var(--spacing-lg);
        position: sticky;
        top: var(--spacing-md);
      }

      &__stats {
        @include flex-column;
        gap: var(--spacing-xs);

        @media (max-width: 800px) {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-sm);
        }
      }

      &__filter-section {
        @include flex-column;
        gap: var(--spacing-xs);
      }

      &__section-title {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
      }

      &__filter-toggle {
        width: 100%;
        display: flex;
        border-radius: var(--radius-md);
        background-color: var(--color-bg-surface);
        border: 1px solid var(--color-border-card);
        overflow: hidden;

        ::ng-deep .mat-button-toggle {
          flex: 1;
          border: none;
          background: transparent;

          &.mat-button-toggle-checked {
            background-color: var(--color-bg-surface-hover);

            .mat-button-toggle-label-content {
              color: var(--color-primary);
              font-weight: var(--font-weight-medium);
            }
          }

          .mat-button-toggle-label-content {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
            padding: 8px 12px;
            line-height: 1.2;
          }
        }
      }

      &__main {
        @include flex-column;
        gap: var(--spacing-md);
        min-width: 0;
      }

      &__search-card {
        border-radius: var(--radius-md);
        background-color: var(--color-bg-surface);
        border-color: var(--color-border-card);
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
      padding: var(--spacing-sm) var(--spacing-md);
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
        font-size: var(--font-size-xl);
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

    .search-bar {
      @include flex-row;
      align-items: center;
      padding: var(--spacing-sm) var(--spacing-md);
      gap: var(--spacing-sm);
      position: relative;

      &__icon {
        color: var(--color-text-muted);
        flex-shrink: 0;
      }

      &__input {
        flex: 1;
        min-width: 0;
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

      &__spinner {
        color: var(--color-text-muted);
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      &__btn {
        flex-shrink: 0;
        white-space: nowrap;

        @media (max-width: 480px) {
          padding: 0 10px !important;
          font-size: var(--font-size-xs) !important;
        }
      }
    }

    ::ng-deep .mat-mdc-autocomplete-panel.todos-search-panel {
      border-radius: var(--radius-md) !important;
      border: 1px solid var(--color-border-card) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25) !important;
      overflow-x: hidden !important;
    }

    ::ng-deep .todos-search-option {
      height: auto !important;
      min-height: 52px;
      padding: 10px 14px !important;
      line-height: normal !important;

      .mdc-list-item__primary-text {
        width: 100%;
        white-space: normal !important;
      }

      .search-option-row {
        @include flex-row;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-sm);
        width: 100%;

        &__details {
          @include flex-column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }

        &__title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
          line-height: 1.35;
          word-break: break-word;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        &__snippet {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          line-height: 1.25;
          word-break: break-word;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        &__meta {
          @include flex-row;
          align-items: center;
          gap: var(--spacing-xs);
          flex-shrink: 0;
        }

        &__level-badge {
          font-size: 10px;
          text-transform: uppercase;
          padding: 1px 6px;
          border-radius: var(--radius-pill);
          background-color: var(--color-bg-surface-hover);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border-card);
        }

        &__status {
          font-size: 11px;
          font-weight: var(--font-weight-medium);
          padding: 2px 6px;
          border-radius: var(--radius-pill);

          &--pending {
            color: var(--color-primary);
            background-color: rgba(26, 115, 232, 0.12);
          }

          &--completed {
            color: var(--color-success);
            background-color: rgba(19, 115, 51, 0.12);
          }
        }

        &__quick-add-btn {
          width: 32px;
          height: 32px;
          line-height: 32px;
          color: var(--color-primary);

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            line-height: 18px;
          }
        }
      }
    }

    ::ng-deep .todos-search-option--empty {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      font-style: italic;
    }

    .todos-list {
      @include flex-column;
      gap: var(--spacing-xs);
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
export class TodosPageComponent implements OnInit, OnDestroy {
  private readonly noteService = inject(NoteService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly formatTag = formatTag;
  protected readonly allTodos = signal<NoteSummaryResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isAssigning = signal<boolean>(false);
  protected readonly isSearching = signal<boolean>(false);
  protected readonly activeFilter = signal<'pending' | 'completed'>('pending');
  protected readonly searchQuery = signal<string>('');
  protected readonly selectedSearchNote = signal<NoteResponse | null>(null);
  protected readonly noteSuggestions = signal<NoteResponse[]>([]);
  protected readonly selectedTodo = signal<NoteResponse | null>(null);

  private readonly searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  private noteUpdatedSub?: Subscription;

  protected readonly pendingTodos = computed(() =>
    this.allTodos().filter((t) => !t.todoCompletedAtUtc),
  );

  protected readonly completedTodos = computed(() =>
    this.allTodos().filter((t) => !!t.todoCompletedAtUtc),
  );

  protected readonly canAdd = computed(() => {
    return (
      !!this.selectedSearchNote() ||
      (this.searchQuery().trim().length > 0 && this.noteSuggestions().length > 0)
    );
  });

  public ngOnInit(): void {
    this.loadTodos();

    this.noteUpdatedSub = this.noteService.noteUpdated$?.subscribe((updated) => {
      this.allTodos.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    });

    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = query.trim();
          if (!trimmed) {
            this.isSearching.set(false);
            return of({ items: [] as NoteResponse[], totalCount: 0, page: 1, pageSize: 8 });
          }
          this.isSearching.set(true);
          return this.noteService.list({ search: trimmed, isTrashed: false, pageSize: 8 }).pipe(
            catchError(() => {
              this.isSearching.set(false);
              return of({ items: [] as NoteResponse[], totalCount: 0, page: 1, pageSize: 8 });
            }),
            finalize(() => this.isSearching.set(false)),
          );
        }),
      )
      .subscribe((res) => {
        const query = this.searchQuery().trim().toLowerCase();
        const sorted = [...res.items].sort((a, b) => {
          const aTitle = (a.title || '').trim().toLowerCase();
          const bTitle = (b.title || '').trim().toLowerCase();
          const getScore = (title: string, note: NoteResponse): number => {
            if (title === query) return 0;
            if (title.startsWith(query)) return 1;
            if (title.includes(query)) return 2;
            if ((note.summary || '').toLowerCase().includes(query)) return 3;
            return 4;
          };
          const scoreA = getScore(aTitle, a);
          const scoreB = getScore(bTitle, b);
          if (scoreA !== scoreB) return scoreA - scoreB;
          return new Date(b.updatedAtUtc).getTime() - new Date(a.updatedAtUtc).getTime();
        });
        this.noteSuggestions.set(sorted);
      });
  }

  public ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.noteUpdatedSub?.unsubscribe();
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

  public onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.selectedSearchNote.set(null);
    if (!value.trim()) {
      this.noteSuggestions.set([]);
      this.isSearching.set(false);
    } else {
      this.searchSubject.next(value);
    }
  }

  public displayNoteFn = (note: NoteResponse | string | null): string => {
    if (!note) return '';
    return typeof note === 'string' ? note : note.title || 'Untitled note';
  };

  protected getNoteSnippet(note: NoteResponse): string {
    if (!note.bodyMarkdown) return '';
    const lines = note.bodyMarkdown.split('\n').map((l) => l.trim()).filter(Boolean);
    const cleaned = lines.filter((l) => !l.startsWith('#'));
    const firstLine = cleaned[0] || lines[0] || '';
    return firstLine.replace(/^[#*>\-\s]+/, '').trim();
  }

  public onNoteSelected(event: MatAutocompleteSelectedEvent): void {
    const note = event.option.value as NoteResponse;
    if (note) {
      this.selectedSearchNote.set(note);
      this.searchQuery.set(note.title || 'Untitled note');
    }
  }

  public onEnterSearch(): void {
    this.onAddFromSearch();
  }

  public onAddFromSearch(): void {
    const selected = this.selectedSearchNote();
    if (selected) {
      this.addExistingNoteAsTask(selected);
      return;
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return;

    const match =
      this.noteSuggestions().find(
        (n) => (n.title || '').trim().toLowerCase() === query,
      ) || this.noteSuggestions()[0];

    if (match) {
      this.addExistingNoteAsTask(match);
    } else {
      this.notification.showInfo('No matching existing note found to add as task.');
    }
  }

  public onQuickAddClick(event: MouseEvent, note: NoteResponse): void {
    event.stopPropagation();
    event.preventDefault();
    this.addExistingNoteAsTask(note);
  }

  public addExistingNoteAsTask(note: NoteResponse | NoteSummaryResponse): void {
    if (this.isAssigning()) return;

    if (this.isNotePending(note.id)) {
      this.notification.showInfo(`"${note.title || 'Note'}" is already in pending tasks.`);
      return;
    }

    this.isAssigning.set(true);
    this.noteService.toggleTodo(note.id).subscribe({
      next: (updated) => {
        this.allTodos.update((list) => {
          const exists = list.some((t) => t.id === updated.id);
          if (exists) {
            return list.map((t) => (t.id === updated.id ? updated : t));
          }
          return [updated, ...list];
        });
        this.searchQuery.set('');
        this.selectedSearchNote.set(null);
        this.noteSuggestions.set([]);
        this.isAssigning.set(false);
        this.activeFilter.set('pending');
        this.notification.showSuccess(`Added task: ${updated.title || 'Untitled note'}`);
      },
      error: () => {
        this.isAssigning.set(false);
        this.notification.showError('Failed to add note as task.');
      },
    });
  }

  public isNotePending(id: string): boolean {
    return this.pendingTodos().some((t) => t.id === id);
  }

  public isNoteCompleted(id: string): boolean {
    return this.completedTodos().some((t) => t.id === id);
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

