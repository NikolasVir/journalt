import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

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
}
