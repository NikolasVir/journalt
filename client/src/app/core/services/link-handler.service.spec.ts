import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LinkHandlerService } from './link-handler.service';

describe('LinkHandlerService', () => {
  let router: Router;

  function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    anchor.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    TestBed.inject(LinkHandlerService).init();
  });

  afterEach(() => {
    try {
      TestBed.inject(LinkHandlerService).destroy();
    } catch {
      // TestBed already torn down; listener removed via ngOnDestroy.
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(TestBed.inject(LinkHandlerService)).toBeTruthy();
  });

  it('should force external links into a new tab', () => {
    document.body.innerHTML = '<a href="https://example.com">ext</a>';
    const anchor = document.querySelector('a')!;
    const event = click(anchor);

    expect(event.defaultPrevented).toBe(false);
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toContain('noopener');
    expect(anchor.getAttribute('rel')).toContain('noreferrer');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should route internal links in the same tab via the router', () => {
    document.body.innerHTML = '<a href="/notes/11111111-1111-1111-1111-111111111111">wiki</a>';
    const anchor = document.querySelector('a')!;
    const event = click(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/notes/11111111-1111-1111-1111-111111111111');
  });

  it('should repair legacy internal links stamped with target blank', () => {
    document.body.innerHTML = '<a href="/notes/11111111-1111-1111-1111-111111111111" target="_blank">wiki</a>';
    const anchor = document.querySelector('a')!;
    const event = click(anchor);

    expect(event.defaultPrevented).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalled();
  });

  it('should skip clicks already handled by components', () => {
    document.body.innerHTML = '<a href="/notes/11111111-1111-1111-1111-111111111111">wiki</a>';
    const anchor = document.querySelector('a')!;
    // A component handler ran first and already called preventDefault().
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    event.preventDefault();
    anchor.dispatchEvent(event);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should let modifier clicks through to the browser', () => {
    document.body.innerHTML = '<a href="/notes/11111111-1111-1111-1111-111111111111">wiki</a>';
    const anchor = document.querySelector('a')!;
    const event = click(anchor, { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should ignore mailto, hash, and download links', () => {
    document.body.innerHTML =
      '<a href="mailto:a@b.c">m</a><a href="#frag">h</a><a href="https://example.com/f" download>d</a>';
    const anchors = [...document.querySelectorAll('a')];
    for (const anchor of anchors) {
      const event = click(anchor);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
