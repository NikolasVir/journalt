import { Routes } from '@angular/router';

export const TAGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tags-page.component').then((m) => m.TagsPageComponent)
  }
];
