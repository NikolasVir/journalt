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
        loadChildren: () =>
          import('@features/tags/tags.routes').then((m) => m.TAGS_ROUTES)
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

  // Fallback
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
