import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  EXPLORE_TREE_MAX_WIDTH,
  EXPLORE_TREE_MIN_WIDTH,
  NOTE_METADATA_MAX_WIDTH,
  NOTE_METADATA_MIN_WIDTH,
  LayoutService,
} from '@layout/layout.service';

/**
 * Drag handle between Explore panes. While dragging, window listeners track
 * the pointer so the drag survives leaving the handle, and the width is
 * committed to LayoutService so it survives navigation and reloads.
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
    '[attr.aria-label]': "target() === 'tree' ? 'Resize tree column' : 'Resize metadata column'",
    '[attr.aria-valuenow]': "target() === 'tree' ? layoutService.exploreTreeWidth() : layoutService.noteMetadataWidth()",
    '[attr.aria-valuemin]': 'minWidth()',
    '[attr.aria-valuemax]': 'maxWidth()',
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
  public readonly target = input<'tree' | 'metadata'>('tree');

  protected readonly minWidth = computed(() =>
    this.target() === 'tree' ? EXPLORE_TREE_MIN_WIDTH : NOTE_METADATA_MIN_WIDTH
  );
  protected readonly maxWidth = computed(() =>
    this.target() === 'tree' ? EXPLORE_TREE_MAX_WIDTH : NOTE_METADATA_MAX_WIDTH
  );

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly isResizing = signal<boolean>(false);

  private startX = 0;
  private startWidth = 0;
  private savedUserSelect = '';
  private savedCursor = '';
  private dragging = false;

  private readonly onWindowPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const nextWidth = this.clamp(this.startWidth + (event.clientX - this.startX));
    if (this.target() === 'tree') {
      this.layoutService.setExploreTreeWidth(nextWidth);
    } else {
      this.layoutService.setNoteMetadataWidth(nextWidth);
    }
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
    this.startWidth = this.target() === 'tree'
      ? this.layoutService.exploreTreeWidth()
      : this.layoutService.noteMetadataWidth();
    this.dragging = true;
    this.isResizing.set(true);
    this.lockTextSelection();

    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
  }

  public onKeyDown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 48 : 16;
    const isTree = this.target() === 'tree';
    const current = isTree
      ? this.layoutService.exploreTreeWidth()
      : this.layoutService.noteMetadataWidth();
    const min = isTree ? EXPLORE_TREE_MIN_WIDTH : NOTE_METADATA_MIN_WIDTH;
    const max = isTree ? EXPLORE_TREE_MAX_WIDTH : NOTE_METADATA_MAX_WIDTH;
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        next = current - step;
        break;
      case 'ArrowRight':
        next = current + step;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }

    event.preventDefault();
    const clamped = this.clamp(next);
    if (isTree) {
      this.layoutService.setExploreTreeWidth(clamped);
    } else {
      this.layoutService.setNoteMetadataWidth(clamped);
    }
  }

  public onDoubleClick(): void {
    if (this.target() === 'tree') {
      this.layoutService.resetExploreTreeWidth();
    } else {
      this.layoutService.resetNoteMetadataWidth();
    }
  }

  public ngOnDestroy(): void {
    this.onWindowPointerUp();
    this.unlockTextSelection();
  }

  /**
   * Caps the column at half the available container width.
   */
  private clamp(width: number): number {
    const isTree = this.target() === 'tree';
    const min = isTree ? EXPLORE_TREE_MIN_WIDTH : NOTE_METADATA_MIN_WIDTH;
    const max = isTree ? EXPLORE_TREE_MAX_WIDTH : NOTE_METADATA_MAX_WIDTH;
    const containerWidth =
      this.hostRef.nativeElement.parentElement?.clientWidth || max * 2;
    const ceiling = Math.min(
      max,
      Math.max(min, Math.floor(containerWidth / 2)),
    );
    return Math.min(Math.max(Math.round(width), min), ceiling);
  }

  /** Stops the drag from selecting text in neighboring panes. */
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
