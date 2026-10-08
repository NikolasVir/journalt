import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

interface RegisterForm {
  username: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
}

const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value as string | undefined;
  const confirmPassword = control.get('confirmPassword')?.value as string | undefined;
  if (!password || !confirmPassword) return null;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly hidePassword = signal<boolean>(true);
  protected readonly hideConfirmPassword = signal<boolean>(true);

  protected readonly form = new FormGroup<RegisterForm>(
    {
      username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(9)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
    },
    { validators: [passwordMatchValidator] }
  );

  public onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const { username, password } = this.form.getRawValue();

    this.authService.register({ userName: username, password }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        const errObj = err?.error;
        let detail = 'Registration failed.';
        if (errObj?.errors) {
          const msgs = Array.isArray(errObj.errors) ? errObj.errors : Object.values(errObj.errors).flat() as string[];
          if (msgs.length > 0) detail = msgs.join(' ');
        } else if (errObj?.detail || errObj?.message || errObj?.title) {
          detail = errObj.detail || errObj.message || errObj.title;
        }
        this.errorMessage.set(detail);
      }
    });
  }
}
