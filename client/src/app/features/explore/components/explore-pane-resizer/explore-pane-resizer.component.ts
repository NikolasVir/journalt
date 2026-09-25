import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  EXPLORE_TREE_MAX_WIDTH,
  EXPLORE_TREE_MIN_WIDTH,
  LayoutService,
} from '@layout/layout.service';

/**
 * Drag handle between the Explore tree and the reader. While dragging, window
 * listeners track the pointer so the drag survives leaving the handle, and the
 * width is committed to LayoutService so it survives navigation and reloads.
 */
@Component({
  selector: 'app-explore-pane-resizer',
  standalone: true,
  template: '',
  host: {
    class: 'resizer',
    role: 'separator',
    tabindex: '0',
    'aria-orientation': 'vertical',
    '[attr.aria-label]': "'Resize tree column'",
    '[attr.aria-valuenow]': 'layoutService.exploreTreeWidth()',
    '[attr.aria-valuemin]': 'minWidth',
    '[attr.aria-valuemax]': 'maxWidth',
    '[class.resizer--active]': 'isResizing()',
    '(pointerdown)': 'onPointerDown($event)',
    '(keydown)': 'onKeyDown($event)',
    '(dblclick)': 'onDoubleClick()',
  },
  styles: `
    :host {
      display: block;
      width: 8px;
      cursor: col-resize;
      background: transparent;
      touch-action: none;
      user-select: none;
      z-index: 1;
    }

    :host::after {
      content: '';
      display: block;
      width: 100%;
      height: 100%;
      background: transparent;
      transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    :host:hover::after,
    :host:focus-visible::after,
    :host(.resizer--active)::after {
      background: var(--color-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePaneResizerComponent implements OnDestroy {
  protected readonly layoutService = inject(LayoutService);

  protected readonly minWidth = EXPLORE_TREE_MIN_WIDTH;
  protected readonly maxWidth = EXPLORE_TREE_MAX_WIDTH;

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly isResizing = signal<boolean>(false);

  private startX = 0;
  private startWidth = 0;
  private savedUserSelect = '';
  private savedCursor = '';
  private dragging = false;

  private readonly onWindowPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    this.layoutService.setExploreTreeWidth(
      this.clamp(this.startWidth + (event.clientX - this.startX)),
    );
  };

  private readonly onWindowPointerUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.isResizing.set(false);
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    window.removeEventListener('pointercancel', this.onWindowPointerUp);
    this.unlockTextSelection();
  };

  public onPointerDown(event: PointerEvent): void {
    // Primary button only, so a right-click does not start a drag.
    if (event.button !== 0 || this.dragging) return;

    event.preventDefault();
    this.hostRef.nativeElement.focus({ preventScroll: true });
    this.startX = event.clientX;
    this.startWidth = this.layoutService.exploreTreeWidth();
    this.dragging = true;
    this.isResizing.set(true);
    this.lockTextSelection();

    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
  }

  public onKeyDown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 48 : 16;
    const current = this.layoutService.exploreTreeWidth();
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        next = current - step;
        break;
      case 'ArrowRight':
        next = current + step;
        break;
      case 'Home':
        next = this.minWidth;
        break;
      case 'End':
        next = this.maxWidth;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.layoutService.setExploreTreeWidth(this.clamp(next));
  }

  public onDoubleClick(): void {
    this.layoutService.resetExploreTreeWidth();
  }

  public ngOnDestroy(): void {
    this.onWindowPointerUp();
    this.unlockTextSelection();
  }

  /**
   * Caps the tree at half the available width so the reader never collapses to
   * nothing on a narrow window, regardless of a stored width from a wide one.
   * Measured from the parent grid element, not the 8px handle itself.
   */
  private clamp(width: number): number {
    const containerWidth =
      this.hostRef.nativeElement.parentElement?.clientWidth || EXPLORE_TREE_MAX_WIDTH * 2;
    const ceiling = Math.min(
      EXPLORE_TREE_MAX_WIDTH,
      Math.max(this.minWidth, Math.floor(containerWidth / 2)),
    );
    return Math.min(Math.max(Math.round(width), this.minWidth), ceiling);
  }

  /** Stops the drag from selecting text in the tree or reader. */
  private lockTextSelection(): void {
    if (typeof document === 'undefined') return;
    this.savedUserSelect = document.body.style.userSelect;
    this.savedCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  private unlockTextSelection(): void {
    if (typeof document === 'undefined') return;
    document.body.style.userSelect = this.savedUserSelect;
    document.body.style.cursor = this.savedCursor;
  }
}
