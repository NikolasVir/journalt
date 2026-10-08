import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NoteService } from '@core/services/note.service';
import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { NoteSharesResponse, NoteShareUserDto } from '@core/models/note.model';
import { UserSummaryResponse } from '@core/models/auth.model';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface ShareDialogData {
  noteId: string;
  noteTitle: string;
}

export interface ShareDialogResult {
  updated?: boolean;
  leftNote?: boolean;
}

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatTooltipModule,
  ],
  templateUrl: './share-dialog.component.html',
  styleUrl: './share-dialog.component.scss',
})
export class ShareDialogComponent implements OnInit {
  private readonly data: ShareDialogData = inject(MAT_DIALOG_DATA);
  public readonly dialogRef = inject(MatDialogRef<ShareDialogComponent, ShareDialogResult>);
  private readonly noteService = inject(NoteService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);

  public readonly noteTitle = signal<string>(this.data.noteTitle || 'Untitled Note');
  public readonly isLoading = signal<boolean>(true);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly sharesData = signal<NoteSharesResponse | null>(null);
  public readonly error = signal<string | null>(null);

  public readonly userSearchControl = new FormControl<string | UserSummaryResponse>('');
  public readonly userSuggestions = signal<UserSummaryResponse[]>([]);
  public readonly isSearchingUsers = signal<boolean>(false);

  private hasModifiedShares = false;

  public ngOnInit(): void {
    this.loadShares();

    this.userSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged()
      )
      .subscribe((val) => {
        const query = typeof val === 'string' ? val.trim() : val?.userName ?? '';
        if (query.length > 0) {
          this.searchUsers(query);
        } else {
          this.userSuggestions.set([]);
        }
      });
  }

  public loadShares(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.noteService.getShares(this.data.noteId).subscribe({
      next: (res) => {
        this.sharesData.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err.error?.detail || err.message || 'Failed to load sharing information.';
        this.error.set(detail);
      },
    });
  }

  public searchUsers(query: string): void {
    this.isSearchingUsers.set(true);
    this.userService.search(query).subscribe({
      next: (users) => {
        // Exclude users already shared with and owner
        const currentShares = this.sharesData();
        const existingIds = new Set<string>();
        if (currentShares) {
          existingIds.add(currentShares.ownerId);
          currentShares.shares.forEach((s) => existingIds.add(s.userId));
        }

        const filtered = users.filter((u) => !existingIds.has(u.id));
        this.userSuggestions.set(filtered);
        this.isSearchingUsers.set(false);
      },
      error: () => {
        this.isSearchingUsers.set(false);
      },
    });
  }

  public displayUserFn(user: UserSummaryResponse | string | null): string {
    if (!user) return '';
    return typeof user === 'string' ? user : user.userName;
  }

  public onUserSelected(event: MatAutocompleteSelectedEvent): void {
    const selected: UserSummaryResponse = event.option.value;
    this.userSearchControl.setValue(selected);
  }

  public shareWithUser(): void {
    const val = this.userSearchControl.value;
    if (!val) return;

    let targetUserName: string | undefined;
    let targetUserId: string | undefined;

    if (typeof val === 'string') {
      targetUserName = val.trim();
    } else {
      targetUserId = val.id;
      targetUserName = val.userName;
    }

    if (!targetUserName && !targetUserId) return;

    this.isSubmitting.set(true);
    this.error.set(null);

    this.noteService
      .share(this.data.noteId, {
        userId: targetUserId,
        userName: targetUserName,
      })
      .subscribe({
        next: (updatedShares) => {
          this.isSubmitting.set(false);
          this.hasModifiedShares = true;
          this.sharesData.set(updatedShares);
          this.userSearchControl.reset('');
          this.userSuggestions.set([]);
          this.notification.showSuccess(`Shared note with ${targetUserName}`);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const detail = err.error?.detail || err.message || 'Failed to share note.';
          this.error.set(detail);
          this.notification.showError(detail);
        },
      });
  }

  public removeShare(share: NoteShareUserDto): void {
    this.isSubmitting.set(true);
    this.error.set(null);

    this.noteService.removeShare(this.data.noteId, share.userId).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.hasModifiedShares = true;
        const current = this.sharesData();
        if (current) {
          this.sharesData.set({
            ...current,
            shares: current.shares.filter((s) => s.userId !== share.userId),
          });
        }
        this.notification.showSuccess(`Removed access for ${share.userName}`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const detail = err.error?.detail || err.message || 'Failed to remove user.';
        this.error.set(detail);
        this.notification.showError(detail);
      },
    });
  }

  public leaveNote(): void {
    const current = this.sharesData();
    const currentUserId = this.authService.currentUser()?.id;
    if (!current || !currentUserId) return;

    this.isSubmitting.set(true);
    this.error.set(null);

    this.noteService.removeShare(this.data.noteId, currentUserId).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.notification.showInfo('You have left this note.');
        this.dialogRef.close({ updated: true, leftNote: true });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const detail = err.error?.detail || err.message || 'Failed to leave note.';
        this.error.set(detail);
        this.notification.showError(detail);
      },
    });
  }

  public onClose(): void {
    this.dialogRef.close({ updated: this.hasModifiedShares });
  }
}
