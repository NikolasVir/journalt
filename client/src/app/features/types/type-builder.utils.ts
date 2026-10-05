export interface MetadataFieldDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
}

export interface SectionFieldDef {
  heading: string;
  level: number;
  required: boolean;
  allowMultiple: boolean;
}

export function parseSchemaFields(schemaJson?: string | null): MetadataFieldDef[] {
  if (!schemaJson) return [];
  try {
    const parsed = JSON.parse(schemaJson);
    if (!parsed || typeof parsed !== 'object' || !parsed.properties) return [];
    const req: string[] = Array.isArray(parsed.required) ? parsed.required : [];
    const validTypes: MetadataFieldDef['type'][] = ['string', 'number', 'boolean', 'array'];
    return Object.entries(parsed.properties).map(([name, conf]) => {
      const prop = conf as { type?: string };
      const fieldType = validTypes.includes(prop?.type as MetadataFieldDef['type'])
        ? (prop.type as MetadataFieldDef['type'])
        : 'string';
      return {
        name,
        type: fieldType,
        required: req.includes(name),
      };
    });
  } catch {
    return [];
  }
}

export function buildSchemaJson(fields: MetadataFieldDef[]): string {
  const properties: Record<string, { type: string }> = {};
  const required: string[] = [];

  for (const f of fields) {
    const key = f.name.trim();
    if (!key) continue;
    properties[key] = { type: f.type };
    if (f.required) {
      required.push(key);
    }
  }

  const obj: Record<string, unknown> = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) {
    obj['required'] = required;
  }
  return JSON.stringify(obj, null, 2);
}

export function parseSections(sectionsJson?: string | null): SectionFieldDef[] {
  if (!sectionsJson) return [];
  try {
    const parsed = JSON.parse(sectionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        heading: (item.heading || item.title || '').trim(),
        level: typeof item.level === 'number' && item.level >= 1 && item.level <= 6 ? item.level : 2,
        required: item.required ?? true,
        allowMultiple: item.allowMultiple ?? item.repeatable ?? false,
      }))
      .filter((s) => s.heading.length > 0);
  } catch {
    return [];
  }
}

export function buildSectionsJson(sections: SectionFieldDef[]): string | null {
  const list = sections
    .filter((s) => s.heading.trim().length > 0)
    .map((s) => ({
      heading: s.heading.trim(),
      level: s.level || 2,
      required: !!s.required,
      allowMultiple: !!s.allowMultiple,
    }));
  return list.length > 0 ? JSON.stringify(list, null, 2) : null;
}
