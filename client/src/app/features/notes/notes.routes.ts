import { Routes } from '@angular/router';

export const NOTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./notes-page.component').then((m) => m.NotesPageComponent)
  },
  {
    path: 'inbox',
    loadComponent: () =>
      import('./notes-page.component').then((m) => m.NotesPageComponent),
    data: { level: 'Inbox' }
  },
  {
    path: 'quick',
    loadComponent: () =>
      import('./notes-page.component').then((m) => m.NotesPageComponent),
    data: { level: 'Quick' }
  },
  {
    path: 'journal',
    loadComponent: () =>
      import('./notes-page.component').then((m) => m.NotesPageComponent),
    data: { level: 'Journal' }
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./note-detail-page.component').then((m) => m.NoteDetailPageComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./note-detail-page.component').then((m) => m.NoteDetailPageComponent)
  }
];
