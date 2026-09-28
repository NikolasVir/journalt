import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  private readonly defaultConfig: MatSnackBarConfig = {
    duration: 3500,
    horizontalPosition: 'center',
    verticalPosition: 'bottom'
  };

  public showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      ...this.defaultConfig,
      panelClass: ['snackbar-success']
    });
  }

  public showError(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      ...this.defaultConfig,
      duration: 5000,
      panelClass: ['snackbar-error']
    });
  }

  public showInfo(message: string): void {
    this.snackBar.open(message, 'OK', {
      ...this.defaultConfig
    });
  }

  public showUndo(
    message: string,
    onUndo: () => void,
    action: string = 'Undo',
    duration: number = 5000
  ): MatSnackBarRef<TextOnlySnackBar> {
    const ref = this.snackBar.open(message, action, {
      ...this.defaultConfig,
      duration,
      panelClass: ['snackbar-undo']
    });
    ref.onAction().pipe(take(1)).subscribe(() => {
      onUndo();
    });
    return ref;
  }
}
