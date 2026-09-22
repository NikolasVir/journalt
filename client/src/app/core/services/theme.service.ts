import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'journalt-theme';

  public readonly isDarkMode = signal<boolean>(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.storageKey) as ThemeMode | null;
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialDark = saved ? saved === 'dark' : prefersDark;
      this.applyTheme(initialDark);
    }
  }

  public toggleTheme(): void {
    this.applyTheme(!this.isDarkMode());
  }

  public setTheme(dark: boolean): void {
    this.applyTheme(dark);
  }

  private applyTheme(dark: boolean): void {
    this.isDarkMode.set(dark);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.storageKey, dark ? 'dark' : 'light');
      if (dark) {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
    }
  }
}
