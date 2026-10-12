import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LayoutService } from '@layout/layout.service';
import { LibraryService } from '@core/services/library.service';
import { APP_VERSION_INFO } from '@env/version';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;
  let layoutService: LayoutService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        {
          provide: LibraryService,
          useValue: {
            navLibraries: signal([]),
            libraryTree: signal([]),
            sharedLibraryTree: signal([]),
            loadLibraries: vi.fn()
          }
        }
      ]
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

  it('should contain consolidated Notes & Journals navigation item', () => {
    const navItems = component['mainNavItems'];
    const notesAndJournals = navItems.find((item) => item.label === 'Notes & Journals');
    expect(notesAndJournals).toBeDefined();
    expect(notesAndJournals?.route).toBe('/notes');
    expect(notesAndJournals?.icon).toBe('auto_stories');
    expect(notesAndJournals?.exact).toBe(true);

    const oldNotes = navItems.find((item) => item.label === 'Notes');
    const oldJournals = navItems.find((item) => item.label === 'Journals');
    expect(oldNotes).toBeUndefined();
    expect(oldJournals).toBeUndefined();
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

  it('should render library items in the navigation list when libraries exist', () => {
    const mockNavLibs = [
      { id: 'lib-1', name: 'Work', depth: 0 },
      { id: 'lib-2', name: 'Personal', depth: 0 },
      { id: 'lib-3', name: 'Project Alpha', depth: 1 }
    ];
    (component as unknown as { libraries: { set: (v: unknown) => void } }).libraries.set(mockNavLibs);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const sectionHeader = compiled.querySelector('.sidebar__section-title');
    expect(sectionHeader).toBeTruthy();
    expect(sectionHeader?.textContent).toBe('LIBRARIES');

    const libraryItems = compiled.querySelectorAll('.sidebar__library-item');
    expect(libraryItems.length).toBe(3);

    const titles = Array.from(compiled.querySelectorAll('.sidebar__library-title')).map(
      (el) => el.textContent?.trim()
    );
    expect(titles).toEqual(['Work', 'Personal', 'Project Alpha']);

    const nestedItem = compiled.querySelector('.sidebar__library-item--nested');
    expect(nestedItem).toBeTruthy();
  });

  it('should collapse and expand a parent library when clicking its twist toggle', () => {
    const mockNavLibs = [
      { id: 'lib-1', name: 'Work', depth: 0, hasChildren: false },
      { id: 'lib-2', name: 'Personal', depth: 0, hasChildren: true },
      { id: 'lib-3', name: 'Project Alpha', depth: 1, hasChildren: false }
    ];
    (component as unknown as { libraries: { set: (v: unknown) => void } }).libraries.set(mockNavLibs);
    fixture.detectChanges();

    // Personal has children, so its twist should exist
    expect(component.isLibraryExpanded('lib-2')).toBe(true);

    // Toggle collapse on Personal
    const mockEvent = new MouseEvent('click');
    component.toggleLibraryCollapse('lib-2', mockEvent);
    fixture.detectChanges();

    expect(component.isLibraryExpanded('lib-2')).toBe(false);

    // Project Alpha should now be hidden
    let libraryItems = fixture.nativeElement.querySelectorAll('.sidebar__library-item');
    expect(libraryItems.length).toBe(2);
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.sidebar__library-title')).map(
      (el: any) => el.textContent?.trim()
    );
    expect(titles).toEqual(['Work', 'Personal']);

    // Toggle expand again
    component.toggleLibraryCollapse('lib-2', mockEvent);
    fixture.detectChanges();

    expect(component.isLibraryExpanded('lib-2')).toBe(true);
    libraryItems = fixture.nativeElement.querySelectorAll('.sidebar__library-item');
    expect(libraryItems.length).toBe(3);
  });

  it('should toggle collapse of the entire LIBRARIES section header', () => {
    const mockNavLibs = [
      { id: 'lib-1', name: 'Work', depth: 0, hasChildren: false }
    ];
    (component as unknown as { libraries: { set: (v: unknown) => void } }).libraries.set(mockNavLibs);
    fixture.detectChanges();

    expect(component['isLibrariesSectionCollapsed']()).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.sidebar__library-item').length).toBe(1);

    // Collapse section
    component.toggleLibrariesSection();
    fixture.detectChanges();

    expect(component['isLibrariesSectionCollapsed']()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.sidebar__library-item').length).toBe(0);

    // Expand section
    component.toggleLibrariesSection();
    fixture.detectChanges();

    expect(component['isLibrariesSectionCollapsed']()).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.sidebar__library-item').length).toBe(1);
  });

  it('should collapse and expand a parent library when clicking the whole library item button', () => {
    const mockNavLibs = [
      { id: 'lib-1', name: 'Work', depth: 0, hasChildren: false },
      { id: 'lib-2', name: 'Personal', depth: 0, hasChildren: true },
      { id: 'lib-3', name: 'Project Alpha', depth: 1, hasChildren: false }
    ];
    (component as unknown as { libraries: { set: (v: unknown) => void } }).libraries.set(mockNavLibs);
    fixture.detectChanges();

    expect(component.isLibraryExpanded('lib-2')).toBe(true);

    const mockEvent = new MouseEvent('click');
    const personalItem = mockNavLibs[1];

    // Clicking the item row toggles collapse
    component.onLibraryItemClick(personalItem, mockEvent);
    fixture.detectChanges();

    expect(component.isLibraryExpanded('lib-2')).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.sidebar__library-item').length).toBe(2);

    // Clicking it again expands it
    component.onLibraryItemClick(personalItem, mockEvent);
    fixture.detectChanges();

    expect(component.isLibraryExpanded('lib-2')).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.sidebar__library-item').length).toBe(3);
  });

  it('should render shared libraries under SHARED LIBRARIES section header with owner attribution', () => {
    const mockShared = [
      {
        id: 'shared-lib-1',
        name: 'Team Docs',
        createdAtUtc: '2026-10-01T12:00:00Z',
        updatedAtUtc: '2026-10-01T12:00:00Z',
        children: [],
        notesCount: 5,
        isOwner: false,
        isShared: true,
        ownerUserName: 'AnnaMaria'
      }
    ];
    const libService = TestBed.inject(LibraryService);
    (libService.sharedLibraryTree as any).set(mockShared);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const sectionHeaders = Array.from(compiled.querySelectorAll('.sidebar__section-title')).map(
      (el) => el.textContent?.trim()
    );
    expect(sectionHeaders).toContain('SHARED LIBRARIES');

    const badge = compiled.querySelector('.sidebar__library-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent?.trim()).toBe('@AnnaMaria');
  });
});

