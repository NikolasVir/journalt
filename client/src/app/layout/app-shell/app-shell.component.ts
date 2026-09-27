import { ChangeDetectionStrategy, Component, inject, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { LayoutService } from '@layout/layout.service';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, MatSidenavModule],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent implements OnDestroy {
  protected readonly layoutService = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly subscription: Subscription;

  public constructor() {
    this.syncSidebarVisibility();
    this.subscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncSidebarVisibility();
        this.layoutService.closeMobileMenu();
      });
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.layoutService.setSidebarHidden(false);
  }

  /**
   * Explore owns the left edge with its own library tree, so it declares
   * `data: { hideSidebar: true }` and the global sidebar steps aside rather
   * than sitting beside a second tree column. Data is inherited by children,
   * so the whole segment is checked rather than only the deepest route.
   */
  private syncSidebarVisibility(): void {
    let route = this.router.routerState.snapshot.root;
    let hidden = false;

    while (route) {
      if (route.data['hideSidebar'] === true) hidden = true;
      if (!route.firstChild) break;
      route = route.firstChild;
    }

    this.layoutService.setSidebarHidden(hidden);
  }
}
