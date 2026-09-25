import { Routes } from '@angular/router';

export const EXPLORE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./explore-page.component').then((m) => m.ExplorePageComponent)
  }
];
