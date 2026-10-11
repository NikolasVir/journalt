import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LibraryService } from '@core/services/library.service';
import { QuickCaptureComponent } from './quick-capture.component';
import { TypeDefinitionService } from '../../../core/services/type-definition.service';

describe('QuickCaptureComponent', () => {
  let component: QuickCaptureComponent;
  let fixture: ComponentFixture<QuickCaptureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickCaptureComponent],
      providers: [
        {
          provide: LibraryService,
          useValue: {
            list: () => of([]),
          },
        },
        {
          provide: TypeDefinitionService,
          useValue: {
            list: () => of([])
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(QuickCaptureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and start collapsed', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.capture-card__collapsed')).toBeTruthy();
    expect(compiled.querySelector('.capture-card__expanded')).toBeFalsy();
  });

  it('should expand when trigger input is focused or clicked', () => {
    component.expand('Inbox');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.capture-card__expanded')).toBeTruthy();
  });

  it('should emit createNote with title, body, and level when saved', () => {
    let emittedPayload: unknown = null;
    component.createNote.subscribe((payload) => {
      emittedPayload = payload;
    });

    component.expand('Note');
    fixture.detectChanges();

    (component as unknown as { title: { set: (v: string) => void } }).title.set('My Note Title');
    (component as unknown as { bodyMarkdown: { set: (v: string) => void } }).bodyMarkdown.set('Some markdown body');
    component.submit();

    expect(emittedPayload).toEqual({
      title: 'My Note Title',
      bodyMarkdown: 'Some markdown body',
      level: 'Note',
      format: 'Markdown',
      libraryId: undefined,
      typeId: undefined,
      typedMetadataJson: undefined,
      isTodo: false,
      tags: undefined
    });
  });

  it('should emit createNote with libraryId when a library is selected', () => {
    let emittedPayload: unknown = null;
    component.createNote.subscribe((payload) => {
      emittedPayload = payload;
    });

    component.expand('Note');
    fixture.detectChanges();

    (component as unknown as { title: { set: (v: string) => void } }).title.set('Work Note');
    (component as unknown as { bodyMarkdown: { set: (v: string) => void } }).bodyMarkdown.set('Work content');
    (component as unknown as { selectedLibraryId: { set: (v: string) => void } }).selectedLibraryId.set('lib-work-123');
    component.submit();

    expect(emittedPayload).toEqual({
      title: 'Work Note',
      bodyMarkdown: 'Work content',
      level: 'Note',
      format: 'Markdown',
      typeId: undefined,
      typedMetadataJson: undefined,
      isTodo: false,
      libraryId: 'lib-work-123',
      tags: undefined,
    });
  });

  it('should pre-select defaultLibraryId when supplied as input', () => {
    fixture.componentRef.setInput('defaultLibraryId', 'lib-default-456');
    fixture.detectChanges();

    expect((component as unknown as { selectedLibraryId: () => string }).selectedLibraryId()).toBe('lib-default-456');

    component.expand('Note');
    (component as unknown as { title: { set: (v: string) => void } }).title.set('Note in default lib');
    (component as unknown as { bodyMarkdown: { set: (v: string) => void } }).bodyMarkdown.set('Body');

    let emittedPayload: unknown = null;
    component.createNote.subscribe((payload) => {
      emittedPayload = payload;
    });
    component.submit();

    expect((emittedPayload as { libraryId?: string })?.libraryId).toBe('lib-default-456');
  });
});

