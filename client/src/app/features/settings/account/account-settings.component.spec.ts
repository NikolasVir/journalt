import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AccountSettingsComponent } from './account-settings.component';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { ApiKeyService } from '@core/services/api-key.service';
import { NotificationService } from '@core/services/notification.service';
import { Router } from '@angular/router';

describe('AccountSettingsComponent', () => {
  let fixture: ComponentFixture<AccountSettingsComponent>;
  let component: AccountSettingsComponent;
  let authServiceMock: Partial<AuthService>;
  let userServiceMock: Partial<UserService>;
  let apiKeyServiceMock: Partial<ApiKeyService>;
  let notificationMock: Partial<NotificationService>;
  let routerMock: Partial<Router>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userName: 'testuser',
    avatarUrl: null
  };

  beforeEach(async () => {
    authServiceMock = {
      currentUser: signal(mockUser as any),
      changePassword: vi.fn().mockReturnValue(of({ message: 'Password changed successfully.' })),
      updateCurrentUser: vi.fn(),
      logout: vi.fn().mockReturnValue(of(undefined))
    };

    userServiceMock = {
      updateAvatar: vi.fn().mockReturnValue(of({ ...mockUser, avatarUrl: 'https://example.com/avatar.png' })),
      search: vi.fn().mockReturnValue(of([]))
    };

    apiKeyServiceMock = {
      getAll: vi.fn().mockReturnValue(of([])),
      create: vi.fn().mockReturnValue(of({ id: '1', name: 'key1', plaintextKey: 'jrt_123' } as any)),
      revoke: vi.fn().mockReturnValue(of(undefined))
    };

    notificationMock = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn()
    };

    routerMock = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true))
    };

    await TestBed.configureTestingModule({
      imports: [AccountSettingsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: ApiKeyService, useValue: apiKeyServiceMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: Router, useValue: routerMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('validates password change requirements correctly', () => {
    expect((component as any).canChangePassword()).toBe(false);

    (component as any).currentPassword.set('oldpass');
    expect((component as any).canChangePassword()).toBe(false);

    (component as any).newPassword.set('12345678');
    (component as any).confirmPassword.set('12345678');
    // Less than 9 characters
    expect((component as any).canChangePassword()).toBe(false);

    (component as any).newPassword.set('123456789');
    (component as any).confirmPassword.set('different');
    // Mismatched confirmation
    expect((component as any).canChangePassword()).toBe(false);

    (component as any).confirmPassword.set('123456789');
    // Valid!
    expect((component as any).canChangePassword()).toBe(true);
  });

  it('changes password successfully and resets fields', () => {
    (component as any).currentPassword.set('oldpass');
    (component as any).newPassword.set('newpass123');
    (component as any).confirmPassword.set('newpass123');

    component.changePassword();

    expect(authServiceMock.changePassword).toHaveBeenCalledWith({
      currentPassword: 'oldpass',
      newPassword: 'newpass123'
    });
    expect((component as any).currentPassword()).toBe('');
    expect((component as any).newPassword()).toBe('');
    expect((component as any).confirmPassword()).toBe('');
    expect(notificationMock.showSuccess).toHaveBeenCalledWith('Password updated successfully.');
  });

  it('removes avatar when requested', () => {
    component.removeAvatar();

    expect(userServiceMock.updateAvatar).toHaveBeenCalledWith(null);
    expect(authServiceMock.updateCurrentUser).toHaveBeenCalled();
    expect(notificationMock.showSuccess).toHaveBeenCalledWith('Avatar removed.');
  });
});
