import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { LayoutService } from '@layout/layout.service';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    AvatarComponent
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  protected readonly layoutService = inject(LayoutService);
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  public onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const query = target.value;
    this.layoutService.setSearchQuery(query);
    this.updateQueryParam(query);
  }

  public clearSearch(): void {
    this.layoutService.setSearchQuery('');
    this.updateQueryParam('');
  }

  private updateQueryParam(query: string): void {
    const q = query.trim() || null;
    void this.router.navigate([], {
      queryParams: { q },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  public onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/auth/login']);
      }
    });
  }
}
