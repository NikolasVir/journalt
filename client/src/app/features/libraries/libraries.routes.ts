import { Routes } from '@angular/router';

export const LIBRARIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./libraries-page.component').then((m) => m.LibrariesPageComponent)
  }
];
