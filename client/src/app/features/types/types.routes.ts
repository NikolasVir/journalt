import { Routes } from '@angular/router';

export const TYPES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./types-page.component').then((m) => m.TypesPageComponent)
  }
];
