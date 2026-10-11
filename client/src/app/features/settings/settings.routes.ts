import { Routes } from '@angular/router';
import { SettingsPageComponent } from './settings-page.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsPageComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'account'
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./account/account-settings.component').then((m) => m.AccountSettingsComponent)
      },
      {
        path: 'libraries',
        loadComponent: () =>
          import('@features/libraries/libraries-page.component').then((m) => m.LibrariesPageComponent)
      },
      {
        path: 'types',
        loadComponent: () =>
          import('@features/types/types-page.component').then((m) => m.TypesPageComponent)
      },
      {
        path: 'types/new',
        loadComponent: () =>
          import('@features/types/type-detail-page.component').then((m) => m.TypeDetailPageComponent)
      },
      {
        path: 'types/:id',
        loadComponent: () =>
          import('@features/types/type-detail-page.component').then((m) => m.TypeDetailPageComponent)
      },
      {
        path: 'tags',
        loadComponent: () =>
          import('@features/tags/tags-page.component').then((m) => m.TagsPageComponent)
      }
    ]
  }
];
