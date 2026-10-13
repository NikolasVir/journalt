import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { VaultService } from './vault.service';

describe('VaultService', () => {
  let service: VaultService;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        VaultService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    service = TestBed.inject(VaultService);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.lock();
  });

  it('should be created in a locked state', () => {
    expect(service).toBeTruthy();
    expect(service.isUnlocked()).toBe(false);
    expect(service.notes().length).toBe(0);
    expect(service.autoLockSecondsRemaining()).toBe(300);
  });

  it('should lock immediately and purge state on lock()', () => {
    // Manually simulate unlocked state
    service.isUnlocked.set(true);
    service.autoLockSecondsRemaining.set(120);

    service.lock();

    expect(service.isUnlocked()).toBe(false);
    expect(service.notes()).toEqual([]);
  });

  it('should reset auto-lock timer to 300 seconds on resetAutoLockTimer()', () => {
    service.autoLockSecondsRemaining.set(45);
    service.resetAutoLockTimer();
    expect(service.autoLockSecondsRemaining()).toBe(300);
  });

  it('should not reset clock on recordActivity() if vault is locked', () => {
    service.isUnlocked.set(false);
    service.autoLockSecondsRemaining.set(100);

    service.recordActivity();

    expect(service.autoLockSecondsRemaining()).toBe(100);
  });

  it('should reset clock on recordActivity() if vault is unlocked and timer has decreased', () => {
    service.isUnlocked.set(true);
    service.autoLockSecondsRemaining.set(100);
    // Simulate elapsed throttle window
    (service as any).lastActivityReset = Date.now() - 3000;

    service.recordActivity();

    expect(service.autoLockSecondsRemaining()).toBe(300);
  });

  it('should reset clock when pointerdown or keydown events occur on /vault while unlocked', () => {
    service.isUnlocked.set(true);
    service.autoLockSecondsRemaining.set(150);
    (service as any).lastActivityReset = Date.now() - 3000;

    // Simulate router url is on /vault
    Object.defineProperty(router, 'url', { value: '/vault', configurable: true });

    // Dispatch pointerdown event (simulating clicking on a note)
    window.dispatchEvent(new PointerEvent('pointerdown'));

    expect(service.autoLockSecondsRemaining()).toBe(300);

    // Simulate clock countdown
    service.autoLockSecondsRemaining.set(200);
    (service as any).lastActivityReset = Date.now() - 3000;

    // Dispatch keydown event (simulating typing in note dialog or search)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(service.autoLockSecondsRemaining()).toBe(300);
  });

  it('should NOT reset clock if user activity happens outside /vault route', () => {
    service.isUnlocked.set(true);
    service.autoLockSecondsRemaining.set(150);
    (service as any).lastActivityReset = Date.now() - 3000;

    // Simulate router url is on /dashboard
    Object.defineProperty(router, 'url', { value: '/dashboard', configurable: true });

    window.dispatchEvent(new PointerEvent('pointerdown'));

    expect(service.autoLockSecondsRemaining()).toBe(150);
  });

  it('should NOT reset clock on Escape key to avoid interfering with panic hotkey', () => {
    service.isUnlocked.set(true);
    service.autoLockSecondsRemaining.set(150);
    (service as any).lastActivityReset = Date.now() - 3000;

    Object.defineProperty(router, 'url', { value: '/vault', configurable: true });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(service.autoLockSecondsRemaining()).toBe(150);
  });

  it('should discard an auto-created vault on lock when nothing changed', () => {
    (service as any).ephemeralVault = true;
    (service as any).vaultDirty = false;
    service.isUnlocked.set(true);
    service.currentPartitionToken.set('token-unused');

    service.lock();

    const req = httpMock.expectOne(
      (r) => r.method === 'DELETE' && r.urlWithParams.startsWith('/api/vault?')
    );
    expect(req.request.urlWithParams).toContain('partitionToken=token-unused');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.isUnlocked()).toBe(false);
    expect(service.currentPartitionToken()).toBeNull();
  });

  it('should keep an auto-created vault on lock once the user changed something', () => {
    (service as any).ephemeralVault = true;
    (service as any).vaultDirty = true;
    service.isUnlocked.set(true);
    service.currentPartitionToken.set('token-used');

    service.lock();

    httpMock.expectNone((r) => r.method === 'DELETE' && r.urlWithParams.startsWith('/api/vault?'));
    expect(service.isUnlocked()).toBe(false);
  });

  it('should not discard a pre-existing vault on lock', () => {
    (service as any).ephemeralVault = false;
    (service as any).vaultDirty = false;
    service.isUnlocked.set(true);
    service.currentPartitionToken.set('token-existing');

    service.lock();

    httpMock.expectNone((r) => r.method === 'DELETE' && r.urlWithParams.startsWith('/api/vault?'));
  });
});
