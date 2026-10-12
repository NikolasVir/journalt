import { Routes } from '@angular/router';

export const VAULT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./vault-page.component').then((m) => m.VaultPageComponent)
  }
];
