import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';

export const EXPLORE_TREE_MIN_WIDTH = 220;
export const EXPLORE_TREE_MAX_WIDTH = 560;
export const EXPLORE_TREE_DEFAULT_WIDTH = 340;

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly treeWidthStorageKey = 'journalt-explore-tree-width';
  private readonly viewModeStorageKey = 'journalt-note-view-mode';

  public readonly isHandset: Signal<boolean> = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.Handset, '(max-width: 768px)'])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  private readonly mobileMenuOpenState = signal<boolean>(false);
  private readonly mobileSearchOpenState = signal<boolean>(false);
  private readonly sidebarCollapsedState = signal<boolean>(false);
  private readonly searchQueryState = signal<string>('');
  private readonly sidebarHiddenState = signal<boolean>(false);
  private readonly exploreTreeWidthState = signal<number>(this.readStoredTreeWidth());
  private readonly viewModeState = signal<'grid' | 'list'>(this.readStoredViewMode());

  public readonly isMobileMenuOpen: Signal<boolean> = this.mobileMenuOpenState.asReadonly();
  public readonly isMobileSearchOpen: Signal<boolean> = this.mobileSearchOpenState.asReadonly();
  public readonly isSidebarCollapsed: Signal<boolean> = this.sidebarCollapsedState.asReadonly();
  public readonly searchQuery: Signal<string> = this.searchQueryState.asReadonly();
  public readonly isSidebarHidden: Signal<boolean> = this.sidebarHiddenState.asReadonly();
  public readonly exploreTreeWidth: Signal<number> = this.exploreTreeWidthState.asReadonly();
  public readonly viewMode: Signal<'grid' | 'list'> = this.viewModeState.asReadonly();

  public toggleViewMode(): void {
    const next = this.viewModeState() === 'grid' ? 'list' : 'grid';
    this.viewModeState.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.viewModeStorageKey, next);
    }
  }

  public setViewMode(mode: 'grid' | 'list'): void {
    this.viewModeState.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.viewModeStorageKey, mode);
    }
  }

  public toggleMobileMenu(): void {
    this.mobileMenuOpenState.update((open) => !open);
  }

  public closeMobileMenu(): void {
    this.mobileMenuOpenState.set(false);
  }

  public toggleMobileSearch(): void {
    this.mobileSearchOpenState.update((open) => !open);
  }

  public closeMobileSearch(): void {
    this.mobileSearchOpenState.set(false);
  }

  public toggleSidebar(): void {
    if (this.isHandset()) {
      this.toggleMobileMenu();
    } else {
      this.sidebarCollapsedState.update((collapsed) => !collapsed);
    }
  }

  public setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsedState.set(collapsed);
  }

  public setSearchQuery(query: string): void {
    this.searchQueryState.set(query);
  }

  /**
   * Routes such as Explore own the left edge themselves, so the global sidebar
   * is removed rather than duplicated beside a second tree column.
   */
  public setSidebarHidden(hidden: boolean): void {
    this.sidebarHiddenState.set(hidden);
  }

  public setExploreTreeWidth(width: number): void {
    const next = Math.round(width);
    if (next === this.exploreTreeWidthState()) return;
    this.exploreTreeWidthState.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.treeWidthStorageKey, String(next));
    }
  }

  public resetExploreTreeWidth(): void {
    this.setExploreTreeWidth(EXPLORE_TREE_DEFAULT_WIDTH);
  }

  private readStoredTreeWidth(): number {
    if (!isPlatformBrowser(this.platformId)) return EXPLORE_TREE_DEFAULT_WIDTH;
    const raw = localStorage.getItem(this.treeWidthStorageKey);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(parsed)) return EXPLORE_TREE_DEFAULT_WIDTH;
    return Math.min(Math.max(parsed, EXPLORE_TREE_MIN_WIDTH), EXPLORE_TREE_MAX_WIDTH);
  }

  private readStoredViewMode(): 'grid' | 'list' {
    if (!isPlatformBrowser(this.platformId)) return 'grid';
    const raw = localStorage.getItem(this.viewModeStorageKey);
    if (raw === 'list' || raw === 'grid') return raw;
    if (window.innerWidth < 768) return 'list';
    return 'grid';
  }
}
