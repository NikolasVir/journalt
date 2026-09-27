import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { formatTag, TagDto } from '@core/models/note.model';
import { TagOptionResponse } from '@core/models/tag-definition.model';
import { TagDefinitionService } from '@core/services/tag-definition.service';

@Component({
  selector: 'app-typed-tag-selector',
  standalone: true,
  imports: [
    RouterLink,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './typed-tag-selector.component.html',
  styleUrl: './typed-tag-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypedTagSelectorComponent implements OnInit {
  private readonly tagDefinitionService = inject(TagDefinitionService);

  public readonly selectedTags = input<TagDto[]>([]);
  public readonly selectedTagsChange = output<TagDto[]>();

  protected readonly options = signal<TagOptionResponse[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly activeCategory = signal<string | null>(null);
  protected readonly valueSearch = signal<string>('');

  protected readonly categories = computed(() => this.options().map((option) => option.category));

  protected readonly activeOption = computed(
    () => this.options().find((option) => option.category === this.activeCategory()) ?? null,
  );

  protected readonly filteredValues = computed(() => {
    const option = this.activeOption();
    const search = this.valueSearch().trim().toLowerCase();
    if (!option) return [];

    return option.values.filter((value) => {
      if (this.isSelected(option.category, value)) return false;
      return !search || value.toLowerCase().includes(search);
    });
  });

  protected readonly valuePlaceholder = computed(() => {
    if (!this.activeCategory()) return 'Select a category first';
    if (!this.activeOption()?.values?.length) return '';
    return 'Type to filter registered values';
  });

  constructor() {
    effect(() => {
      const categories = this.categories();
      const active = this.activeCategory();

      if (active && categories.includes(active)) return;
      if (active) this.activeCategory.set(null);
      this.valueSearch.set('');
    });
  }

  public ngOnInit(): void {
    this.loadOptions();
  }

  protected loadOptions(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.tagDefinitionService.options().subscribe({
      next: (options) => {
        this.options.set(options);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load tag definitions.');
        this.isLoading.set(false);
      },
    });
  }

  protected selectCategory(category: string): void {
    this.activeCategory.set(category);
    this.valueSearch.set('');

    const option = this.options().find((candidate) => candidate.category === category);
    if (option && !option.isClosed) {
      this.addCategoryTag(category);
    }
  }

  private addCategoryTag(category: string): void {
    if (this.isSelected(category, null)) return;

    this.selectedTagsChange.emit([
      ...this.selectedTags(),
      { tagType: 'Typed', category, value: null },
    ]);
  }

  protected updateSearch(event: Event): void {
    this.valueSearch.set((event.target as HTMLInputElement).value);
  }

  protected addValue(value: string): void {
    const category = this.activeCategory();
    const option = this.activeOption();
    if (!category || !option || !option.values.includes(value)) return;

    const canonicalValue = option.values.find(
      (candidate) => candidate.toLowerCase() === value.toLowerCase(),
    );
    if (!canonicalValue || this.isSelected(category, canonicalValue)) return;

    this.selectedTagsChange.emit([
      ...this.selectedTags(),
      { tagType: 'Typed', category, value: canonicalValue },
    ]);
    this.valueSearch.set('');
  }

  protected removeTag(tag: TagDto): void {
    this.selectedTagsChange.emit(
      this.selectedTags().filter((selected) => !this.sameTag(selected, tag)),
    );
  }

  protected isSelected(category: string, value: string | null): boolean {
    return this.selectedTags().some((tag) =>
      this.sameTag(tag, { tagType: 'Typed', category, value }),
    );
  }

  protected tagKey(tag: TagDto): string {
    return `${tag.category?.toLowerCase() ?? ''}:${tag.value?.toLowerCase() ?? ''}`;
  }

  protected formatTag(tag: TagDto): string {
    return formatTag(tag);
  }

  private sameTag(left: TagDto, right: TagDto): boolean {
    return (
      left.tagType === 'Typed' &&
      right.tagType === 'Typed' &&
      left.category?.toLowerCase() === right.category?.toLowerCase() &&
      left.value?.toLowerCase() === right.value?.toLowerCase()
    );
  }
}
