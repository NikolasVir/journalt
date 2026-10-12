import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { guestGuard } from '@core/guards/guest.guard';
import { AppShellComponent } from '@layout/app-shell/app-shell.component';

export const routes: Routes = [
  // Public auth routes (login, register)
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES)
  },

  // Protected application routes inside Google Keep-style shell
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('@features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
      },
      {
        path: 'notes',
        loadChildren: () =>
          import('@features/notes/notes.routes').then((m) => m.NOTES_ROUTES)
      },
      {
        path: 'explore',
        loadChildren: () =>
          import('@features/explore/explore.routes').then((m) => m.EXPLORE_ROUTES),
        // Explore renders its own library tree on the left edge, so the
        // global sidebar steps aside instead of doubling up.
        data: { hideSidebar: true }
      },
      {
        path: 'todos',
        loadChildren: () =>
          import('@features/todos/todos.routes').then((m) => m.TODOS_ROUTES)
      },
      {
        path: 'libraries',
        loadChildren: () =>
          import('@features/libraries/libraries.routes').then((m) => m.LIBRARIES_ROUTES)
      },
      {
        path: 'types',
        loadChildren: () =>
          import('@features/types/types.routes').then((m) => m.TYPES_ROUTES)
      },
      {
        path: 'tags',
        redirectTo: 'settings/tags',
        pathMatch: 'full'
      },
      {
        path: 'vault',
        loadChildren: () =>
          import('@features/vault/vault.routes').then((m) => m.VAULT_ROUTES)
      },
      {
        path: 'trash',
        loadChildren: () =>
          import('@features/trash/trash.routes').then((m) => m.TRASH_ROUTES)
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('@features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // 404 Not Found fallback
  {
    path: '404',
    loadComponent: () =>
      import('@features/not-found/not-found-page.component').then((m) => m.NotFoundPageComponent)
  },
  {
    path: '**',
    loadComponent: () =>
      import('@features/not-found/not-found-page.component').then((m) => m.NotFoundPageComponent)
  }
];
