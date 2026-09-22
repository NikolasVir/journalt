import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoteResponse } from '@core/models/note.model';
import { NoteCardComponent } from './note-card.component';

describe('NoteCardComponent', () => {
  let component: NoteCardComponent;
  let fixture: ComponentFixture<NoteCardComponent>;

  const mockNote: NoteResponse = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: '123e4567-e89b-12d3-a456-426614174001',
    level: 'Quick',
    title: 'Test Note Title',
    summary: 'Test summary',
    bodyMarkdown: 'Test markdown content',
    renderedHtml: '<p>Test markdown content</p>',
    isTodo: false,
    isTrashed: false,
    createdAtUtc: '2026-09-22T12:00:00Z',
    updatedAtUtc: '2026-09-22T12:00:00Z',
    tags: [{ tagType: 'FreeForm', category: null, value: 'testing' }],
    wikiLinks: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(NoteCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('note', mockNote);
    fixture.detectChanges();
  });

  it('should render title, rendered body, and tags', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.note-card__title')?.textContent).toContain('Test Note Title');
    expect(compiled.querySelector('.note-card__body')?.innerHTML).toContain('<p>Test markdown content</p>');
    expect(compiled.querySelector('.note-card__tag')?.textContent).toContain('#testing');
  });

  it('should emit cardClick when the card is clicked', () => {
    let clickedNote: NoteResponse | null = null;
    component.cardClick.subscribe((n) => {
      clickedNote = n;
    });

    const card = fixture.nativeElement.querySelector('.note-card') as HTMLElement;
    card.click();

    expect(clickedNote).toEqual(mockNote);
  });

  it('should emit toggleTodo when todo action button is clicked', () => {
    let toggledNote: NoteResponse | null = null;
    component.toggleTodo.subscribe((n) => {
      toggledNote = n;
    });

    const todoBtn = fixture.nativeElement.querySelector('button[aria-label="Toggle Todo"]') as HTMLButtonElement;
    todoBtn.click();

    expect(toggledNote).toEqual(mockNote);
  });
});
