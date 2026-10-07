import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

interface LoginForm {
  userName: FormControl<string>;
  password: FormControl<string>;
  rememberMe: FormControl<boolean>;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly hidePassword = signal<boolean>(true);

  protected readonly form = new FormGroup<LoginForm>({
    userName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    rememberMe: new FormControl(false, { nonNullable: true })
  });

  public onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const { userName, password, rememberMe } = this.form.getRawValue();

    this.authService.login({ userName, password, rememberMe }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err: { error?: { detail?: string; title?: string; errors?: Record<string, string[]> } }) => {
        this.isSubmitting.set(false);
        const errObj = err.error;
        let detail = 'Invalid username or password.';
        if (errObj?.detail) {
          detail = errObj.detail;
        } else if (errObj?.errors) {
          const firstKey = Object.keys(errObj.errors)[0];
          detail = errObj.errors[firstKey]?.[0] ?? errObj.title ?? detail;
        } else if (errObj?.title) {
          detail = errObj.title;
        }
        this.errorMessage.set(detail);
      }
    });
  }
}
