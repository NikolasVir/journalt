import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { mixHex, normalizeHex, onColorFor } from '@core/utils/color.util';

export type ThemeMode = 'light' | 'dark';

/** The classic JournalT blue; selecting it restores the exact default palette. */
export const DEFAULT_ACCENT = '#1a73e8';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeStorageKey = 'journalt-theme';
  private readonly accentStorageKey = 'journalt-accent';

  public readonly isDarkMode = signal<boolean>(false);
  public readonly accentSeed = signal<string>(DEFAULT_ACCENT);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.themeStorageKey) as ThemeMode | null;
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode.set(saved ? saved === 'dark' : prefersDark);

      const cachedAccent = normalizeHex(localStorage.getItem(this.accentStorageKey));
      this.accentSeed.set(cachedAccent ?? DEFAULT_ACCENT);

      this.applyTheme(this.isDarkMode());
      this.applyAccent(this.accentSeed());
    }
  }

  public toggleTheme(): void {
    this.applyTheme(!this.isDarkMode());
  }

  public setTheme(dark: boolean): void {
    this.applyTheme(dark);
  }

  /** Sets the accent seed (any `#rrggbb`). Persists a local cache so the colour
   * applies instantly on the next load, before the account value is fetched. */
  public setAccent(hex: string | null | undefined): void {
    const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT;
    this.accentSeed.set(normalized);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.accentStorageKey, normalized);
      this.applyAccent(normalized);
    }
  }

  public resetAccent(): void {
    this.setAccent(DEFAULT_ACCENT);
  }

  public isDefaultAccent(): boolean {
    return this.accentSeed() === DEFAULT_ACCENT;
  }

  private applyTheme(dark: boolean): void {
    this.isDarkMode.set(dark);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.themeStorageKey, dark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark-theme', dark);
    }
  }

  private applyAccent(hex: string): void {
    const root = document.documentElement;

    // The default keeps the hand-tuned palette exactly as designed.
    if (hex === DEFAULT_ACCENT) {
      root.removeAttribute('data-accent');
      root.style.setProperty('--accent-seed', DEFAULT_ACCENT);
      root.style.setProperty('--accent-on-light', '#ffffff');
      root.style.setProperty('--accent-on-dark', '#202124');
      return;
    }

    // Dark mode lightens the seed before it is used, so the on-colour must be
    // computed against that lightened primary to stay legible.
    const darkPrimary = mixHex(hex, '#ffffff', 0.55);

    root.setAttribute('data-accent', '');
    root.style.setProperty('--accent-seed', hex);
    root.style.setProperty('--accent-on-light', onColorFor(hex));
    root.style.setProperty('--accent-on-dark', onColorFor(darkPrimary));
  }
}
