import { Routes } from '@angular/router';

export const TYPES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./types-page.component').then((m) => m.TypesPageComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./type-detail-page.component').then((m) => m.TypeDetailPageComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./type-detail-page.component').then((m) => m.TypeDetailPageComponent),
  },
];
