import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';

export const EXPLORE_TREE_MIN_WIDTH = 220;
export const EXPLORE_TREE_MAX_WIDTH = 560;
export const EXPLORE_TREE_DEFAULT_WIDTH = 340;

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly treeWidthStorageKey = 'journalt-explore-tree-width';

  private readonly sidebarCollapsedState = signal<boolean>(false);
  private readonly searchQueryState = signal<string>('');
  private readonly sidebarHiddenState = signal<boolean>(false);
  private readonly exploreTreeWidthState = signal<number>(this.readStoredTreeWidth());

  public readonly isSidebarCollapsed: Signal<boolean> = this.sidebarCollapsedState.asReadonly();
  public readonly searchQuery: Signal<string> = this.searchQueryState.asReadonly();
  public readonly isSidebarHidden: Signal<boolean> = this.sidebarHiddenState.asReadonly();
  public readonly exploreTreeWidth: Signal<number> = this.exploreTreeWidthState.asReadonly();

  public toggleSidebar(): void {
    this.sidebarCollapsedState.update((collapsed) => !collapsed);
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
}
