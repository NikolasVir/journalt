import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { LoginRequest, RegisterRequest, UserResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
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
}
