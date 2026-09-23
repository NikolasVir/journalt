import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownEnhancerService } from '@core/services/markdown-enhancer.service';
import { NoteResponse } from '@core/models/note.model';
import { NoteService } from '@core/services/note.service';
import { NoteDialogComponent } from './note-dialog.component';

interface DialogEvent {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}

describe('NoteDialogComponent', () => {
  let component: NoteDialogComponent;
  let fixture: ComponentFixture<NoteDialogComponent>;
  let closeCount: number;

  const note: NoteResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: '123e4567-e89b-12d3-a456-426614174001',
    level: 'Quick',
    title: 'Test note',
    bodyMarkdown: '',
    renderedHtml: '',
    isTodo: false,
    isTrashed: false,
    createdAtUtc: '2026-09-23T17:00:00Z',
    updatedAtUtc: '2026-09-23T17:00:00Z',
    tags: [],
  };

  beforeEach(async () => {
    closeCount = 0;

    await TestBed.configureTestingModule({
      imports: [NoteDialogComponent],
      providers: [
        provideRouter([]),
        {
          provide: NoteService,
          useValue: {
            renderPreview: () => ({ subscribe: () => undefined }),
          },
        },
        {
          provide: MarkdownEnhancerService,
          useValue: { enhance: () => Promise.resolve() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NoteDialogComponent);
    component = fixture.componentInstance;
    component.close.subscribe(() => closeCount++);
    fixture.componentRef.setInput('note', note);
    fixture.detectChanges();
  });

  it('closes after a normal backdrop click', () => {
    const backdrop = document.createElement('div');
    const event = { target: backdrop, currentTarget: backdrop } as DialogEvent;

    component.onBackdropPointerDown(event as PointerEvent);
    component.onBackdropClick(event as MouseEvent);

    expect(closeCount).toBe(1);
  });

  it('stays open when a drag starts inside and ends on the backdrop', () => {
    const panel = document.createElement('div');
    const backdrop = document.createElement('div');

    component.onBackdropPointerDown({
      target: panel,
      currentTarget: backdrop,
    } as unknown as PointerEvent);
    component.onBackdropClick({
      target: backdrop,
      currentTarget: backdrop,
    } as unknown as MouseEvent);

    expect(closeCount).toBe(0);
  });

  it('stays open when a drag starts on the backdrop and ends inside', () => {
    const panel = document.createElement('div');
    const backdrop = document.createElement('div');

    component.onBackdropPointerDown({
      target: backdrop,
      currentTarget: backdrop,
    } as unknown as PointerEvent);
    component.onBackdropClick({
      target: panel,
      currentTarget: backdrop,
    } as unknown as MouseEvent);

    expect(closeCount).toBe(0);
  });
});
