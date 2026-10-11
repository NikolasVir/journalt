import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  let fixture: ComponentFixture<SettingsPageComponent>;
  let component: SettingsPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('defines the expected settings tabs for Account, Libraries, Types, and Tags', () => {
    const tabs = (component as any).tabs;
    expect(tabs.length).toBe(4);
    expect(tabs.map((t: any) => t.label)).toEqual(['Account', 'Libraries', 'Types', 'Tags']);
    expect(tabs.map((t: any) => t.route)).toEqual([
      '/settings/account',
      '/settings/libraries',
      '/settings/types',
      '/settings/tags'
    ]);
  });

  it('renders tab links in the navigation bar', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const tabLinks = compiled.querySelectorAll('.settings-page__tab-link');
    expect(tabLinks.length).toBe(4);

    const labels = Array.from(tabLinks).map((el) => el.textContent?.trim());
    expect(labels.some((l) => l?.includes('Account'))).toBe(true);
    expect(labels.some((l) => l?.includes('Libraries'))).toBe(true);
    expect(labels.some((l) => l?.includes('Types'))).toBe(true);
    expect(labels.some((l) => l?.includes('Tags'))).toBe(true);
  });
});
