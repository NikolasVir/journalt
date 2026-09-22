import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-theme');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-theme');
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
});
