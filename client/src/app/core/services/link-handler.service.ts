import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Single place that decides how every clicked link behaves.
 *
 * - External `http(s)` links open in a new tab (`target="_blank"`,
 *   `rel="noopener noreferrer"`), on any screen, including markdown
 *   rendered via `[innerHTML]` where attribute directives never apply.
 * - Internal `/...` app routes stay in the SPA (same tab) via the router,
 *   which also repairs legacy markup that stamped `target="_blank"` on
 *   internal links.
 *
 * Component-level handlers (note dialog, explore viewer) run first and set
 * `defaultPrevented`; this bubble-phase listener skips those clicks.
 */
@Injectable({
  providedIn: 'root'
})
export class LinkHandlerService implements OnDestroy {
  private readonly router = inject(Router);
  private initialized = false;

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = (anchor.getAttribute('href') ?? '').trim();
    if (!href || href.startsWith('#')) return;
    if (/^(mailto|tel|sms|data|blob|javascript):/i.test(href)) return;
    if (anchor.hasAttribute('download')) return;

    if (/^https?:\/\//i.test(href)) {
      anchor.setAttribute('target', '_blank');
      const rel = (anchor.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean);
      if (!rel.includes('noopener')) rel.push('noopener');
      if (!rel.includes('noreferrer')) rel.push('noreferrer');
      anchor.setAttribute('rel', rel.join(' '));
      return;
    }

    if (href.startsWith('/')) {
      event.preventDefault();
      void this.router.navigateByUrl(href);
    }
  };

  public init(): void {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;
    document.addEventListener('click', this.onDocumentClick);
  }

  public destroy(): void {
    if (!this.initialized || typeof document === 'undefined') return;
    this.initialized = false;
    document.removeEventListener('click', this.onDocumentClick);
  }

  public ngOnDestroy(): void {
    this.destroy();
  }
}
