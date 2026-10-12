import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
  untracked
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '@layout/layout.service';
import { LibraryService, NavLibraryItem } from '@core/services/library.service';
import { LibraryTreeResponse } from '@core/models/library.model';
import { APP_VERSION_INFO } from '@env/version';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
}

function buildTreeFromNav(items: NavLibraryItem[]): LibraryTreeResponse[] {
  const roots: LibraryTreeResponse[] = [];
  const stack: { node: LibraryTreeResponse; depth: number }[] = [];

  for (const item of items) {
    const node: LibraryTreeResponse = {
      id: item.id,
      name: item.name,
      createdAtUtc: '',
      updatedAtUtc: '',
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, depth: item.depth });
  }

  return roots;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly layoutService = inject(LayoutService);
  protected readonly libraryService = inject(LibraryService);
  protected readonly appVersion = APP_VERSION_INFO;
  protected readonly versionTooltip = `JournalT ${APP_VERSION_INFO.displayVersion} (${APP_VERSION_INFO.commit}) • Built ${APP_VERSION_INFO.buildDate}`;

  @Output() public readonly itemClicked = new EventEmitter<void>();

  // Exposed for backward compatibility with component specs
  protected readonly libraries = this.libraryService.navLibraries;

  protected readonly isLibrariesSectionCollapsed = signal<boolean>(this.getStoredSectionCollapsed());
  protected readonly isSharedSectionCollapsed = signal<boolean>(this.getStoredSharedSectionCollapsed());
  protected readonly collapsedLibraryIds = signal<Set<string>>(this.getStoredCollapsedLibraryIds());

  protected readonly libraryTree = computed<LibraryTreeResponse[]>(() => {
    const raw = this.libraryService.libraryTree ? this.libraryService.libraryTree() : [];
    if (raw && raw.length > 0) {
      return raw;
    }
    const navItems = this.libraries ? this.libraries() : [];
    return buildTreeFromNav(navItems);
  });

  protected readonly sharedLibraryTree = computed<LibraryTreeResponse[]>(() => {
    return this.libraryService.sharedLibraryTree ? this.libraryService.sharedLibraryTree() : [];
  });

  protected readonly hasLibraries = computed(() => this.libraryTree().length > 0);
  protected readonly hasSharedLibraries = computed(() => this.sharedLibraryTree().length > 0);

  protected readonly visibleLibraries = computed<NavLibraryItem[]>(() => {
    if (this.isLibrariesSectionCollapsed()) {
      return [];
    }
    const tree = this.libraryTree();
    const collapsed = this.collapsedLibraryIds();
    return this.flattenVisible(tree, collapsed, 0, null);
  });

  protected readonly visibleSharedLibraries = computed<NavLibraryItem[]>(() => {
    if (this.isSharedSectionCollapsed()) {
      return [];
    }
    const tree = this.sharedLibraryTree();
    const collapsed = this.collapsedLibraryIds();
    return this.flattenVisible(tree, collapsed, 0, null);
  });

  constructor() {
    // Auto-expand ancestors when viewing a specific library
    effect(() => {
      const url = this.router.url;
      const match = url.match(/\/libraries\/([a-zA-Z0-9-]+)/);
      if (match) {
        const activeLibId = match[1];
        const tree = this.libraryTree();
        const sharedTree = this.sharedLibraryTree();
        const ancestors = this.findAncestorIds(tree, activeLibId) ?? this.findAncestorIds(sharedTree, activeLibId);
        if (ancestors && ancestors.length > 0) {
          untracked(() => {
            const current = this.collapsedLibraryIds();
            const next = new Set(current);
            let changed = false;
            for (const ancId of ancestors) {
              if (next.has(ancId)) {
                next.delete(ancId);
                changed = true;
              }
            }
            if (changed) {
              this.collapsedLibraryIds.set(next);
              this.saveStoredCollapsedLibraryIds(next);
            }
          });
        }
      }
    });
  }

  public ngOnInit(): void {
    this.libraryService.loadLibraries();
  }

  public toggleLibrariesSection(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const next = !this.isLibrariesSectionCollapsed();
    this.isLibrariesSectionCollapsed.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('journalt-sidebar-libraries-collapsed', String(next));
    }
  }

  public toggleSharedSection(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const next = !this.isSharedSectionCollapsed();
    this.isSharedSectionCollapsed.set(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('journalt-sidebar-shared-libraries-collapsed', String(next));
    }
  }

  public onLibraryItemClick(lib: NavLibraryItem, event: MouseEvent): void {
    this.itemClicked.emit();
    if (lib.hasChildren) {
      this.toggleLibraryCollapse(lib.id, event, false);
    }
  }

  public toggleLibraryCollapse(id: string, event: Event, stopPropagation = true): void {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.collapsedLibraryIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      this.saveStoredCollapsedLibraryIds(next);
      return next;
    });
  }

  public isLibraryExpanded(id: string): boolean {
    return !this.collapsedLibraryIds().has(id);
  }

  private flattenVisible(
    nodes: LibraryTreeResponse[],
    collapsedIds: Set<string>,
    depth = 0,
    parentId: string | null = null
  ): NavLibraryItem[] {
    const result: NavLibraryItem[] = [];
    for (const node of nodes) {
      const hasChildren = (node.children?.length ?? 0) > 0;
      result.push({
        id: node.id,
        name: node.name,
        parentId,
        depth,
        hasChildren,
        isOwner: node.isOwner,
        isShared: node.isShared,
        ownerUserName: node.ownerUserName,
        notesCount: node.notesCount
      });
      if (hasChildren && !collapsedIds.has(node.id)) {
        result.push(...this.flattenVisible(node.children, collapsedIds, depth + 1, node.id));
      }
    }
    return result;
  }

  private findAncestorIds(
    nodes: LibraryTreeResponse[],
    targetId: string,
    currentPath: string[] = []
  ): string[] | null {
    for (const node of nodes) {
      if (node.id === targetId) {
        return currentPath;
      }
      if (node.children?.length) {
        const found = this.findAncestorIds(node.children, targetId, [...currentPath, node.id]);
        if (found) return found;
      }
    }
    return null;
  }

  private getStoredSectionCollapsed(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('journalt-sidebar-libraries-collapsed') === 'true';
  }

  private getStoredSharedSectionCollapsed(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('journalt-sidebar-shared-libraries-collapsed') === 'true';
  }

  private getStoredCollapsedLibraryIds(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set<string>();
    try {
      const raw = localStorage.getItem('journalt-sidebar-collapsed-libraries');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set<string>(arr);
        }
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  }

  private saveStoredCollapsedLibraryIds(ids: Set<string>): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('journalt-sidebar-collapsed-libraries', JSON.stringify([...ids]));
    }
  }

  protected readonly mainNavItems: NavItem[] = [
    { label: 'Home', route: '/dashboard', icon: 'lightbulb', exact: true },
    { label: 'Todos', route: '/todos', icon: 'check_circle' },
    { label: 'Explore', route: '/explore', icon: 'account_tree', exact: true },
    { label: 'Inbox', route: '/notes/inbox', icon: 'inbox' },
    { label: 'Notes & Journals', route: '/notes', icon: 'auto_stories', exact: true }
  ];

  protected readonly systemNavItems: NavItem[] = [
    { label: 'Trash', route: '/trash', icon: 'delete' },
    { label: 'Settings', route: '/settings', icon: 'settings' }
  ];
}
