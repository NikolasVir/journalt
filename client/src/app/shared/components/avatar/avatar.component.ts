import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (hasValidImage()) {
      <img
        class="avatar__image"
        [src]="avatarUrl()!"
        [alt]="name()"
        (error)="onImageError()"
      />
    } @else {
      <div
        class="avatar__fallback"
        [style.background-color]="backgroundColor()"
        [style.font-size.px]="fontSize()"
        [attr.aria-label]="name()"
      >
        {{ initial() }}
      </div>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      user-select: none;
      vertical-align: middle;
      box-sizing: border-box;
    }

    .avatar__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 50%;
    }

    .avatar__fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 500;
      text-transform: uppercase;
      border-radius: 50%;
      line-height: 1;
      font-family: inherit;
    }
  `,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.min-width.px]': 'size()',
    '[style.min-height.px]': 'size()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  public readonly name = input<string>('');
  public readonly avatarUrl = input<string | null | undefined>(null);
  public readonly size = input<number>(36);

  private readonly imageError = linkedSignal({
    source: this.avatarUrl,
    computation: () => false,
  });

  protected readonly hasValidImage = computed(() => {
    const url = this.avatarUrl();
    return !!url && url.trim().length > 0 && !this.imageError();
  });

  protected readonly initial = computed(() => {
    const n = (this.name() || '').trim();
    return n.length > 0 ? n[0].toUpperCase() : '?';
  });

  protected readonly fontSize = computed(() => {
    return Math.max(11, Math.round(this.size() * 0.44));
  });

  private static readonly PALETTE = [
    '#1a73e8', // Google Blue
    '#d93025', // Red
    '#188038', // Green
    '#e37400', // Orange
    '#8e24aa', // Purple
    '#00897b', // Teal
    '#3949ab', // Indigo
    '#d81b60', // Pink
    '#0097a7', // Cyan
    '#5c6bc0', // Blue Grey
  ];

  protected readonly backgroundColor = computed(() => {
    const str = (this.name() || 'User').trim();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AvatarComponent.PALETTE.length;
    return AvatarComponent.PALETTE[index];
  });

  protected onImageError(): void {
    this.imageError.set(true);
  }
}
