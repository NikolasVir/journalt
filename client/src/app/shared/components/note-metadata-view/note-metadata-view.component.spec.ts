import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoteMetadataViewComponent } from './note-metadata-view.component';

describe('NoteMetadataViewComponent', () => {
  let component: NoteMetadataViewComponent;
  let fixture: ComponentFixture<NoteMetadataViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoteMetadataViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NoteMetadataViewComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render nothing when metadataJson and summary are empty', () => {
    fixture.componentRef.setInput('metadataJson', null);
    fixture.componentRef.setInput('summary', null);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.meta-section');
    expect(el).toBeNull();
  });

  it('should render summary lead block when summary is provided', () => {
    fixture.componentRef.setInput('summary', 'This is a test summary for the note.');
    fixture.detectChanges();

    const summaryEl = fixture.nativeElement.querySelector('.meta-summary__text');
    expect(summaryEl).not.toBeNull();
    expect(summaryEl.textContent.trim()).toBe('This is a test summary for the note.');
  });

  it('should parse and render typed metadata properties', () => {
    const metadata = {
      status: 'active',
      priority: 'high',
      country_code: 'GR',
      locality: 'Athens',
      coordinates: { latitude: 37.9838, longitude: 23.7275 },
      aliases: ['Capital of Greece'],
      skills: [
        { name: 'TypeScript', level: 'substantial', context: 'Core language' }
      ]
    };

    fixture.componentRef.setInput('metadataJson', JSON.stringify(metadata));
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.meta-card__row');
    expect(rows.length).toBe(7);

    // Check status badge
    const statusBadge = fixture.nativeElement.querySelector('.meta-badge--success');
    expect(statusBadge).not.toBeNull();
    expect(statusBadge.textContent.trim()).toBe('active');

    // Check priority badge
    const priorityBadge = fixture.nativeElement.querySelector('.meta-badge--warning');
    expect(priorityBadge).not.toBeNull();
    expect(priorityBadge.textContent.trim()).toBe('high');

    // Check coordinates link
    const coordLink = fixture.nativeElement.querySelector('.meta-coord-link');
    expect(coordLink).not.toBeNull();
    expect(coordLink.getAttribute('href')).toContain('37.9838');
    expect(coordLink.getAttribute('href')).toContain('23.7275');

    // Check aliases chips
    const chip = fixture.nativeElement.querySelector('.meta-chip');
    expect(chip).not.toBeNull();
    expect(chip.textContent.trim()).toBe('Capital of Greece');

    // Check skill
    const skillName = fixture.nativeElement.querySelector('.meta-skill__name');
    expect(skillName).not.toBeNull();
    expect(skillName.textContent.trim()).toBe('TypeScript');
    const skillLevel = fixture.nativeElement.querySelector('.meta-skill__level--substantial');
    expect(skillLevel).not.toBeNull();
    expect(skillLevel.textContent.trim()).toBe('substantial');
  });

  it('should toggle collapse when clicking metadata header', () => {
    fixture.componentRef.setInput('metadataJson', JSON.stringify({ locality: 'Athens' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.meta-card__title').textContent.trim()).toBe('Metadata');
    expect(fixture.nativeElement.querySelector('.meta-card__content')).not.toBeNull();

    const header = fixture.nativeElement.querySelector('.meta-card__header');
    header.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.meta-card__content')).toBeNull();

    header.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.meta-card__content')).not.toBeNull();
  });

  it('should handle invalid JSON gracefully without error', () => {
    fixture.componentRef.setInput('metadataJson', 'invalid-json{{{');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.meta-section')).toBeNull();
  });
});
