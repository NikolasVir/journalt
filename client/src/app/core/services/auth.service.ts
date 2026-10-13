import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ChangePasswordRequest, LoginRequest, RegisterRequest, UserResponse } from '../models/auth.model';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly themeService = inject(ThemeService);
  private readonly baseUrl = '/api/auth';

  private readonly userState = signal<UserResponse | null>(null);
  private readonly loadingState = signal<boolean>(false);

  public readonly currentUser: Signal<UserResponse | null> = this.userState.asReadonly();
  public readonly isAuthenticated: Signal<boolean> = computed(() => this.userState() !== null);
  public readonly isLoading: Signal<boolean> = this.loadingState.asReadonly();

  public getCsrfToken(): Observable<{ token: string }> {
    return this.http.get<{ token: string }>(`${this.baseUrl}/csrf`);
  }

  public getMe(): Observable<UserResponse> {
    this.loadingState.set(true);
    return this.http.get<UserResponse>(`${this.baseUrl}/me`).pipe(
      tap({
        next: (user: UserResponse) => {
          this.userState.set(user);
          this.applyAccent(user);
          this.loadingState.set(false);
        },
        error: () => {
          this.userState.set(null);
          this.loadingState.set(false);
        }
      })
    );
  }

  public login(request: LoginRequest): Observable<UserResponse> {
    this.loadingState.set(true);
    return this.http.post<UserResponse>(`${this.baseUrl}/login`, request).pipe(
      tap({
        next: (user: UserResponse) => {
          this.userState.set(user);
          this.applyAccent(user);
          this.loadingState.set(false);
        },
        error: () => this.loadingState.set(false)
      })
    );
  }

  public register(request: RegisterRequest): Observable<UserResponse> {
    this.loadingState.set(true);
    return this.http.post<UserResponse>(`${this.baseUrl}/register`, request).pipe(
      tap({
        next: (user: UserResponse) => {
          this.userState.set(user);
          this.applyAccent(user);
          this.loadingState.set(false);
        },
        error: () => this.loadingState.set(false)
      })
    );
  }

  public logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {}).pipe(
      tap(() => this.userState.set(null))
    );
  }

  public changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/change-password`, request);
  }

  public updateCurrentUser(user: UserResponse): void {
    // Only refreshes the cached user (e.g. after an avatar change). The accent
    // stays under ThemeService's control so a lagging save response can never
    // revert a newer local colour choice.
    this.userState.set(user);
  }

  /** Applies the account's saved accent colour app-wide. */
  private applyAccent(user: UserResponse): void {
    this.themeService.setAccent(user.accentColor ?? null);
  }
}
