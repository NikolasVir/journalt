import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

export interface SettingsTab {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatTabsModule,
    MatIconModule
  ],
  template: `
    <div class="settings-page">
      <header class="settings-page__header">
        <h1 class="settings-page__title">Settings</h1>
        <p class="settings-page__subtitle">
          Manage your account profile, credentials, libraries, note types, and tags.
        </p>
      </header>

      <nav mat-tab-nav-bar [tabPanel]="tabPanel" class="settings-page__tabs" aria-label="Settings navigation">
        @for (tab of tabs; track tab.route) {
          <a
            mat-tab-link
            [routerLink]="tab.route"
            routerLinkActive
            #rla="routerLinkActive"
            [active]="rla.isActive"
            class="settings-page__tab-link"
          >
            <mat-icon class="settings-page__tab-icon">{{ tab.icon }}</mat-icon>
            <span class="settings-page__tab-label">{{ tab.label }}</span>
          </a>
        }
      </nav>

      <mat-tab-nav-panel #tabPanel class="settings-page__tab-panel">
        <router-outlet />
      </mat-tab-nav-panel>
    </div>
  `,
  styles: `
    @use 'mixins' as *;

    .settings-page {
      @include flex-column;
      gap: var(--spacing-lg);
      width: 100%;
      max-width: 960px;
      margin: 0 auto;

      &__header {
        border-bottom: 1px solid var(--color-border-card);
        padding-bottom: var(--spacing-md);
      }

      &__title {
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
      }

      &__subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: var(--spacing-2xs) 0 0 0;
      }

      &__tabs {
        margin-top: calc(-1 * var(--spacing-sm));
      }

      &__tab-link {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
      }

      &__tab-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        margin-right: var(--spacing-xs);
      }

      &__tab-label {
        font-weight: var(--font-weight-medium);
      }

      &__tab-panel {
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent {
  protected readonly tabs: SettingsTab[] = [
    { label: 'Account', route: '/settings/account', icon: 'account_circle' },
    { label: 'Libraries', route: '/settings/libraries', icon: 'folder' },
    { label: 'Types', route: '/settings/types', icon: 'schema' },
    { label: 'Tags', route: '/settings/tags', icon: 'label' }
  ];
}
