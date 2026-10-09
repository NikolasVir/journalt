import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LayoutService } from '@layout/layout.service';
import { APP_VERSION_INFO } from '@env/version';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;
  let layoutService: LayoutService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    layoutService = TestBed.inject(LayoutService);
    fixture.detectChanges();
  });

  it('should create the component with version info', () => {
    expect(component).toBeTruthy();
    expect(component['appVersion']).toEqual(APP_VERSION_INFO);
    expect(component['versionTooltip']).toContain(APP_VERSION_INFO.displayVersion);
    expect(component['versionTooltip']).toContain(APP_VERSION_INFO.commit);
  });

  it('should display the version string in expanded mode', () => {
    layoutService.setSidebarCollapsed(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const versionEl = compiled.querySelector('.sidebar__version');
    expect(versionEl).toBeTruthy();
    expect(versionEl?.textContent).toContain(APP_VERSION_INFO.displayVersion);
  });

  it('should display the version icon in collapsed mode', () => {
    layoutService.setSidebarCollapsed(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const iconEl = compiled.querySelector('.sidebar__version-icon');
    expect(iconEl).toBeTruthy();
    expect(iconEl?.textContent).toContain('info');
  });
});
