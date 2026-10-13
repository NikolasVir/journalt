import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { mixHex, onColorFor } from '@core/utils/color.util';
import { buildFaviconSvg, toSvgDataUri } from '@core/utils/favicon.util';

/**
 * Keeps the browser tab icon (and mobile `theme-color`) in step with the user's
 * accent colour. The static `favicon.svg` / `favicon.ico` remain as the default
 * for the brief moment before Angular boots and as a no-JS fallback.
 */
@Injectable({
  providedIn: 'root'
})
export class FaviconService {
  private readonly platformId = inject(PLATFORM_ID);

  public update(accentHex: string, isDark: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Mirror the UI: dark mode lightens the seed before use.
    const accent = isDark ? mixHex(accentHex, '#ffffff', 0.55) : accentHex;
    this.applyIcon(toSvgDataUri(buildFaviconSvg(accent, onColorFor(accent))));
    this.ensureThemeColor().setAttribute('content', accent);
  }

  /**
   * Replaces every existing icon link with a single dynamic SVG icon. Browsers
   * cache/ignore `href` mutations on an already-used icon link (and would keep
   * preferring the static `.ico`), so the element is removed and recreated.
   */
  private applyIcon(href: string): void {
    document
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
      .forEach((el) => el.remove());

    const link = document.createElement('link');
    link.id = 'app-favicon';
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.setAttribute('sizes', 'any');
    link.setAttribute('href', href);
    document.head.appendChild(link);
  }

  private ensureThemeColor(): HTMLMetaElement {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    return meta;
  }
}
