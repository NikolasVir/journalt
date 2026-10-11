import { Routes } from '@angular/router';

export const LIBRARIES_ROUTES: Routes = [
  {
    path: '',
    redirectTo: '/settings/libraries',
    pathMatch: 'full'
  },
  {
    path: ':libraryId',
    loadComponent: () =>
      import('../notes/notes-page.component').then((m) => m.NotesPageComponent)
  }
];

