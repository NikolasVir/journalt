import { TestBed } from '@angular/core/testing';
import { DEFAULT_ACCENT, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  function clearAccentAttributes(): void {
    const root = document.documentElement;
    root.classList.remove('dark-theme');
    root.removeAttribute('data-accent');
    root.style.removeProperty('--accent-seed');
    root.style.removeProperty('--accent-on-light');
    root.style.removeProperty('--accent-on-dark');
  }

  beforeEach(() => {
    localStorage.clear();
    clearAccentAttributes();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    clearAccentAttributes();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should toggle theme mode', () => {
    const initial = service.isDarkMode();
    service.toggleTheme();
    expect(service.isDarkMode()).toBe(!initial);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(!initial);
    expect(localStorage.getItem('journalt-theme')).toBe(!initial ? 'dark' : 'light');
  });

  it('should explicitly set theme mode', () => {
    service.setTheme(true);
    expect(service.isDarkMode()).toBe(true);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    expect(localStorage.getItem('journalt-theme')).toBe('dark');

    service.setTheme(false);
    expect(service.isDarkMode()).toBe(false);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    expect(localStorage.getItem('journalt-theme')).toBe('light');
  });

  it('should start on the default accent without a data-accent attribute', () => {
    expect(service.accentSeed()).toBe(DEFAULT_ACCENT);
    expect(service.isDefaultAccent()).toBe(true);
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });

  it('should apply and cache a custom accent', () => {
    service.setAccent('#7B1FA2');

    expect(service.accentSeed()).toBe('#7b1fa2');
    expect(service.isDefaultAccent()).toBe(false);
    expect(document.documentElement.getAttribute('data-accent')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--accent-seed')).toBe('#7b1fa2');
    expect(localStorage.getItem('journalt-accent')).toBe('#7b1fa2');
  });

  it('should compute an on-colour for the seed', () => {
    service.setAccent('#ffffff');
    expect(document.documentElement.style.getPropertyValue('--accent-on-light')).toBe('#000000');

    service.setAccent('#000000');
    expect(document.documentElement.style.getPropertyValue('--accent-on-light')).toBe('#ffffff');
  });

  it('should fall back to the default accent for invalid input', () => {
    service.setAccent('not-a-colour');
    expect(service.accentSeed()).toBe(DEFAULT_ACCENT);
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });

  it('should reset back to the default accent', () => {
    service.setAccent('#2e7d32');
    service.resetAccent();
    expect(service.accentSeed()).toBe(DEFAULT_ACCENT);
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
    expect(localStorage.getItem('journalt-accent')).toBe(DEFAULT_ACCENT);
  });

  it('should restore a cached accent from storage', () => {
    TestBed.resetTestingModule();
    localStorage.setItem('journalt-accent', '#00838f');
    TestBed.configureTestingModule({});
    const restored = TestBed.inject(ThemeService);

    expect(restored.accentSeed()).toBe('#00838f');
    expect(document.documentElement.getAttribute('data-accent')).toBe('');
  });
});
