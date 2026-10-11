import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LibraryTreeResponse } from '@core/models/library.model';
import { LibraryService } from '@core/services/library.service';
import { NotificationService } from '@core/services/notification.service';
import { LibrariesPageComponent } from './libraries-page.component';

describe('LibrariesPageComponent', () => {
  let component: LibrariesPageComponent;
  let fixture: ComponentFixture<LibrariesPageComponent>;
  let mockLibraryService: {
    getTree: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockNotification: {
    showSuccess: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
  };

  const sampleTree: LibraryTreeResponse[] = [
    {
      id: 'lib-1',
      name: 'Work',
      createdAtUtc: '2026-10-01T12:00:00Z',
      updatedAtUtc: '2026-10-01T12:00:00Z',
      children: [],
      notesCount: 3
    },
    {
      id: 'lib-2',
      name: 'Empty Folder',
      createdAtUtc: '2026-10-01T12:00:00Z',
      updatedAtUtc: '2026-10-01T12:00:00Z',
      children: [],
      notesCount: 0
    },
    {
      id: 'lib-3',
      name: 'Parent Folder',
      createdAtUtc: '2026-10-01T12:00:00Z',
      updatedAtUtc: '2026-10-01T12:00:00Z',
      children: [
        {
          id: 'lib-3-1',
          name: 'Child Folder',
          createdAtUtc: '2026-10-01T12:00:00Z',
          updatedAtUtc: '2026-10-01T12:00:00Z',
          children: [],
          notesCount: 0
        }
      ],
      notesCount: 0
    }
  ];

  beforeEach(async () => {
    mockLibraryService = {
      getTree: vi.fn().mockReturnValue(of(sampleTree)),
      list: vi.fn().mockReturnValue(of([])),
      create: vi.fn().mockReturnValue(of({ id: 'new-id', name: 'New Lib' })),
      rename: vi.fn().mockReturnValue(of({ id: 'lib-1', name: 'Renamed Lib' })),
      delete: vi.fn().mockReturnValue(of(undefined))
    };

    mockNotification = {
      showSuccess: vi.fn(),
      showError: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [LibrariesPageComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: LibraryService, useValue: mockLibraryService },
        { provide: NotificationService, useValue: mockNotification }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LibrariesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component and loads tree on init', () => {
    expect(component).toBeTruthy();
    expect(mockLibraryService.getTree).toHaveBeenCalled();
  });

  it('shows error notification and blocks delete when library contains notes', () => {
    const libWithNotes = sampleTree[0];
    component.deleteLibrary(libWithNotes);

    expect(mockNotification.showError).toHaveBeenCalledWith(
      'Libraries that contain notes cannot be deleted.'
    );
    expect(mockLibraryService.delete).not.toHaveBeenCalled();
  });

  it('shows error notification and blocks delete when library has subfolders', () => {
    const parentLib = sampleTree[2];
    component.deleteLibrary(parentLib);

    expect(mockNotification.showError).toHaveBeenCalledWith(
      'Libraries that have subfolders cannot be deleted.'
    );
    expect(mockLibraryService.delete).not.toHaveBeenCalled();
  });

  it('deletes empty library after user confirms', () => {
    const emptyLib = sampleTree[1];
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteLibrary(emptyLib);

    expect(mockLibraryService.delete).toHaveBeenCalledWith('lib-2');
    expect(mockNotification.showSuccess).toHaveBeenCalledWith('Library "Empty Folder" deleted.');
  });

  it('does not delete when user cancels confirmation', () => {
    const emptyLib = sampleTree[1];
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteLibrary(emptyLib);

    expect(mockLibraryService.delete).not.toHaveBeenCalled();
    expect(mockNotification.showSuccess).not.toHaveBeenCalled();
  });

  it('shows error notification when backend rejects delete', () => {
    const emptyLib = sampleTree[1];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockLibraryService.delete.mockReturnValue(
      throwError(() => ({ error: { detail: 'Libraries that contain notes cannot be deleted.' } }))
    );

    component.deleteLibrary(emptyLib);

    expect(mockLibraryService.delete).toHaveBeenCalledWith('lib-2');
    expect(mockNotification.showError).toHaveBeenCalledWith(
      'Libraries that contain notes cannot be deleted.'
    );
  });
});
