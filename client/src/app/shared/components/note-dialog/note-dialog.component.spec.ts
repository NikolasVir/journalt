import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LibraryService } from '@core/services/library.service';
import { MarkdownEnhancerService } from '@core/services/markdown-enhancer.service';
import { NoteResponse, NoteSourceResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { NotificationService } from '@core/services/notification.service';
import { NoteDialogComponent } from './note-dialog.component';

interface DialogEvent {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}

describe('NoteDialogComponent', () => {
  let component: NoteDialogComponent;
  let fixture: ComponentFixture<NoteDialogComponent>;
  let closeCount: number;
  let mockNotification: { showSuccess: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn>; showInfo: ReturnType<typeof vi.fn> };

  const note: NoteResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: '123e4567-e89b-12d3-a456-426614174001',
    level: 'Quick',
    title: 'Test note',
    bodyMarkdown: '',
    renderedHtml: '',
    isTodo: false,
    isTrashed: false,
    createdAtUtc: '2026-09-23T17:00:00Z',
    updatedAtUtc: '2026-09-23T17:00:00Z',
    tags: [],
  };

  beforeEach(async () => {
    closeCount = 0;
    mockNotification = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NoteDialogComponent],
      providers: [
        provideRouter([]),
        {
          provide: LibraryService,
          useValue: {
            list: () => of([{ id: 'lib-1', name: 'Work' }]),
          },
        },
        {
          provide: NoteService,
          useValue: {
            renderPreview: () => ({ subscribe: () => undefined }),
            getSources: () => of([]),
            getById: () => of(null),
            addSource: () => of({} as unknown as NoteSourceResponse),
            deleteSource: () => of(void 0),
          },
        },
        {
          provide: MarkdownEnhancerService,
          useValue: { enhance: () => Promise.resolve() },
        },
        {
          provide: NotificationService,
          useValue: mockNotification,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NoteDialogComponent);
    component = fixture.componentInstance;
    component.close.subscribe(() => closeCount++);
    fixture.componentRef.setInput('note', note);
    fixture.detectChanges();
  });

  it('closes after a normal backdrop click', () => {
    const backdrop = document.createElement('div');
    const event = { target: backdrop, currentTarget: backdrop } as DialogEvent;

    component.onBackdropPointerDown(event as PointerEvent);
    component.onBackdropClick(event as MouseEvent);

    expect(closeCount).toBe(1);
  });

  it('stays open when a drag starts inside and ends on the backdrop', () => {
    const panel = document.createElement('div');
    const backdrop = document.createElement('div');

    component.onBackdropPointerDown({
      target: panel,
      currentTarget: backdrop,
    } as unknown as PointerEvent);
    component.onBackdropClick({
      target: backdrop,
      currentTarget: backdrop,
    } as unknown as MouseEvent);

    expect(closeCount).toBe(0);
  });

  it('stays open when a drag starts on the backdrop and ends inside', () => {
    const panel = document.createElement('div');
    const backdrop = document.createElement('div');

    component.onBackdropPointerDown({
      target: backdrop,
      currentTarget: backdrop,
    } as unknown as PointerEvent);
    component.onBackdropClick({
      target: panel,
      currentTarget: backdrop,
    } as unknown as MouseEvent);

    expect(closeCount).toBe(0);
  });

  it('emits libraryId in save payload on close', () => {
    let savedPayload: unknown = null;
    component.save.subscribe((p) => {
      savedPayload = p;
    });

    (component as unknown as { editLibraryId: { set: (v: string) => void } }).editLibraryId.set('lib-123');
    component.onClose();

    expect(savedPayload).toEqual(
      expect.objectContaining({
        id: note.id,
        libraryId: 'lib-123',
      }),
    );
  });

  it('computes selectedLibraryName properly', () => {
    expect(component['selectedLibraryName']()).toBe('Unfiled');

    (component as unknown as { editLibraryId: { set: (v: string) => void } }).editLibraryId.set('lib-1');
    expect(component['selectedLibraryName']()).toBe('Work');

    (component as unknown as { editLibraryId: { set: (v: string) => void } }).editLibraryId.set('non-existent');
    expect(component['selectedLibraryName']()).toBe('Unfiled');
  });

  it('manages sources when addSource and deleteSource are invoked', () => {
    const mockCreatedSource: NoteSourceResponse = {
      id: 'src-1',
      noteId: note.id,
      title: 'Test Citation',
      citation: 'Test Citation',
      url: 'https://example.com',
      createdAtUtc: '2026-09-25T10:00:00Z',
    };

    const noteService = TestBed.inject(NoteService);
    const addSpy = vi.spyOn(noteService, 'addSource').mockReturnValue(of(mockCreatedSource));
    const deleteSpy = vi.spyOn(noteService, 'deleteSource').mockReturnValue(of(void 0));

    component.openAddSource();
    (component as unknown as { newCitation: { set: (v: string) => void } }).newCitation.set('Test Citation');
    (component as unknown as { newUrl: { set: (v: string) => void } }).newUrl.set('example.com');
    component.addSource();

    expect(addSpy).toHaveBeenCalledWith(note.id, {
      title: 'Test Citation',
      citation: 'Test Citation',
      url: 'https://example.com',
    });
    expect(component['sources']()).toEqual([mockCreatedSource]);
    expect(mockNotification.showSuccess).toHaveBeenCalledWith('Source added');

    component.deleteSource('src-1');
    expect(deleteSpy).toHaveBeenCalledWith(note.id, 'src-1');
    expect(component['sources']()).toEqual([]);
    expect(mockNotification.showSuccess).toHaveBeenCalledWith('Source removed');
  });

  it('handles addSource validation errors by setting sourceError and showing toast', () => {
    const noteService = TestBed.inject(NoteService);
    vi.spyOn(noteService, 'addSource').mockReturnValue(
      throwError(() => ({
        status: 400,
        error: {
          errors: {
            Title: ['The Title field is required.'],
          },
        },
      })),
    );

    component.openAddSource();
    (component as unknown as { newCitation: { set: (v: string) => void } }).newCitation.set('Some Book');
    component.addSource();

    expect(component['sourceError']()).toBe('The Title field is required.');
    expect(mockNotification.showError).toHaveBeenCalledWith('The Title field is required.');
    expect(component['isAddingSource']()).toBe(true);

    component.cancelAddSource();
    expect(component['sourceError']()).toBeNull();
    expect(component['isAddingSource']()).toBe(false);
  });

  it('toggles tag collapsibility and calculates tag count correctly', () => {
    expect(component['isTagsExpanded']()).toBe(false);
    component.toggleTags();
    expect(component['isTagsExpanded']()).toBe(true);
    component.toggleTags();
    expect(component['isTagsExpanded']()).toBe(false);

    // Quick level tag count
    (component as unknown as { editTags: { set: (v: string) => void } }).editTags.set('tag1, tag2, tag3');
    expect(component['tagCount']()).toBe(3);

    (component as unknown as { editTags: { set: (v: string) => void } }).editTags.set('');
    expect(component['tagCount']()).toBe(0);
  });

  it('calculates tag count for Journal notes and expands if legacy tags exist', () => {
    const journalNote: NoteResponse = {
      ...note,
      level: 'Journal',
      tags: [
        { tagType: 'Typed', category: 'project', value: 'journalt' },
        { tagType: 'FreeForm', category: null, value: 'legacy-tag' },
      ],
    };

    fixture.componentRef.setInput('note', journalNote);
    fixture.detectChanges();

    expect(component['tagCount']()).toBe(1);
    expect(component['isTagsExpanded']()).toBe(true);
  });

  it('emits trash event with note and close event when onTrash is called', () => {
    fixture.componentRef.setInput('note', note);
    fixture.detectChanges();

    let trashedNote: NoteResponse | undefined;
    let closed = false;
    component.trash.subscribe((n) => {
      trashedNote = n;
    });
    component.close.subscribe(() => {
      closed = true;
    });

    component.onTrash();

    expect(trashedNote).toBe(note);
    expect(closed).toBe(true);
  });
});
