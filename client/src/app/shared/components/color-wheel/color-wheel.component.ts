import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { hsvToHex, hexToHsv, normalizeHex } from '@core/utils/color.util';

const RING_SIZE = 148;
const RING_RADIUS = 62;
const AREA_SIZE = 148;

/**
 * Dependency-free interactive colour wheel.
 *
 * Outer ring selects the hue, the inner square selects saturation/value, and a
 * hex field allows precise entry. Pointer drag and full keyboard control are
 * both supported. Emits `valueChange` continuously while dragging and `commit`
 * once the interaction settles (so callers can persist on release).
 */
@Component({
  selector: 'app-color-wheel',
  standalone: true,
  template: `
    <div class="color-wheel">
      <div class="color-wheel__controls">
        <div
          #ring
          class="color-wheel__ring"
          role="slider"
          tabindex="0"
          aria-label="Hue"
          aria-valuemin="0"
          aria-valuemax="360"
          [attr.aria-valuenow]="Math.round(hue())"
          [attr.aria-valuetext]="Math.round(hue()) + ' degrees'"
          (pointerdown)="startDrag($event, 'hue', ring)"
          (pointermove)="moveDrag($event, 'hue', ring)"
          (pointerup)="endDrag($event, ring)"
          (pointercancel)="endDrag($event, ring)"
          (keydown)="onHueKey($event)"
        >
          <span
            class="color-wheel__ring-knob"
            [style.left.px]="ringKnob().left"
            [style.top.px]="ringKnob().top"
            [style.background]="preview()"
          ></span>
        </div>

        <div
          #area
          class="color-wheel__area"
          role="slider"
          tabindex="0"
          aria-label="Saturation and brightness"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="Math.round(sat() * 100)"
          (pointerdown)="startDrag($event, 'sv', area)"
          (pointermove)="moveDrag($event, 'sv', area)"
          (pointerup)="endDrag($event, area)"
          (pointercancel)="endDrag($event, area)"
          (keydown)="onAreaKey($event)"
        >
          <span
            class="color-wheel__area-knob"
            [style.left.px]="areaKnob().left"
            [style.top.px]="areaKnob().top"
            [style.background]="preview()"
          ></span>
        </div>
      </div>

      <div class="color-wheel__footer">
        <span class="color-wheel__preview" [style.background]="preview()" aria-hidden="true"></span>
        <input
          class="color-wheel__hex"
          type="text"
          inputmode="text"
          spellcheck="false"
          maxlength="7"
          aria-label="Hex colour value"
          [value]="preview()"
          (change)="onHexInput($event)"
          (blur)="onHexInput($event)"
        />
      </div>
    </div>
  `,
  styles: `
    .color-wheel {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md, 16px);
      width: fit-content;
    }

    .color-wheel__controls {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg, 24px);
      flex-wrap: wrap;
    }

    .color-wheel__ring,
    .color-wheel__area {
      position: relative;
      width: ${RING_SIZE}px;
      height: ${RING_SIZE}px;
      flex-shrink: 0;
      cursor: crosshair;
      touch-action: none;
      border-radius: 50%;

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 3px;
      }
    }

    .color-wheel__ring {
      background: conic-gradient(
        from 90deg,
        #ff0000,
        #ffff00,
        #00ff00,
        #00ffff,
        #0000ff,
        #ff00ff,
        #ff0000
      );

      /* Punch a hole so only the hue ring remains interactive-looking. */
      &::after {
        content: '';
        position: absolute;
        inset: 22px;
        border-radius: 50%;
        background: var(--color-bg-surface, #ffffff);
        border: 1px solid var(--color-border-card);
      }
    }

    .color-wheel__area {
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--color-border-card);
    }

    .color-wheel__ring-knob,
    .color-wheel__area-knob {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.3));
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1;
    }

    .color-wheel__area-knob {
      border-color: #ffffff;
    }

    .color-wheel__footer {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 8px);
    }

    .color-wheel__preview {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm, 4px);
      border: 1px solid var(--color-border-card);
      flex-shrink: 0;
    }

    .color-wheel__hex {
      width: 110px;
      padding: 6px 10px;
      font-family: var(--font-family-mono);
      font-size: var(--font-size-sm, 14px);
      color: var(--color-text-primary);
      background-color: var(--color-bg-input, #f1f3f4);
      border: 1px solid var(--color-border-card);
      border-radius: var(--radius-sm, 4px);

      &:focus {
        outline: 2px solid var(--color-border-focus);
        outline-offset: 1px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorWheelComponent {
  protected readonly Math = Math;

  public readonly value = model<string>('#1a73e8');
  public readonly commit = output<string>();

  protected readonly hue = signal<number>(0);
  protected readonly sat = signal<number>(1);
  protected readonly val = signal<number>(1);

  private readonly dragging = signal<'hue' | 'sv' | null>(null);

  protected readonly preview = computed(() =>
    hsvToHex({ h: this.hue(), s: this.sat(), v: this.val() })
  );

  protected readonly ringKnob = computed(() => {
    const angle = ((this.hue() - 90) * Math.PI) / 180;
    const center = RING_SIZE / 2;
    return {
      left: center + RING_RADIUS * Math.cos(angle),
      top: center + RING_RADIUS * Math.sin(angle),
    };
  });

  protected readonly areaKnob = computed(() => ({
    left: this.sat() * AREA_SIZE,
    top: (1 - this.val()) * AREA_SIZE,
  }));

  constructor() {
    const initial = hexToHsv(normalizeHex(this.value()) ?? '#1a73e8');
    this.hue.set(initial.h);
    this.sat.set(initial.s);
    this.val.set(initial.v);

    // Reflect externally-driven value changes (e.g. preset buttons) back into
    // the wheel without fighting our own emissions.
    effect(() => {
      const incoming = normalizeHex(this.value());
      if (!incoming) return;
      const current = hsvToHex({ h: this.hue(), s: this.sat(), v: this.val() });
      if (incoming !== current) {
        const hsv = hexToHsv(incoming);
        untracked(() => {
          this.hue.set(hsv.h);
          this.sat.set(hsv.s);
          this.val.set(hsv.v);
        });
      }
    });
  }

  protected startDrag(event: PointerEvent, kind: 'hue' | 'sv', el: HTMLElement): void {
    el.setPointerCapture(event.pointerId);
    this.dragging.set(kind);
    event.preventDefault();
    this.updateFromPointer(event, kind, el);
  }

  protected moveDrag(event: PointerEvent, kind: 'hue' | 'sv', el: HTMLElement): void {
    if (this.dragging() !== kind) return;
    this.updateFromPointer(event, kind, el);
  }

  protected endDrag(event: PointerEvent, el: HTMLElement): void {
    if (this.dragging() === null) return;
    if (el.hasPointerCapture?.(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    this.dragging.set(null);
    this.commit.emit(this.preview());
  }

  private updateFromPointer(event: PointerEvent, kind: 'hue' | 'sv', el: HTMLElement): void {
    const rect = el.getBoundingClientRect();
    if (kind === 'hue') {
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      angle = ((angle % 360) + 360) % 360;
      this.hue.set(angle);
    } else {
      const s = clamp01((event.clientX - rect.left) / rect.width);
      const v = 1 - clamp01((event.clientY - rect.top) / rect.height);
      this.sat.set(s);
      this.val.set(v);
    }
    this.value.set(this.preview());
  }

  protected onHueKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 10 : 2;
    let handled = true;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') this.hue.update((h) => (h + step) % 360);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') this.hue.update((h) => (h - step + 360) % 360);
    else handled = false;
    if (handled) {
      event.preventDefault();
      this.value.set(this.preview());
      this.commit.emit(this.preview());
    }
  }

  protected onAreaKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.1 : 0.02;
    let handled = true;
    if (event.key === 'ArrowRight') this.sat.update((s) => clamp01(s + step));
    else if (event.key === 'ArrowLeft') this.sat.update((s) => clamp01(s - step));
    else if (event.key === 'ArrowUp') this.val.update((v) => clamp01(v + step));
    else if (event.key === 'ArrowDown') this.val.update((v) => clamp01(v - step));
    else handled = false;
    if (handled) {
      event.preventDefault();
      this.value.set(this.preview());
      this.commit.emit(this.preview());
    }
  }

  protected onHexInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = normalizeHex(input.value);
    if (normalized) {
      this.value.set(normalized);
      this.commit.emit(normalized);
    } else {
      input.value = this.preview();
    }
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
