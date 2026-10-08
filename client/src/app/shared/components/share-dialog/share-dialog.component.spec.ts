import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShareDialogComponent, ShareDialogData } from './share-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoteService } from '@core/services/note.service';
import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { of } from 'rxjs';
import { signal } from '@angular/core';

describe('ShareDialogComponent', () => {
  let component: ShareDialogComponent;
  let fixture: ComponentFixture<ShareDialogComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockDialogData: ShareDialogData = {
    noteId: 'note-123',
    noteTitle: 'Test Note Title',
  };

  const mockNoteService = {
    getShares: vi.fn(),
    share: vi.fn(),
    removeShare: vi.fn(),
  };

  const mockUserService = {
    search: vi.fn(),
  };

  const mockAuthService = {
    currentUser: signal({ id: 'user-owner-1', userName: 'alice' }),
  };

  const mockNotificationService = {
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
  };

  beforeEach(async () => {
    mockNoteService.getShares.mockReturnValue(
      of({
        noteId: 'note-123',
        ownerId: 'user-owner-1',
        ownerUserName: 'alice',
        isOwner: true,
        shares: [
          { userId: 'user-bob-2', userName: 'bob', sharedAtUtc: '2026-10-08T12:00:00Z' },
        ],
      })
    );

    mockUserService.search.mockReturnValue(
      of([
        { id: 'user-bob-2', userName: 'bob' },
        { id: 'user-charlie-3', userName: 'charlie' },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [ShareDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: NoteService, useValue: mockNoteService },
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load sharing info', () => {
    expect(component).toBeTruthy();
    expect(mockNoteService.getShares).toHaveBeenCalledWith('note-123');
    expect(component.isLoading()).toBe(false);
    expect(component.sharesData()?.ownerUserName).toBe('alice');
    expect(component.sharesData()?.shares.length).toBe(1);
    expect(component.sharesData()?.shares[0].userName).toBe('bob');
  });

  it('should filter out owner and already-shared users during search', () => {
    component.searchUsers('charlie');
    expect(mockUserService.search).toHaveBeenCalledWith('charlie');
    // Bob is already in shares, so suggestions should only contain Charlie
    expect(component.userSuggestions()).toEqual([
      { id: 'user-charlie-3', userName: 'charlie' },
    ]);
  });

  it('should share with user when submit is clicked', () => {
    mockNoteService.share.mockReturnValue(
      of({
        noteId: 'note-123',
        ownerId: 'user-owner-1',
        ownerUserName: 'alice',
        isOwner: true,
        shares: [
          { userId: 'user-bob-2', userName: 'bob', sharedAtUtc: '2026-10-08T12:00:00Z' },
          { userId: 'user-charlie-3', userName: 'charlie', sharedAtUtc: '2026-10-08T12:05:00Z' },
        ],
      })
    );

    component.userSearchControl.setValue({ id: 'user-charlie-3', userName: 'charlie' });
    component.shareWithUser();

    expect(mockNoteService.share).toHaveBeenCalledWith('note-123', {
      userId: 'user-charlie-3',
      userName: 'charlie',
    });
    expect(mockNotificationService.showSuccess).toHaveBeenCalledWith('Shared note with charlie');
    expect(component.sharesData()?.shares.length).toBe(2);
  });

  it('should remove collaborator when remove button is clicked', () => {
    mockNoteService.removeShare.mockReturnValue(of(undefined));

    const bobShare = { userId: 'user-bob-2', userName: 'bob', sharedAtUtc: '2026-10-08T12:00:00Z' };
    component.removeShare(bobShare);

    expect(mockNoteService.removeShare).toHaveBeenCalledWith('note-123', 'user-bob-2');
    expect(mockNotificationService.showSuccess).toHaveBeenCalledWith('Removed access for bob');
    expect(component.sharesData()?.shares.length).toBe(0);
  });

  it('should allow collaborator to leave note', () => {
    // Switch component state to collaborator
    mockAuthService.currentUser.set({ id: 'user-bob-2', userName: 'bob' });
    component.sharesData.set({
      noteId: 'note-123',
      ownerId: 'user-owner-1',
      ownerUserName: 'alice',
      isOwner: false,
      shares: [{ userId: 'user-bob-2', userName: 'bob', sharedAtUtc: '2026-10-08T12:00:00Z' }],
    });

    mockNoteService.removeShare.mockReturnValue(of(undefined));

    component.leaveNote();

    expect(mockNoteService.removeShare).toHaveBeenCalledWith('note-123', 'user-bob-2');
    expect(mockNotificationService.showInfo).toHaveBeenCalledWith('You have left this note.');
    expect(mockDialogRef.close).toHaveBeenCalledWith({ updated: true, leftNote: true });
  });
});
