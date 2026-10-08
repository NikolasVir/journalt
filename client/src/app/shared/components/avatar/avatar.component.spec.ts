import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let fixture: ComponentFixture<AvatarComponent>;
  let component: AvatarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
    component = fixture.componentInstance;
  });

  it('renders initial fallback when avatarUrl is not provided', () => {
    fixture.componentRef.setInput('name', 'Antigravity');
    fixture.detectChanges();

    const fallbackEl = fixture.nativeElement.querySelector('.avatar__fallback');
    expect(fallbackEl).toBeTruthy();
    expect(fallbackEl.textContent.trim()).toBe('A');
  });

  it('renders image when avatarUrl is valid', () => {
    fixture.componentRef.setInput('name', 'Alice');
    fixture.componentRef.setInput('avatarUrl', 'https://example.com/alice.png');
    fixture.detectChanges();

    const imgEl = fixture.nativeElement.querySelector('.avatar__image');
    expect(imgEl).toBeTruthy();
    expect(imgEl.getAttribute('src')).toBe('https://example.com/alice.png');
  });

  it('falls back to initial when image load fails', () => {
    fixture.componentRef.setInput('name', 'Bob');
    fixture.componentRef.setInput('avatarUrl', 'https://example.com/bad.png');
    fixture.detectChanges();

    const imgEl = fixture.nativeElement.querySelector('.avatar__image');
    expect(imgEl).toBeTruthy();

    imgEl.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const fallbackEl = fixture.nativeElement.querySelector('.avatar__fallback');
    expect(fallbackEl).toBeTruthy();
    expect(fallbackEl.textContent.trim()).toBe('B');
  });
});
