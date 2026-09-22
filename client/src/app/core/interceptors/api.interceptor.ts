import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase());
  const xsrfToken = getCookie('XSRF-TOKEN');

  if (isMutating && !xsrfToken && !req.url.includes('/api/auth/csrf') && !req.url.includes('/api/auth/login')) {
    const authService = inject(AuthService);
    return authService.getCsrfToken().pipe(
      switchMap(() => {
        const freshToken = getCookie('XSRF-TOKEN');
        const headers = freshToken ? req.headers.set('X-XSRF-TOKEN', freshToken) : req.headers;
        const cloned = req.clone({ headers, withCredentials: true });
        return next(cloned);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/csrf')) {
          void router.navigate(['/auth/login']);
        }
        return throwError(() => error);
      })
    );
  }

  let headers = req.headers;
  if (xsrfToken && isMutating) {
    headers = headers.set('X-XSRF-TOKEN', xsrfToken);
  }

  // Ensure credentials (cookies) are sent with every request
  const cloned = req.clone({
    headers,
    withCredentials: true
  });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/csrf')) {
        void router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
