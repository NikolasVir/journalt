import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
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
    update: ReturnType<typeof vi.fn>;
    toggleActive: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockNotification: {
    showSuccess: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
    showInfo: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
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
      update: vi.fn(),
      toggleActive: vi.fn(),
      clone: vi.fn(),
      duplicate: vi.fn(),
      delete: vi.fn(),
    };

    mockNotification = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true)),
    };

    await TestBed.configureTestingModule({
      imports: [TypesPageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: TypeDefinitionService, useValue: mockTypeService },
        { provide: NotificationService, useValue: mockNotification },
        { provide: Router, useValue: mockRouter },
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

  describe('Navigation', () => {
    it('openCreate navigates to /types/new', () => {
      component.openCreate();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/types/new']);
    });

    it('openEdit navigates to /types/:id', () => {
      component.openEdit(sampleTypes[0]);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/types', 'type-1']);
    });

    it('openNewVersion navigates to /types/:id', () => {
      component.openNewVersion(sampleTypes[0]);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/types', 'type-1']);
    });
  });

  describe('Duplicate, clone and actions', () => {
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

    it('handles duplicating a type definition', () => {
      mockTypeService.duplicate.mockReturnValue(of({ ...sampleTypes[0], id: 'duplicated-id' }));

      component.openDuplicate(sampleTypes[0]);
      expect(component['duplicatingType']()).toEqual(sampleTypes[0]);
      expect(component['duplicateName']()).toBe('Meeting Note (Copy)');

      component.submitDuplicate();

      expect(mockTypeService.duplicate).toHaveBeenCalledWith(sampleTypes[0].id, {
        newName: 'Meeting Note (Copy)',
      });
      expect(mockNotification.showSuccess).toHaveBeenCalledWith('Type "Meeting Note (Copy)" created.');
      expect(component['duplicatingType']()).toBeNull();
    });

    it('generates unique copy names when duplicates already exist', () => {
      component['types'].set([
        ...sampleTypes,
        { ...sampleTypes[0], id: 'type-copy-1', name: 'Meeting Note (Copy)' },
      ]);
      expect(component.getNextDuplicateName('Meeting Note')).toBe('Meeting Note (Copy 2)');
    });

    it('cancels duplicate', () => {
      component.openDuplicate(sampleTypes[0]);
      expect(component['duplicatingType']()).not.toBeNull();
      component.cancelDuplicate();
      expect(component['duplicatingType']()).toBeNull();
    });

    it('prevents deleting type definition when it has notes and opens blocked dialog', () => {
      const typeWithNotes: TypeDefinitionResponse = {
        ...sampleTypes[0],
        notesCount: 2,
      };

      component.deleteType(typeWithNotes);

      expect(component['blockedDeleteType']()).toEqual(typeWithNotes);
      expect(mockTypeService.delete).not.toHaveBeenCalled();

      component.closeBlockedDeleteDialog();
      expect(component['blockedDeleteType']()).toBeNull();
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
