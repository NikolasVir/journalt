import { ChangeDetectionStrategy, Component, EventEmitter, inject, Output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '@layout/layout.service';
import { APP_VERSION_INFO } from '@env/version';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
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
export class SidebarComponent {
  protected readonly layoutService = inject(LayoutService);
  protected readonly appVersion = APP_VERSION_INFO;
  protected readonly versionTooltip = `JournalT ${APP_VERSION_INFO.displayVersion} (${APP_VERSION_INFO.commit}) • Built ${APP_VERSION_INFO.buildDate}`;

  @Output() public readonly itemClicked = new EventEmitter<void>();

  protected readonly mainNavItems: NavItem[] = [
    { label: 'Home', route: '/dashboard', icon: 'lightbulb', exact: true },
    { label: 'Todos', route: '/todos', icon: 'check_circle' },
    { label: 'Explore', route: '/explore', icon: 'account_tree', exact: true },
    { label: 'Inbox', route: '/notes/inbox', icon: 'inbox' },
    { label: 'Notes', route: '/notes/notes', icon: 'edit_note' },
    { label: 'Journals', route: '/notes/journal', icon: 'menu_book' }
  ];

  protected readonly secondaryNavItems: NavItem[] = [
    { label: 'Libraries', route: '/libraries', icon: 'folder' },
    { label: 'Types', route: '/types', icon: 'schema' },
    { label: 'Tags', route: '/tags', icon: 'label' }
  ];

  protected readonly systemNavItems: NavItem[] = [
    { label: 'Trash', route: '/trash', icon: 'delete' },
    { label: 'Settings', route: '/settings', icon: 'settings' }
  ];
}
