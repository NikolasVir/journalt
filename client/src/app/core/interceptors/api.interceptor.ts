import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  let headers = req.headers;
  const xsrfToken = getCookie('XSRF-TOKEN');

  // Attach XSRF token for mutating requests
  if (xsrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase())) {
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
