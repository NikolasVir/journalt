import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Universal edit affordance — same pen everywhere (matches Explore viewer).
 * Dumb UI: parent decides navigation/dialog escalation. Stops propagation
 * so a pen click inside a card never also triggers cardClick.
 */
@Component({
  selector: 'app-note-edit-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './note-edit-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteEditButtonComponent {
  public readonly tooltip = input<string>('Edit note');
  public readonly ariaLabel = input<string>('Edit note');
  public readonly editRequested = output<void>();

  protected onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.editRequested.emit();
  }
}
