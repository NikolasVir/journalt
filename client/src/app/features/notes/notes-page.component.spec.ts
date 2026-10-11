import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { LibraryService } from '@core/services/library.service';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import { LayoutService } from '@layout/layout.service';
import { NotesPageComponent } from './notes-page.component';

describe('NotesPageComponent', () => {
  let component: NotesPageComponent;
  let fixture: ComponentFixture<NotesPageComponent>;
  let mockNoteService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    trash: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    toggleTodo: ReturnType<typeof vi.fn>;
    promote: ReturnType<typeof vi.fn>;
  };
  let mockLibraryService: {
    getLibraryName: ReturnType<typeof vi.fn>;
    loadLibraries: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let mockNotification: {
    showSuccess: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
    showUndo: ReturnType<typeof vi.fn>;
  };

  const sampleNotes: NoteResponse[] = [
    {
      id: 'n-1',
      userId: 'u-1',
      level: 'Inbox',
      title: 'Triage capture',
      bodyMarkdown: 'Inbox content',
      renderedHtml: '<p>Inbox content</p>',
      libraryId: 'lib-1',
      isTodo: false,
      isTrashed: false,
      createdAtUtc: '2026-10-10T10:00:00Z',
      updatedAtUtc: '2026-10-10T10:00:00Z',
      tags: []
    },
    {
      id: 'n-2',
      userId: 'u-1',
      level: 'Note',
      title: 'Durable note',
      bodyMarkdown: 'Note content',
      renderedHtml: '<p>Note content</p>',
      libraryId: 'lib-1',
      isTodo: false,
      isTrashed: false,
      createdAtUtc: '2026-10-09T10:00:00Z',
      updatedAtUtc: '2026-10-09T10:00:00Z',
      tags: []
    },
    {
      id: 'n-3',
      userId: 'u-1',
      level: 'Journal',
      title: 'Structured Journal',
      bodyMarkdown: 'Journal content',
      renderedHtml: '<p>Journal content</p>',
      libraryId: 'lib-1',
      isTodo: false,
      isTrashed: false,
      createdAtUtc: '2026-10-08T10:00:00Z',
      updatedAtUtc: '2026-10-08T10:00:00Z',
      tags: []
    }
  ];

  beforeEach(async () => {
    mockNoteService = {
      list: vi.fn().mockReturnValue(of({ items: sampleNotes, totalCount: 3, page: 1, pageSize: 100 })),
      create: vi.fn().mockReturnValue(of(sampleNotes[0])),
      update: vi.fn().mockReturnValue(of(sampleNotes[0])),
      trash: vi.fn().mockReturnValue(of(undefined)),
      restore: vi.fn().mockReturnValue(of(undefined)),
      toggleTodo: vi.fn().mockReturnValue(of(sampleNotes[0])),
      promote: vi.fn().mockReturnValue(of(sampleNotes[0]))
    };

    mockLibraryService = {
      getLibraryName: vi.fn().mockImplementation((id: string) => (id === 'lib-1' ? 'Work' : undefined)),
      loadLibraries: vi.fn(),
      list: vi.fn().mockReturnValue(of([]))
    };

    mockNotification = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showUndo: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [NotesPageComponent],
      providers: [
        provideRouter([]),
        LayoutService,
        { provide: NoteService, useValue: mockNoteService },
        { provide: LibraryService, useValue: mockLibraryService },
        { provide: TypeDefinitionService, useValue: { list: () => of([]) } },
        { provide: NotificationService, useValue: mockNotification }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotesPageComponent);
    component = fixture.componentInstance;
  });

  it('renders normal tab title and calls NoteService.list with level', () => {
    fixture.componentRef.setInput('level', 'Inbox');
    fixture.detectChanges();

    expect(component.pageTitle()).toBe('Inbox');
    expect(mockNoteService.list).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'Inbox' })
    );

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.notes-page__title')?.textContent).toContain('Inbox');
    expect(compiled.querySelector('.library-subtabs-bar')).toBeNull();
  });

  it('renders library title and sub-tab pills when viewing a library', () => {
    fixture.componentRef.setInput('libraryId', 'lib-1');
    fixture.detectChanges();

    expect(component.pageTitle()).toBe('Work');
    expect(mockLibraryService.loadLibraries).toHaveBeenCalled();
    expect(mockNoteService.list).toHaveBeenCalledWith(
      expect.objectContaining({ libraryId: 'lib-1' })
    );

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.notes-page__title')?.textContent).toContain('Work');

    const subtabsBar = compiled.querySelector('.library-subtabs-bar');
    expect(subtabsBar).toBeTruthy();

    const pills = compiled.querySelectorAll('.library-subtab-pill');
    expect(pills.length).toBe(4); // All, Inbox, Notes, Journals
  });

  it('filters library notes via sub-tab pills without reloading from server', () => {
    fixture.componentRef.setInput('libraryId', 'lib-1');
    fixture.detectChanges();

    // Default 'All'
    expect(component.activeSubTab()).toBe('All');
    expect(component['filteredNotes']().length).toBe(3);

    // Switch to Inbox
    component.activeSubTab.set('Inbox');
    fixture.detectChanges();
    expect(component['filteredNotes']().length).toBe(1);
    expect(component['filteredNotes']()[0].level).toBe('Inbox');

    // Switch to Note
    component.activeSubTab.set('Note');
    fixture.detectChanges();
    expect(component['filteredNotes']().length).toBe(1);
    expect(component['filteredNotes']()[0].level).toBe('Note');

    // Switch to Journal
    component.activeSubTab.set('Journal');
    fixture.detectChanges();
    expect(component['filteredNotes']().length).toBe(1);
    expect(component['filteredNotes']()[0].level).toBe('Journal');
  });

  it('calculates correct subTabCounts for the library', () => {
    fixture.componentRef.setInput('libraryId', 'lib-1');
    fixture.detectChanges();

    const counts = component['subTabCounts']();
    expect(counts.all).toBe(3);
    expect(counts.inbox).toBe(1);
    expect(counts.note).toBe(1);
    expect(counts.journal).toBe(1);
  });

  it('supports sorting toggle and reloads notes', () => {
    fixture.componentRef.setInput('libraryId', 'lib-1');
    fixture.detectChanges();

    const initialDir = component.sortDirection();
    mockNoteService.list.mockClear();

    component.toggleSortDirection();
    fixture.detectChanges();

    expect(component.sortDirection()).not.toBe(initialDir);
    expect(mockNoteService.list).toHaveBeenCalledTimes(1);
  });
});
