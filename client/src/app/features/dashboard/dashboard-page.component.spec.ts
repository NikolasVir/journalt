import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { NotificationService } from '@core/services/notification.service';
import { LayoutService } from '@layout/layout.service';
import { LibraryService } from '@core/services/library.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  let component: DashboardPageComponent;
  let fixture: ComponentFixture<DashboardPageComponent>;
  let noteServiceMock: Partial<Record<keyof NoteService, any>>;
  let notificationMock: Partial<Record<keyof NotificationService, any>>;

  const mockNotes: NoteResponse[] = [
    {
      id: '1',
      userId: 'user1',
      level: 'Note',
      title: 'Pinned Note A',
      bodyMarkdown: 'Pinned body',
      renderedHtml: '<p>Pinned body</p>',
      isTodo: false,
      isPinned: true,
      pinnedAtUtc: '2026-10-12T10:00:00Z',
      isTrashed: false,
      createdAtUtc: '2026-10-01T00:00:00Z',
      updatedAtUtc: '2026-10-12T10:00:00Z',
    },
    {
      id: '2',
      userId: 'user1',
      level: 'Note',
      title: 'Recent Note B',
      bodyMarkdown: 'Recent body B',
      renderedHtml: '<p>Recent body B</p>',
      isTodo: false,
      isPinned: false,
      isTrashed: false,
      createdAtUtc: '2026-10-02T00:00:00Z',
      updatedAtUtc: '2026-10-12T09:00:00Z',
    },
    {
      id: '3',
      userId: 'user1',
      level: 'Note',
      title: 'Recent Note C',
      bodyMarkdown: 'Recent body C',
      renderedHtml: '<p>Recent body C</p>',
      isTodo: true,
      todoCompletedAtUtc: null,
      isPinned: false,
      isTrashed: false,
      createdAtUtc: '2026-10-03T00:00:00Z',
      updatedAtUtc: '2026-10-12T08:00:00Z',
    },
    {
      id: '4',
      userId: 'user1',
      level: 'Inbox',
      title: 'Inbox Note D',
      bodyMarkdown: 'Quick thought in inbox',
      renderedHtml: '<p>Quick thought</p>',
      isTodo: false,
      isPinned: false,
      isTrashed: false,
      createdAtUtc: '2026-10-04T00:00:00Z',
      updatedAtUtc: '2026-10-12T07:00:00Z',
    },
  ];

  beforeEach(async () => {
    noteServiceMock = {
      list: vi.fn().mockReturnValue(of({ items: mockNotes, totalCount: mockNotes.length })),
      togglePin: vi.fn().mockImplementation((id: string) => {
        const found = mockNotes.find((n) => n.id === id);
        return of({ ...found, isPinned: !found?.isPinned });
      }),
      toggleTodo: vi.fn().mockImplementation((id: string) => {
        const found = mockNotes.find((n) => n.id === id);
        return of({ ...found, todoCompletedAtUtc: found?.todoCompletedAtUtc ? null : new Date().toISOString() });
      }),
      create: vi.fn().mockReturnValue(of(mockNotes[0])),
      update: vi.fn().mockReturnValue(of(mockNotes[0])),
      trash: vi.fn().mockReturnValue(of(true)),
    };

    notificationMock = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showUndo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: NoteService, useValue: noteServiceMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: LibraryService, useValue: { list: () => of([]) } },
        { provide: TypeDefinitionService, useValue: { list: () => of([]) } },
        LayoutService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load notes into separate sections', () => {
    expect(component).toBeTruthy();
    expect(noteServiceMock.list).toHaveBeenCalled();

    // Check computed signals
    expect(component['pinnedNotes']().length).toBe(1);
    expect(component['pinnedNotes']()[0].title).toBe('Pinned Note A');

    // Recent notes should exclude pinned note
    expect(component['recentNotes']().length).toBe(3);
    expect(component['recentNotes']().some((n) => n.isPinned)).toBe(false);

    // Inbox count
    expect(component['inboxNotesCount']()).toBe(1);

    // Pending todos
    expect(component['pendingTodos']().length).toBe(1);
    expect(component['pendingTodos']()[0].title).toBe('Recent Note C');
  });

  it('should render Pinned section, Recently Edited section, Inbox triage, and Pending Tasks widget in DOM', () => {
    const el = fixture.nativeElement as HTMLElement;

    // Inbox triage
    const inboxTriage = el.querySelector('.dashboard__inbox-triage');
    expect(inboxTriage).toBeTruthy();
    expect(inboxTriage?.textContent).toContain('in Inbox awaiting triage');

    // Pinned section
    const pinnedSection = el.querySelector('.dashboard__section--pinned');
    expect(pinnedSection).toBeTruthy();
    expect(pinnedSection?.querySelector('.dashboard__section-title')?.textContent).toContain('Pinned');

    // Pending Tasks section
    const todosSection = el.querySelector('.dashboard__section--todos');
    expect(todosSection).toBeTruthy();
    expect(todosSection?.querySelector('.dashboard__section-title')?.textContent).toContain('Pending Tasks');
  });

  it('should toggle note pin state when handleTogglePin is invoked', () => {
    const target = mockNotes[1]; // unpinned note
    component.handleTogglePin(target);

    expect(noteServiceMock.togglePin).toHaveBeenCalledWith('2');
    expect(notificationMock.showSuccess).toHaveBeenCalledWith('Note pinned to Home.');
  });
});
