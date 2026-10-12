import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { VaultService } from '@core/services/vault.service';

@Component({
  selector: 'app-change-passphrase-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './change-passphrase-dialog.component.html',
  styleUrl: './change-passphrase-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePassphraseDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ChangePassphraseDialogComponent>);
  private readonly vaultService = inject(VaultService);

  public readonly newPassphrase = signal<string>('');
  public readonly confirmPassphrase = signal<string>('');
  public readonly showNewPassword = signal<boolean>(false);
  public readonly showConfirmPassword = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly isSubmitting = signal<boolean>(false);

  public toggleNewPassword(): void {
    this.showNewPassword.update((v) => !v);
  }

  public toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  public async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    const pass = this.newPassphrase().trim();
    const confirm = this.confirmPassphrase().trim();

    if (!pass) {
      this.errorMessage.set('Passphrase cannot be empty.');
      return;
    }

    if (pass.length < 4) {
      this.errorMessage.set('Passphrase must be at least 4 characters long.');
      return;
    }

    if (pass !== confirm) {
      this.errorMessage.set('Passphrases do not match.');
      return;
    }

    this.isSubmitting.set(true);
    const result = await this.vaultService.changePassphrase(pass);
    this.isSubmitting.set(false);

    if (result.success) {
      this.dialogRef.close(true);
    } else {
      this.errorMessage.set(result.error ?? 'Failed to update passphrase.');
    }
  }

  public onCancel(): void {
    this.dialogRef.close(false);
  }
}
