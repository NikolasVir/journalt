import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ApiKeyCreatedResponse, ApiKeyResponse } from '@core/models/api-key.model';
import { ApiKeyService } from '@core/services/api-key.service';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { NotificationService } from '@core/services/notification.service';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatTooltipModule,
    AvatarComponent
  ],
  template: `
    <div class="settings-page">
      <header class="settings-page__header">
        <h1 class="settings-page__title">Settings</h1>
        <p class="settings-page__subtitle">
          Manage your account profile, avatar, credentials, and API access keys.
        </p>
      </header>

      <!-- Account Profile Section -->
      <section class="settings-page__section">
        <mat-card appearance="outlined" class="settings-card">
          <mat-card-header>
            <mat-icon mat-card-avatar class="settings-card__avatar-icon">account_circle</mat-icon>
            <mat-card-title class="settings-card__title">Account Profile</mat-card-title>
            <mat-card-subtitle class="settings-card__subtitle">Your user identity and profile avatar</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content class="settings-card__content">
            @if (authService.currentUser(); as user) {
              <div class="profile-layout">
                <div class="profile-avatar-container">
                  <app-avatar [name]="user.userName" [avatarUrl]="user.avatarUrl" [size]="72" />
                  <div class="profile-avatar-details">
                    <span class="profile-avatar-name">{{ user.userName }}</span>
                    <div class="profile-avatar-actions">
                      <input
                        type="file"
                        #avatarFileInput
                        (change)="onAvatarFileSelected($event)"
                        accept="image/*"
                        style="display: none"
                      />
                      <button
                        mat-stroked-button
                        type="button"
                        (click)="avatarFileInput.click()"
                        [disabled]="isUpdatingAvatar()"
                      >
                        <mat-icon>upload</mat-icon>
                        <span>Upload Photo</span>
                      </button>

                      @if (user.avatarUrl) {
                        <button
                          mat-button
                          color="warn"
                          type="button"
                          (click)="removeAvatar()"
                          [disabled]="isUpdatingAvatar()"
                        >
                          <mat-icon>delete</mat-icon>
                          <span>Remove</span>
                        </button>
                      }
                    </div>
                  </div>
                </div>

                <div class="profile-grid">
                  <div class="profile-field">
                    <span class="profile-field__label">Username</span>
                    <span class="profile-field__value">{{ user.userName }}</span>
                  </div>

                  <div class="profile-field">
                    <span class="profile-field__label">User ID</span>
                    <span class="profile-field__value profile-field__value--mono">{{ user.id }}</span>
                  </div>
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>
      </section>

      <!-- Password & Security Section -->
      <section class="settings-page__section">
        <mat-card appearance="outlined" class="settings-card">
          <mat-card-header>
            <mat-icon mat-card-avatar class="settings-card__avatar-icon">lock</mat-icon>
            <mat-card-title class="settings-card__title">Password & Security</mat-card-title>
            <mat-card-subtitle class="settings-card__subtitle">Change your account password</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content class="settings-card__content">
            <div class="password-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Current Password</mat-label>
                <input
                  matInput
                  [type]="showCurrentPassword() ? 'text' : 'password'"
                  [ngModel]="currentPassword()"
                  (ngModelChange)="currentPassword.set($event)"
                  autocomplete="current-password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="showCurrentPassword.set(!showCurrentPassword())"
                  [attr.aria-label]="showCurrentPassword() ? 'Hide password' : 'Show password'"
                >
                  <mat-icon>{{ showCurrentPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>New Password</mat-label>
                <input
                  matInput
                  [type]="showNewPassword() ? 'text' : 'password'"
                  [ngModel]="newPassword()"
                  (ngModelChange)="newPassword.set($event)"
                  autocomplete="new-password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="showNewPassword.set(!showNewPassword())"
                  [attr.aria-label]="showNewPassword() ? 'Hide password' : 'Show password'"
                >
                  <mat-icon>{{ showNewPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm New Password</mat-label>
                <input
                  matInput
                  [type]="showConfirmPassword() ? 'text' : 'password'"
                  [ngModel]="confirmPassword()"
                  (ngModelChange)="confirmPassword.set($event)"
                  autocomplete="new-password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="showConfirmPassword.set(!showConfirmPassword())"
                  [attr.aria-label]="showConfirmPassword() ? 'Hide password' : 'Show password'"
                >
                  <mat-icon>{{ showConfirmPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (newPassword() && confirmPassword() && newPassword() !== confirmPassword()) {
                  <mat-error>Passwords do not match</mat-error>
                }
              </mat-form-field>

              @if (passwordError(); as pErr) {
                <div class="password-error-banner" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ pErr }}</span>
                </div>
              }
            </div>
          </mat-card-content>

          <mat-card-actions class="settings-card__actions">
            <button
              mat-flat-button
              color="primary"
              [disabled]="!canChangePassword() || isChangingPassword()"
              (click)="changePassword()"
            >
              <mat-icon [class.spinning]="isChangingPassword()">
                {{ isChangingPassword() ? 'sync' : 'lock_reset' }}
              </mat-icon>
              <span>{{ isChangingPassword() ? 'Updating...' : 'Update Password' }}</span>
            </button>
          </mat-card-actions>
        </mat-card>
      </section>

      <!-- API Keys Management Section -->
      <section class="settings-page__section">
        <mat-card appearance="outlined" class="settings-card">
          <mat-card-header>
            <mat-icon mat-card-avatar class="settings-card__avatar-icon">vpn_key</mat-icon>
            <div class="settings-card__header-right">
              <div>
                <mat-card-title class="settings-card__title">API Keys</mat-card-title>
                <mat-card-subtitle class="settings-card__subtitle">
                  Authenticate external AI models, CLIs, or automated services.
                </mat-card-subtitle>
              </div>

              <button
                mat-flat-button
                color="primary"
                (click)="showCreateKey.set(true)"
                class="settings-card__new-btn"
              >
                <mat-icon>add</mat-icon>
                <span>Create API Key</span>
              </button>
            </div>
          </mat-card-header>

          <mat-card-content class="settings-card__content">
            <!-- Plaintext Key Banner after creation -->
            @if (newlyCreatedKey(); as key) {
              <div class="key-banner" role="alert">
                <div class="key-banner__header">
                  <mat-icon class="key-banner__icon">lock_open</mat-icon>
                  <div>
                    <h4 class="key-banner__title">API Key Created: {{ key.name }}</h4>
                    <p class="key-banner__warning">
                      Copy this secret key now. It will not be shown again!
                    </p>
                  </div>
                </div>

                <div class="key-banner__code-box">
                  <code class="key-banner__code">{{ key.plaintextKey }}</code>
                  <button
                    mat-icon-button
                    (click)="copyKey(key.plaintextKey)"
                    matTooltip="Copy to clipboard"
                    aria-label="Copy key"
                  >
                    <mat-icon>content_copy</mat-icon>
                  </button>
                </div>
              </div>
            }

            <!-- Create API Key Form -->
            @if (showCreateKey()) {
              <div class="create-key-form">
                <h4 class="create-key-form__title">Generate New API Key</h4>
                <div class="create-key-form__fields">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Key Name / Description</mat-label>
                    <input
                      matInput
                      placeholder="e.g. Takos Homelab Script, CLI Access"
                      [ngModel]="newKeyName()"
                      (ngModelChange)="newKeyName.set($event)"
                      (keydown.enter)="createKey()"
                    />
                  </mat-form-field>
                </div>

                <div class="create-key-form__actions">
                  <button mat-button (click)="cancelCreateKey()">Cancel</button>
                  <button
                    mat-flat-button
                    color="primary"
                    (click)="createKey()"
                    [disabled]="!newKeyName().trim() || isCreatingKey()"
                  >
                    Generate Key
                  </button>
                </div>
              </div>
            }

            <!-- API Keys List -->
            @if (isLoadingKeys()) {
              <div class="settings-card__loading">
                <mat-icon class="spinning">sync</mat-icon>
                <span>Loading API keys...</span>
              </div>
            } @else if (apiKeys().length === 0) {
              <div class="settings-card__empty">
                <p>No active API keys found. Generate a key to connect external integrations.</p>
              </div>
            } @else {
              <div class="keys-list">
                @for (key of apiKeys(); track key.id) {
                  <div class="key-row">
                    <div class="key-row__info">
                      <div class="key-row__name-line">
                        <span class="key-row__name">{{ key.name }}</span>
                        <code class="key-row__prefix">{{ key.keyPrefix }}...</code>
                      </div>

                      <div class="key-row__meta">
                        <span>Created {{ key.expiresAtUtc ? (key.expiresAtUtc | date:'mediumDate') : 'recently' }}</span>
                        @if (key.lastUsedAtUtc) {
                          <span> • Last used {{ key.lastUsedAtUtc | date:'mediumDate' }}</span>
                        } @else {
                          <span> • Never used</span>
                        }
                      </div>
                    </div>

                    <button
                      mat-button
                      color="warn"
                      (click)="revokeKey(key)"
                      matTooltip="Revoke API key"
                    >
                      <mat-icon>delete</mat-icon>
                      <span>Revoke</span>
                    </button>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>
      </section>
    </div>
  `,
  styles: `
    @use 'mixins' as *;

    .settings-page {
      @include flex-column;
      gap: var(--spacing-lg);
      width: 100%;
      max-width: 960px;
      margin: 0 auto;

      &__header {
        border-bottom: 1px solid var(--color-border-card);
        padding-bottom: var(--spacing-md);
      }

      &__title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      &__subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: var(--spacing-2xs) 0 0 0;
      }

      &__section {
        @include flex-column;
        gap: var(--spacing-sm);
      }
    }

    .settings-card {
      border-radius: var(--radius-md);
      background-color: var(--color-bg-surface);
      border-color: var(--color-border-card);

      &__avatar-icon {
        color: var(--color-primary);
        font-size: 28px;
        width: 28px;
        height: 28px;
        margin-right: var(--spacing-md);
        flex-shrink: 0;
      }

      &__header-right {
        @include flex-row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
      }

      &__title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
      }

      &__subtitle {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }

      &__content {
        padding-top: var(--spacing-md);
      }

      &__actions {
        padding: var(--spacing-sm) var(--spacing-md);
        border-top: 1px solid var(--color-border-card);
        display: flex;
        justify-content: flex-end;
      }

      &__loading,
      &__empty {
        @include flex-column;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-lg) 0;
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
      }
    }

    .profile-layout {
      @include flex-column;
      gap: var(--spacing-lg);
    }

    .profile-avatar-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg);
      flex-wrap: wrap;
      padding-bottom: var(--spacing-md);
      border-bottom: 1px solid var(--color-border-card);
    }

    .profile-avatar-details {
      @include flex-column;
      gap: var(--spacing-xs);
      flex: 1;
      min-width: 240px;
    }

    .profile-avatar-name {
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-primary);
    }

    .profile-avatar-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      flex-wrap: wrap;
    }


    .profile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--spacing-md);
    }

    .profile-field {
      @include flex-column;
      gap: var(--spacing-2xs);

      &__label {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      &__value {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);

        &--mono {
          font-family: monospace;
          font-size: var(--font-size-xs);
        }
      }
    }

    .password-form {
      @include flex-column;
      gap: var(--spacing-md);
      max-width: 480px;
    }

    .password-error-banner {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      color: var(--color-danger);
      background-color: rgba(234, 67, 53, 0.1);
      border: 1px solid var(--color-danger);
      border-radius: var(--radius-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: var(--font-size-sm);
    }

    .key-banner {
      background-color: var(--color-success-bg);
      border: 1px solid var(--color-success);
      border-radius: var(--radius-sm);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-md);
      color: var(--color-success);

      &__header {
        @include flex-row;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-sm);
      }

      &__icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      &__title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        margin: 0;
      }

      &__warning {
        font-size: var(--font-size-xs);
        margin: var(--spacing-2xs) 0 0 0;
      }

      &__code-box {
        @include flex-row;
        align-items: center;
        justify-content: space-between;
        background-color: var(--color-bg-surface);
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--color-success);
        border-radius: var(--radius-xs);
      }

      &__code {
        font-family: monospace;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-bold);
        color: var(--color-success);
        word-break: break-all;
      }
    }

    .create-key-form {
      background-color: var(--color-bg-app, #f8f9fa);
      padding: var(--spacing-md);
      border-radius: var(--radius-sm);
      margin-bottom: var(--spacing-md);
      border: 1px solid var(--color-border-card);

      &__title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        margin: 0 0 var(--spacing-sm) 0;
      }

      &__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-xs);
      }
    }

    .full-width {
      width: 100%;
    }

    .keys-list {
      @include flex-column;
      gap: var(--spacing-xs);
    }

    .key-row {
      @include flex-row;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border-card);

      &__info {
        @include flex-column;
        gap: var(--spacing-2xs);
      }

      &__name-line {
        @include flex-row;
        align-items: center;
        gap: var(--spacing-sm);
      }

      &__name {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      &__prefix {
        font-family: monospace;
        font-size: var(--font-size-xs);
        background-color: var(--color-bg-surface);
        padding: var(--spacing-2xs) var(--spacing-xs);
        border-radius: var(--radius-xs);
        border: 1px solid var(--color-border-card);
      }

      &__meta {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
      }
    }

    .spinning {
      animation: spin 1.2s linear infinite;
    }

    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly userService = inject(UserService);
  private readonly apiKeyService = inject(ApiKeyService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  // Avatar Management State
  protected readonly isUpdatingAvatar = signal<boolean>(false);

  // Password Management State
  protected readonly currentPassword = signal<string>('');
  protected readonly newPassword = signal<string>('');
  protected readonly confirmPassword = signal<string>('');
  protected readonly showCurrentPassword = signal<boolean>(false);
  protected readonly showNewPassword = signal<boolean>(false);
  protected readonly showConfirmPassword = signal<boolean>(false);
  protected readonly isChangingPassword = signal<boolean>(false);
  protected readonly passwordError = signal<string | null>(null);

  protected readonly canChangePassword = computed(() => {
    const current = this.currentPassword().trim();
    const next = this.newPassword().trim();
    const confirm = this.confirmPassword().trim();
    return current.length > 0 && next.length >= 9 && next === confirm;
  });

  // API Keys State
  protected readonly apiKeys = signal<ApiKeyResponse[]>([]);
  protected readonly isLoadingKeys = signal<boolean>(false);
  protected readonly isCreatingKey = signal<boolean>(false);

  protected readonly showCreateKey = signal<boolean>(false);
  protected readonly newKeyName = signal<string>('');
  protected readonly newlyCreatedKey = signal<ApiKeyCreatedResponse | null>(null);

  public ngOnInit(): void {
    this.loadKeys();
  }

  public loadKeys(): void {
    this.isLoadingKeys.set(true);
    this.apiKeyService.getAll().subscribe({
      next: (keys) => {
        this.apiKeys.set(keys);
        this.isLoadingKeys.set(false);
      },
      error: () => {
        this.isLoadingKeys.set(false);
        this.notification.showError('Failed to load API keys.');
      }
    });
  }

  public onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';

    if (!file.type.startsWith('image/')) {
      this.notification.showError('Please select a valid image file.');
      return;
    }

    this.isUpdatingAvatar.set(true);
    this.resizeImage(file, 256)
      .then((dataUrl) => {
        this.userService.updateAvatar(dataUrl).subscribe({
          next: (user) => {
            this.authService.updateCurrentUser(user);
            this.isUpdatingAvatar.set(false);
            this.notification.showSuccess('Avatar updated successfully.');
          },
          error: () => {
            this.isUpdatingAvatar.set(false);
            this.notification.showError('Failed to upload avatar.');
          }
        });
      })
      .catch(() => {
        this.isUpdatingAvatar.set(false);
        this.notification.showError('Failed to process image.');
      });
  }



  public removeAvatar(): void {
    if (this.isUpdatingAvatar()) return;

    this.isUpdatingAvatar.set(true);
    this.userService.updateAvatar(null).subscribe({
      next: (user) => {
        this.authService.updateCurrentUser(user);
        this.isUpdatingAvatar.set(false);
        this.notification.showSuccess('Avatar removed.');
      },
      error: () => {
        this.isUpdatingAvatar.set(false);
        this.notification.showError('Failed to remove avatar.');
      }
    });
  }

  public changePassword(): void {
    if (!this.canChangePassword() || this.isChangingPassword()) return;

    this.isChangingPassword.set(true);
    this.passwordError.set(null);

    this.authService.changePassword({
      currentPassword: this.currentPassword(),
      newPassword: this.newPassword()
    }).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.notification.showSuccess('Password updated successfully.');
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        const errObj = err?.error;
        let detail = 'Failed to update password. Check your current password.';
        if (errObj?.errors) {
          const msgs = Object.values(errObj.errors).flat() as string[];
          if (msgs.length > 0) detail = msgs.join(' ');
        } else if (errObj?.detail || errObj?.message || errObj?.title) {
          detail = errObj.detail || errObj.message || errObj.title;
        }
        this.passwordError.set(detail);
        this.notification.showError(detail);
      }
    });
  }

  private resizeImage(file: File, maxDim = 256): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  public cancelCreateKey(): void {
    this.showCreateKey.set(false);
    this.newKeyName.set('');
  }

  public createKey(): void {
    const name = this.newKeyName().trim();
    if (!name || this.isCreatingKey()) return;

    this.isCreatingKey.set(true);
    this.apiKeyService.create({ name }).subscribe({
      next: (created) => {
        this.newlyCreatedKey.set(created);
        this.cancelCreateKey();
        this.isCreatingKey.set(false);
        this.notification.showSuccess(`API key "${name}" created.`);
        this.loadKeys();
      },
      error: () => {
        this.isCreatingKey.set(false);
        this.notification.showError('Failed to create API key.');
      }
    });
  }

  public copyKey(key: string): void {
    void navigator.clipboard.writeText(key).then(() => {
      this.notification.showSuccess('API key copied to clipboard.');
    });
  }

  public revokeKey(key: ApiKeyResponse): void {
    if (!confirm(`Revoke API key "${key.name}"? Applications using this key will immediately lose access.`)) {
      return;
    }

    this.apiKeyService.revoke(key.id).subscribe({
      next: () => {
        this.apiKeys.update((list) => list.filter((k) => k.id !== key.id));
        this.notification.showSuccess(`API key "${key.name}" revoked.`);
      },
      error: () => {
        this.notification.showError('Failed to revoke API key.');
      }
    });
  }

  public onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/auth/login']);
      }
    });
  }
}
