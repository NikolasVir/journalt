import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="not-found-card" role="region" aria-label="Page Not Found">
      <mat-icon class="not-found-icon">explore_off</mat-icon>
      <h1 class="not-found-code">404</h1>
      <h2 class="not-found-title">Page Not Found</h2>
      <p class="not-found-description">
        The page you are looking for doesn't exist, was moved, or is temporarily unavailable.
      </p>
      <div class="not-found-actions">
        <a mat-flat-button color="primary" routerLink="/dashboard">
          <mat-icon>home</mat-icon>
          <span>Go to Dashboard</span>
        </a>
        <a mat-stroked-button routerLink="/notes">
          <mat-icon>description</mat-icon>
          <span>View Notes</span>
        </a>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      padding: var(--spacing-xl, 2rem);
      box-sizing: border-box;
      width: 100%;
    }

    .not-found-card {
      max-width: 480px;
      width: 100%;
      text-align: center;
      padding: var(--spacing-2xl, 3rem) var(--spacing-xl, 2rem);
      background: var(--color-bg-surface);
      border: 1px solid var(--color-border-card);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-card);
      box-sizing: border-box;
    }

    .not-found-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: var(--color-primary);
      margin-bottom: var(--spacing-md, 1rem);
    }

    .not-found-code {
      font-size: 3.5rem;
      font-weight: 700;
      line-height: 1;
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-xs, 0.25rem);
    }

    .not-found-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 var(--spacing-sm, 0.5rem);
    }

    .not-found-description {
      font-size: 0.9375rem;
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 0 0 var(--spacing-xl, 2rem);
    }

    .not-found-actions {
      display: flex;
      gap: var(--spacing-md, 1rem);
      justify-content: center;
      flex-wrap: wrap;

      a {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs, 0.25rem);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPageComponent {}
