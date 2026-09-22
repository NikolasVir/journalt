import { Injectable, signal, Signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private readonly sidebarCollapsedState = signal<boolean>(false);
  private readonly searchQueryState = signal<string>('');

  public readonly isSidebarCollapsed: Signal<boolean> = this.sidebarCollapsedState.asReadonly();
  public readonly searchQuery: Signal<string> = this.searchQueryState.asReadonly();

  public toggleSidebar(): void {
    this.sidebarCollapsedState.update((collapsed) => !collapsed);
  }

  public setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsedState.set(collapsed);
  }

  public setSearchQuery(query: string): void {
    this.searchQueryState.set(query);
  }
}
