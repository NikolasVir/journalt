import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LayoutService } from '@layout/layout.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  protected readonly layoutService = inject(LayoutService);
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.layoutService.setSearchQuery(target.value);
  }

  public clearSearch(): void {
    this.layoutService.setSearchQuery('');
  }

  public onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/auth/login']);
      }
    });
  }
}
