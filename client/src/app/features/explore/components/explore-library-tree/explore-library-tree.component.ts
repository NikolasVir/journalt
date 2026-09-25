import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ExploreNode } from '../../explore-page.types';

/**
 * The single navigation column of Explore. Libraries hold their notes as
 * leaves, so a note is always reached through the library that holds it.
 * Because this route owns the left edge, the global sidebar is hidden.
 */
@Component({
  selector: 'app-explore-library-tree',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './explore-library-tree.component.html',
  styleUrl: './explore-library-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreLibraryTreeComponent {
  public readonly tree = input.required<ExploreNode[]>();
  public readonly isLoading = input.required<boolean>();
  public readonly selectedLibraryId = input<string | null>(null);
  public readonly selectedNoteId = input<string | null>(null);
  public readonly canCreate = input.required<boolean>();

  public readonly librarySelected = output<string>();
  public readonly noteSelected = output<string>();
  public readonly createRequested = output<void>();
  public readonly reloadRequested = output<void>();

  protected readonly query = signal<string>('');
  private readonly expandedIds = signal<ReadonlySet<string>>(new Set<string>());

  /** While a search is active every branch is forced open so hits are visible. */
  private readonly forceExpand = computed(() => this.query().trim().length > 0);

  /**
   * Filtering prunes the tree to notes whose title matches, keeping the
   * libraries on the path to each hit.
   */
  protected readonly visibleTree = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.prune(this.tree(), q) : this.tree();
  });

  /** Total notes currently shown, for the header count. */
  protected readonly visibleNoteCount = computed(() => countNotes(this.visibleTree()));

  public constructor() {
    // Top-level libraries start open so the tree reads as a map, not a list.
    effect(() => {
      const roots = this.tree();
      this.expandedIds.update((current) => {
        const next = new Set(current);
        let changed = false;
        for (const node of roots) {
          if (node.expandable && !next.has(node.id)) {
            next.add(node.id);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
  }

  public isExpanded(node: ExploreNode): boolean {
    if (!node.expandable) return false;
    if (this.forceExpand()) return true;
    return this.expandedIds().has(node.id);
  }

  public isLibrarySelected(node: ExploreNode): boolean {
    return node.kind !== 'note' && this.selectedLibraryId() === node.id;
  }

  public isNoteSelected(node: ExploreNode): boolean {
    return node.kind === 'note' && this.selectedNoteId() === node.id;
  }

  public onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  public clearQuery(): void {
    this.query.set('');
  }

  public toggleNode(node: ExploreNode, event: Event): void {
    event.stopPropagation();
    this.toggleExpand(node);
  }

  /**
   * Row click selects and toggles, Obsidian-style: a collapsed library opens,
   * an open one closes. The twist arrow stays as the explicit toggle that
   * does not change selection. While filtering, branches are force-expanded
   * so toggling is a no-op and the click only selects.
   */
  public activate(node: ExploreNode): void {
    if (node.kind === 'note') {
      this.noteSelected.emit(node.id);
      return;
    }
    if (node.expandable && !this.forceExpand()) this.toggleExpand(node);
    this.librarySelected.emit(node.id);
  }

  private toggleExpand(node: ExploreNode): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  public nodeIcon(node: ExploreNode): string {
    if (node.kind === 'note') return 'description';
    if (node.kind === 'unfiled') return 'folder_open';
    return node.children.some((c) => c.kind !== 'note') ? 'folder' : 'folder_open';
  }

  private prune(nodes: ExploreNode[], q: string): ExploreNode[] {
    const result: ExploreNode[] = [];

    for (const node of nodes) {
      if (node.kind === 'note') {
        if (node.label.toLowerCase().includes(q)) result.push(node);
        continue;
      }

      const children = this.prune(node.children, q);
      if (children.length > 0) result.push({ ...node, children });
    }

    return result;
  }
}

function countNotes(nodes: ExploreNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + (node.kind === 'note' ? 1 : countNotes(node.children)),
    0,
  );
}
