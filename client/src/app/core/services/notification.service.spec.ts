import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let actionSubject: Subject<void>;
  let mockSnackBarRef: Partial<MatSnackBarRef<TextOnlySnackBar>>;

  beforeEach(() => {
    actionSubject = new Subject<void>();
    mockSnackBarRef = {
      onAction: () => actionSubject.asObservable(),
    };

    mockSnackBar = {
      open: vi.fn().mockReturnValue(mockSnackBarRef),
    };

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show success notification', () => {
    service.showSuccess('Operation succeeded');
    expect(mockSnackBar.open).toHaveBeenCalledWith('Operation succeeded', 'Close', expect.objectContaining({
      panelClass: ['snackbar-success'],
      duration: 3500,
    }));
  });

  it('should show error notification', () => {
    service.showError('Operation failed');
    expect(mockSnackBar.open).toHaveBeenCalledWith('Operation failed', 'Dismiss', expect.objectContaining({
      panelClass: ['snackbar-error'],
      duration: 5000,
    }));
  });

  it('should show info notification', () => {
    service.showInfo('Information note');
    expect(mockSnackBar.open).toHaveBeenCalledWith('Information note', 'OK', expect.objectContaining({
      duration: 3500,
    }));
  });

  it('should show undo notification and trigger onUndo callback when action is clicked', () => {
    const onUndo = vi.fn();
    service.showUndo('Note moved to trash.', onUndo);

    expect(mockSnackBar.open).toHaveBeenCalledWith('Note moved to trash.', 'Undo', expect.objectContaining({
      panelClass: ['snackbar-undo'],
      duration: 5000,
    }));

    expect(onUndo).not.toHaveBeenCalled();

    // Trigger undo action click
    actionSubject.next();

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('should support custom action label and duration in showUndo', () => {
    const onUndo = vi.fn();
    service.showUndo('Item deleted', onUndo, 'Revert', 8000);

    expect(mockSnackBar.open).toHaveBeenCalledWith('Item deleted', 'Revert', expect.objectContaining({
      panelClass: ['snackbar-undo'],
      duration: 8000,
    }));
  });
});
