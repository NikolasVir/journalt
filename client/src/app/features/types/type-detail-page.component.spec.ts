import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TypeDefinitionResponse } from '@core/models/type-definition.model';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import { TypeDetailPageComponent } from './type-detail-page.component';

describe('TypeDetailPageComponent', () => {
  let component: TypeDetailPageComponent;
  let fixture: ComponentFixture<TypeDetailPageComponent>;
  let mockTypeService: {
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockNotification: {
    showSuccess: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
    showInfo: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockParamMapGet: ReturnType<typeof vi.fn>;

  const sampleType: TypeDefinitionResponse = {
    id: 'type-123',
    name: 'Existing Type',
    description: 'Existing description',
    version: 1,
    isActive: true,
    schemaJson: JSON.stringify({
      type: 'object',
      properties: {
        attendees: { type: 'array' },
        meetingDate: { type: 'string' },
      },
      required: ['meetingDate'],
    }),
    sectionsJson: JSON.stringify([
      { heading: 'Summary', level: 2, required: true, allowMultiple: false },
      { heading: 'Action Items', level: 2, required: true, allowMultiple: false },
    ]),
    createdAtUtc: '2026-10-01T12:00:00Z',
  };

  const setupTestBed = async (routeId: string | null = null) => {
    mockTypeService = {
      getById: vi.fn().mockReturnValue(of(sampleType)),
      create: vi.fn().mockReturnValue(of(sampleType)),
      update: vi.fn().mockReturnValue(of(sampleType)),
    };

    mockNotification = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true)),
    };

    mockParamMapGet = vi.fn().mockReturnValue(routeId);

    await TestBed.configureTestingModule({
      imports: [TypeDetailPageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: TypeDefinitionService, useValue: mockTypeService },
        { provide: NotificationService, useValue: mockNotification },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: mockParamMapGet,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TypeDetailPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('Create Mode (/types/new)', () => {
    beforeEach(async () => {
      await setupTestBed(null);
    });

    it('initializes in create mode with empty fields', () => {
      expect(component['isEdit']()).toBe(false);
      expect(component['name']()).toBe('');
      expect(component['description']()).toBe('');
      expect(component['fields']()).toEqual([]);
      expect(component['sections']()).toEqual([]);
      expect(mockTypeService.getById).not.toHaveBeenCalled();
    });

    it('navigates back to /settings/types on goBack()', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/settings/types']);
    });

    it('applies presets correctly', () => {
      component.applyPreset('meeting');
      expect(component['name']()).toBe('Meeting Note');
      expect(component['fields']().length).toBe(2);
      expect(component['sections']().length).toBe(3);

      component.applyPreset('decision');
      expect(component['name']()).toBe('Decision Record');
      expect(component['fields']().length).toBe(2);
      expect(component['sections']().length).toBe(3);

      component.applyPreset('book');
      expect(component['name']()).toBe('Book Review');
      expect(component['fields']().length).toBe(3);
      expect(component['sections']().length).toBe(3);
    });

    it('manages metadata fields: add, update, remove', () => {
      component.addField();
      expect(component['fields']().length).toBe(1);

      component.updateFieldName(0, 'summary');
      component.updateFieldType(0, 'string');
      component.updateFieldRequired(0, true);
      expect(component['fields']()[0]).toEqual({
        name: 'summary',
        type: 'string',
        required: true,
      });

      component.removeField(0);
      expect(component['fields']().length).toBe(0);
    });

    it('manages section templates: add, update, move, remove', () => {
      component.addSection();
      component.addSection();
      expect(component['sections']().length).toBe(2);

      component.updateSectionHeading(0, 'First Section');
      component.updateSectionLevel(0, 1);
      component.updateSectionRequired(0, true);
      component.updateSectionHeading(1, 'Second Section');
      component.updateSectionAllowMultiple(1, true);

      // Move section 0 down
      component.moveSection(0, 'down');
      expect(component['sections']()[0].heading).toBe('Second Section');
      expect(component['sections']()[1].heading).toBe('First Section');

      // Move section 1 up
      component.moveSection(1, 'up');
      expect(component['sections']()[0].heading).toBe('First Section');

      component.removeSection(0);
      expect(component['sections']().length).toBe(1);
      expect(component['sections']()[0].heading).toBe('Second Section');
    });

    it('synchronizes state when switching builder mode between visual and json', () => {
      component.addField();
      component.updateFieldName(0, 'priority');
      component.updateFieldType(0, 'number');

      // Switch to JSON
      component.setBuilderMode('json');
      expect(component['builderMode']()).toBe('json');
      const parsed = JSON.parse(component['rawSchemaJson']());
      expect(parsed.properties.priority.type).toBe('number');

      // Switch back to visual
      component.setBuilderMode('visual');
      expect(component['builderMode']()).toBe('visual');
      expect(component['fields']()[0].name).toBe('priority');
    });

    it('creates a new type definition when saveType is called', () => {
      component['name'].set('New Custom Type');
      component.addField();
      component.updateFieldName(0, 'tags');
      component.updateFieldType(0, 'array');

      component.saveType();

      expect(mockTypeService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Custom Type',
          schemaJson: expect.stringContaining('"tags"'),
        }),
      );
      expect(mockNotification.showSuccess).toHaveBeenCalledWith(
        expect.stringContaining('created successfully'),
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/settings/types']);
    });

    it('rejects duplicate field names in visual mode', () => {
      component['name'].set('Duplicate Field Test');
      component.addField();
      component.updateFieldName(0, 'sameName');
      component.addField();
      component.updateFieldName(1, 'sameName');

      component.saveType();

      expect(mockNotification.showError).toHaveBeenCalledWith('Field names must be unique.');
      expect(mockTypeService.create).not.toHaveBeenCalled();
    });

    it('validates json in raw json mode', () => {
      component['name'].set('Raw JSON Type');
      component.setBuilderMode('json');
      component['rawSchemaJson'].set('{ invalid-json }');

      component.saveType();

      expect(mockNotification.showError).toHaveBeenCalledWith('Type schema must be valid JSON.');
      expect(mockTypeService.create).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode (/types/:id)', () => {
    beforeEach(async () => {
      await setupTestBed('type-123');
    });

    it('loads existing type on initialization', () => {
      expect(mockTypeService.getById).toHaveBeenCalledWith('type-123');
      expect(component['isEdit']()).toBe(true);
      expect(component['name']()).toBe('Existing Type');
      expect(component['description']()).toBe('Existing description');
      expect(component['fields']().length).toBe(2);
      expect(component['sections']().length).toBe(2);
    });

    it('updates existing type definition on save', () => {
      component['name'].set('Existing Type Renamed');
      component.saveType();

      expect(mockTypeService.update).toHaveBeenCalledWith(
        'type-123',
        expect.objectContaining({
          name: 'Existing Type Renamed',
        }),
      );
      expect(mockNotification.showSuccess).toHaveBeenCalledWith(
        expect.stringContaining('updated successfully'),
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/settings/types']);
    });

    it('handles load error by notifying and redirecting to /settings/types', () => {
      mockTypeService.getById.mockReturnValue(throwError(() => new Error('Not found')));
      component.ngOnInit();

      expect(mockNotification.showError).toHaveBeenCalledWith('Type definition not found.');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/settings/types']);
    });
  });
});
