import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { TypeDefinitionResponse } from '@core/models/type-definition.model';
import { NotificationService } from '@core/services/notification.service';
import { TypeDefinitionService } from '@core/services/type-definition.service';
import {
  TypesPageComponent,
  parseSchemaFields,
  buildSchemaJson,
  parseSections,
  buildSectionsJson,
} from './types-page.component';

describe('TypesPageComponent', () => {
  let component: TypesPageComponent;
  let fixture: ComponentFixture<TypesPageComponent>;
  let mockTypeService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createNewVersion: ReturnType<typeof vi.fn>;
    toggleActive: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockNotification: {
    showSuccess: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
    showInfo: ReturnType<typeof vi.fn>;
  };

  const sampleTypes: TypeDefinitionResponse[] = [
    {
      id: 'type-1',
      name: 'Meeting Note',
      description: 'Meeting notes template',
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
    },
    {
      id: 'type-2',
      name: 'Decision Record',
      description: 'ADR template',
      version: 2,
      isActive: false,
      schemaJson: JSON.stringify({
        type: 'object',
        properties: {
          status: { type: 'string' },
        },
      }),
      sectionsJson: null,
      createdAtUtc: '2026-10-01T13:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockTypeService = {
      list: vi.fn().mockReturnValue(of(sampleTypes)),
      create: vi.fn(),
      createNewVersion: vi.fn(),
      toggleActive: vi.fn(),
      clone: vi.fn(),
      delete: vi.fn(),
    };

    mockNotification = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TypesPageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: TypeDefinitionService, useValue: mockTypeService },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TypesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Pure helper functions', () => {
    it('parseSchemaFields correctly extracts fields and required flags', () => {
      const json = JSON.stringify({
        properties: {
          title: { type: 'string' },
          count: { type: 'number' },
          done: { type: 'boolean' },
          tags: { type: 'array' },
        },
        required: ['title', 'count'],
      });
      const fields = parseSchemaFields(json);
      expect(fields.length).toBe(4);
      expect(fields.find((f) => f.name === 'title')).toEqual({
        name: 'title',
        type: 'string',
        required: true,
      });
      expect(fields.find((f) => f.name === 'tags')).toEqual({
        name: 'tags',
        type: 'array',
        required: false,
      });
    });

    it('parseSchemaFields handles null or invalid JSON gracefully', () => {
      expect(parseSchemaFields(null)).toEqual([]);
      expect(parseSchemaFields('invalid-json')).toEqual([]);
      expect(parseSchemaFields('{}')).toEqual([]);
    });

    it('buildSchemaJson constructs valid JSON Schema with required properties', () => {
      const json = buildSchemaJson([
        { name: 'author', type: 'string', required: true },
        { name: 'score', type: 'number', required: false },
      ]);
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe('object');
      expect(parsed.properties.author.type).toBe('string');
      expect(parsed.properties.score.type).toBe('number');
      expect(parsed.required).toEqual(['author']);
    });

    it('parseSections parses array with heading, level, and repeatable', () => {
      const json = JSON.stringify([
        { heading: 'Overview', level: 1, required: true, allowMultiple: false },
        { title: 'Notes', level: 3, required: false, repeatable: true },
      ]);
      const sections = parseSections(json);
      expect(sections.length).toBe(2);
      expect(sections[0]).toEqual({
        heading: 'Overview',
        level: 1,
        required: true,
        allowMultiple: false,
      });
      expect(sections[1]).toEqual({
        heading: 'Notes',
        level: 3,
        required: false,
        allowMultiple: true,
      });
    });

    it('buildSectionsJson returns null for empty section lists', () => {
      expect(buildSectionsJson([])).toBeNull();
      expect(buildSectionsJson([{ heading: '   ', level: 2, required: true, allowMultiple: false }])).toBeNull();
    });

    it('buildSectionsJson serializes non-empty sections correctly', () => {
      const json = buildSectionsJson([
        { heading: 'Key Takeaways', level: 2, required: true, allowMultiple: true },
      ]);
      expect(json).not.toBeNull();
      const parsed = JSON.parse(json!);
      expect(parsed).toEqual([
        { heading: 'Key Takeaways', level: 2, required: true, allowMultiple: true },
      ]);
    });
  });

  describe('Component lifecycle & listing', () => {
    it('loads types on initialization', () => {
      expect(mockTypeService.list).toHaveBeenCalledWith(true);
      expect(component['types']().length).toBe(2);
      expect(component['isLoading']()).toBe(false);
    });

    it('shows error notification when type loading fails', () => {
      mockTypeService.list.mockReturnValue(throwError(() => new Error('Network error')));
      component.loadTypes();
      expect(component['isLoading']()).toBe(false);
      expect(mockNotification.showError).toHaveBeenCalledWith('Failed to load type definitions.');
    });

    it('toggles the help explanation box', () => {
      expect(component['isHelpOpen']()).toBe(false);
      component.toggleHelp();
      expect(component['isHelpOpen']()).toBe(true);
      component.toggleHelp();
      expect(component['isHelpOpen']()).toBe(false);
    });

    it('formats type labels correctly', () => {
      expect(component.formatTypeLabel('string')).toBe('Text');
      expect(component.formatTypeLabel('number')).toBe('Number');
      expect(component.formatTypeLabel('boolean')).toBe('Boolean');
      expect(component.formatTypeLabel('array')).toBe('List');
      expect(component.formatTypeLabel('custom')).toBe('custom');
    });
  });

  describe('Visual builder & presets', () => {
    it('openCreate resets form and opens builder', () => {
      component.openCreate();
      expect(component['showBuilder']()).toBe(true);
      expect(component['editingType']()).toBeNull();
      expect(component['name']()).toBe('');
      expect(component['fields']()).toEqual([]);
      expect(component['sections']()).toEqual([]);
    });

    it('applyPreset sets up Meeting Note preset', () => {
      component.openCreate();
      component.applyPreset('meeting');
      expect(component['name']()).toBe('Meeting Note');
      expect(component['fields']().length).toBe(2);
      expect(component['sections']().length).toBe(3);
    });

    it('applyPreset sets up Decision Record preset', () => {
      component.openCreate();
      component.applyPreset('decision');
      expect(component['name']()).toBe('Decision Record');
      expect(component['fields']().length).toBe(2);
      expect(component['sections']().length).toBe(4);
    });

    it('applyPreset sets up Book Review preset', () => {
      component.openCreate();
      component.applyPreset('book');
      expect(component['name']()).toBe('Book Review');
      expect(component['fields']().length).toBe(3);
      expect(component['sections']().length).toBe(3);
    });

    it('manages metadata fields: add, update, remove', () => {
      component.openCreate();
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
      component.openCreate();
      component.addSection();
      component.addSection();
      expect(component['sections']().length).toBe(2);

      component.updateSectionHeading(0, 'First Section');
      component.updateSectionLevel(0, 1);
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
      component.openCreate();
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
  });

  describe('Saving and versioning', () => {
    it('creates a new type definition when saveType is called for a new type', () => {
      const createdType: TypeDefinitionResponse = {
        ...sampleTypes[0],
        id: 'new-type-id',
        name: 'New Custom Type',
        version: 1,
      };
      mockTypeService.create.mockReturnValue(of(createdType));

      component.openCreate();
      (component as unknown as { name: { set: (v: string) => void } }).name.set('New Custom Type');
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
      expect(mockNotification.showSuccess).toHaveBeenCalledWith('Type "New Custom Type" created.');
      expect(component['showBuilder']()).toBe(false);
    });

    it('rejects duplicate field names in visual builder mode', () => {
      component.openCreate();
      (component as unknown as { name: { set: (v: string) => void } }).name.set('Duplicate Field Test');
      component.addField();
      component.updateFieldName(0, 'sameName');
      component.addField();
      component.updateFieldName(1, 'sameName');

      component.saveType();

      expect(mockNotification.showError).toHaveBeenCalledWith('Field names must be unique.');
      expect(mockTypeService.create).not.toHaveBeenCalled();
    });

    it('publishes a new version when editingType is present', () => {
      const newVersionType: TypeDefinitionResponse = {
        ...sampleTypes[0],
        version: 2,
      };
      mockTypeService.createNewVersion.mockReturnValue(of(newVersionType));

      component.openNewVersion(sampleTypes[0]);
      expect(component['editingType']()).toEqual(sampleTypes[0]);
      expect(component['name']()).toBe('Meeting Note');

      component.saveType();

      expect(mockTypeService.createNewVersion).toHaveBeenCalledWith(
        sampleTypes[0].id,
        expect.objectContaining({
          schemaJson: expect.any(String),
        }),
      );
      expect(mockNotification.showSuccess).toHaveBeenCalledWith('Version 2 of "Meeting Note" published.');
      expect(component['showBuilder']()).toBe(false);
    });

    it('handles cloning a type definition', () => {
      mockTypeService.clone.mockReturnValue(of({ ...sampleTypes[0], id: 'cloned-id' }));

      component.openClone(sampleTypes[0]);
      expect(component['cloningType']()).toEqual(sampleTypes[0]);
      expect(component['cloneName']()).toBe('Meeting Note (Copy)');

      component.submitClone();

      expect(mockTypeService.clone).toHaveBeenCalledWith(sampleTypes[0].id, {
        newName: 'Meeting Note (Copy)',
      });
      expect(mockNotification.showSuccess).toHaveBeenCalledWith('Type cloned as "Meeting Note (Copy)".');
      expect(component['cloningType']()).toBeNull();
    });

    it('toggles type active state', () => {
      mockTypeService.toggleActive.mockReturnValue(of(void 0));

      component.toggleActive(sampleTypes[0]); // currently isActive = true
      expect(mockTypeService.toggleActive).toHaveBeenCalledWith('type-1');
      expect(component['types']().find((t) => t.id === 'type-1')?.isActive).toBe(false);
      expect(mockNotification.showSuccess).toHaveBeenCalledWith('Type "Meeting Note" deactivated.');
    });

    it('deletes type definition when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockTypeService.delete.mockReturnValue(of(void 0));

      component.deleteType(sampleTypes[0]);

      expect(mockTypeService.delete).toHaveBeenCalledWith('type-1');
      expect(component['types']().find((t) => t.id === 'type-1')).toBeUndefined();
      expect(mockNotification.showSuccess).toHaveBeenCalledWith('Type "Meeting Note" deleted.');
    });

    it('does not delete type definition when cancelled by user', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.deleteType(sampleTypes[0]);

      expect(mockTypeService.delete).not.toHaveBeenCalled();
      expect(component['types']().length).toBe(2);
    });
  });
});
