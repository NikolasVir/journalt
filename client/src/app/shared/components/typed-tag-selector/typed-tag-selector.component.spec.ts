import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TagDto } from '@core/models/note.model';
import { TagDefinitionService } from '@core/services/tag-definition.service';
import { TypedTagSelectorComponent } from './typed-tag-selector.component';

interface SelectorTestApi {
  selectCategory(category: string): void;
  updateSearch(event: Event): void;
  addValue(value: string): void;
  removeTag(tag: TagDto): void;
  filteredValues(): string[];
}

describe('TypedTagSelectorComponent', () => {
  let component: TypedTagSelectorComponent;
  let fixture: ComponentFixture<TypedTagSelectorComponent>;
  let emittedTags: TagDto[] | null;

  beforeEach(async () => {
    emittedTags = null;

    await TestBed.configureTestingModule({
      imports: [TypedTagSelectorComponent],
      providers: [
        provideRouter([]),
        {
          provide: TagDefinitionService,
          useValue: {
            options: () =>
              of([
                { id: 'status-id', category: 'status', isClosed: true, values: ['active', 'done'] },
                { id: 'topic-id', category: 'topic', isClosed: false, values: ['math', 'systems'] },
                { id: 'personal-id', category: 'personal', isClosed: false, values: [] },
              ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TypedTagSelectorComponent);
    component = fixture.componentInstance;
    component.selectedTagsChange.subscribe((tags) => (emittedTags = tags));
    fixture.componentRef.setInput('selectedTags', []);
    fixture.detectChanges();
  });

  it('loads registry categories and selectable values', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Manage tag definitions');
    expect(compiled.textContent).not.toContain('unmatched text is not added');
  });

  it('adds an open category as a category-only tag', () => {
    const api = component as unknown as SelectorTestApi;
    api.selectCategory('personal');

    expect(emittedTags).toEqual([{ tagType: 'Typed', category: 'personal', value: null }]);
  });

  it('filters values while typing and never emits an unmatched value', () => {
    const api = component as unknown as SelectorTestApi;
    api.selectCategory('status');

    const input = document.createElement('input');
    input.value = 'act';
    api.updateSearch({ target: input } as unknown as Event);
    expect(api.filteredValues()).toEqual(['active']);

    api.addValue('missing');
    expect(emittedTags).toBeNull();

    api.addValue('active');
    expect(emittedTags).toEqual([{ tagType: 'Typed', category: 'status', value: 'active' }]);
  });

  it('removes a selected tag by emitting the remaining selection', () => {
    const selected: TagDto[] = [{ tagType: 'Typed', category: 'status', value: 'active' }];
    fixture.componentRef.setInput('selectedTags', selected);
    fixture.detectChanges();

    const api = component as unknown as SelectorTestApi;
    api.removeTag(selected[0]);

    expect(emittedTags).toEqual([]);
  });
});
