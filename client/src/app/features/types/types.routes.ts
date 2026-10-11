import { Routes } from '@angular/router';

export const TYPES_ROUTES: Routes = [
  {
    path: '',
    redirectTo: '/settings/types',
    pathMatch: 'full'
  },
  {
    path: 'new',
    redirectTo: '/settings/types/new',
    pathMatch: 'full'
  },
  {
    path: ':id',
    redirectTo: (route) => `/settings/types/${route.params['id']}`
  }
];
