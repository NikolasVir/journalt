import { Routes } from '@angular/router';

export const TRASH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./trash-page.component').then((m) => m.TrashPageComponent)
  }
];
