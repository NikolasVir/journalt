import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface FormattedSkill {
  name: string;
  level?: string;
  context?: string;
}

export interface CoordinatesValue {
  latitude: number;
  longitude: number;
}

export type PropertyType =
  | 'badge'
  | 'chips'
  | 'skills'
  | 'coordinates'
  | 'date'
  | 'boolean'
  | 'string'
  | 'number'
  | 'object';

export interface FormattedProperty {
  key: string;
  label: string;
  type: PropertyType;
  value: any;
  badgeVariant?: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
}

const PROPERTY_ORDER: Record<string, number> = {
  status: 10,
  priority: 20,
  outcome: 30,
  period: 35,
  date: 40,
  date_end: 50,
  published: 55,
  organization: 60,
  role: 70,
  author: 75,
  reference_kind: 78,
  locality: 80,
  country_code: 85,
  coordinates: 90,
  first_met: 100,
  last_contact: 110,
  relationship: 120,
  aliases: 130,
  skills: 140,
  visibility: 150,
};

function formatLabel(key: string): string {
  const customLabels: Record<string, string> = {
    date_end: 'End Date',
    first_met: 'First Met',
    last_contact: 'Last Contact',
    country_code: 'Country',
    reference_kind: 'Reference Kind',
  };
  if (customLabels[key]) return customLabels[key];

  return key
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

@Component({
  selector: 'app-note-metadata-view',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './note-metadata-view.component.html',
  styleUrl: './note-metadata-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteMetadataViewComponent {
  public readonly metadataJson = input<string | null | undefined>(null);
  public readonly summary = input<string | null | undefined>(null);

  protected readonly cleanSummary = computed(() => {
    const s = this.summary();
    return s && typeof s === 'string' && s.trim() ? s.trim() : null;
  });

  protected readonly properties = computed<FormattedProperty[]>(() => {
    const json = this.metadataJson();
    if (!json) return [];

    let raw: Record<string, unknown> = {};
    if (typeof json === 'string') {
      try {
        raw = JSON.parse(json);
      } catch {
        return [];
      }
    } else if (typeof json === 'object' && json !== null) {
      raw = json as Record<string, unknown>;
    } else {
      return [];
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

    const result: FormattedProperty[] = [];

    for (const [key, val] of Object.entries(raw)) {
      if (val === null || val === undefined || val === '') continue;
      if (Array.isArray(val) && val.length === 0) continue;

      const label = formatLabel(key);

      if (key === 'skills' && Array.isArray(val)) {
        const skills: FormattedSkill[] = val.map((item) => {
          if (typeof item === 'object' && item !== null) {
            return {
              name: String(item.name || ''),
              level: item.level ? String(item.level) : undefined,
              context: item.context ? String(item.context) : undefined,
            };
          }
          return { name: String(item) };
        });
        result.push({ key, label, type: 'skills', value: skills });
        continue;
      }

      if (
        key === 'coordinates' &&
        typeof val === 'object' &&
        val !== null &&
        ('latitude' in val || 'longitude' in val)
      ) {
        const coords = val as { latitude?: number; longitude?: number };
        if (coords.latitude !== undefined && coords.longitude !== undefined) {
          result.push({
            key,
            label,
            type: 'coordinates',
            value: { latitude: coords.latitude, longitude: coords.longitude },
          });
          continue;
        }
      }

      if (key === 'status') {
        const str = String(val).toLowerCase();
        let badgeVariant: FormattedProperty['badgeVariant'] = 'neutral';
        if (['active', 'in-progress', 'current'].includes(str)) badgeVariant = 'success';
        else if (['complete', 'completed', 'done', 'resolved'].includes(str)) badgeVariant = 'info';
        else if (['superseded', 'archived', 'abandoned', 'deprecated'].includes(str)) badgeVariant = 'neutral';
        else if (['pending', 'paused', 'blocked'].includes(str)) badgeVariant = 'warning';

        result.push({ key, label, type: 'badge', value: String(val), badgeVariant });
        continue;
      }

      if (key === 'priority') {
        const str = String(val).toLowerCase();
        let badgeVariant: FormattedProperty['badgeVariant'] = 'neutral';
        if (['high', 'urgent', 'critical', 'p1'].includes(str)) badgeVariant = 'warning';
        else if (['medium', 'normal', 'p2'].includes(str)) badgeVariant = 'info';
        else if (['low', 'p3'].includes(str)) badgeVariant = 'neutral';

        result.push({ key, label, type: 'badge', value: String(val), badgeVariant });
        continue;
      }

      if (key === 'outcome') {
        const str = String(val).toLowerCase();
        let badgeVariant: FormattedProperty['badgeVariant'] = 'neutral';
        if (['successful', 'positive', 'success'].includes(str)) badgeVariant = 'success';
        else if (['mixed', 'partial'].includes(str)) badgeVariant = 'warning';
        else if (['failed', 'negative', 'failure'].includes(str)) badgeVariant = 'danger';

        result.push({ key, label, type: 'badge', value: String(val), badgeVariant });
        continue;
      }

      if (key === 'visibility') {
        result.push({ key, label, type: 'badge', value: String(val), badgeVariant: 'neutral' });
        continue;
      }

      if (Array.isArray(val)) {
        result.push({ key, label, type: 'chips', value: val.map(String) });
        continue;
      }

      if (typeof val === 'boolean') {
        result.push({ key, label, type: 'boolean', value: val });
        continue;
      }

      if (typeof val === 'number') {
        result.push({ key, label, type: 'number', value: val });
        continue;
      }

      if (typeof val === 'string') {
        const isDate = /^\d{4}-\d{2}-\d{2}/.test(val);
        result.push({ key, label, type: isDate ? 'date' : 'string', value: val });
        continue;
      }

      if (typeof val === 'object') {
        result.push({ key, label, type: 'object', value: JSON.stringify(val) });
      }
    }

    result.sort((a, b) => {
      const orderA = PROPERTY_ORDER[a.key] ?? 999;
      const orderB = PROPERTY_ORDER[b.key] ?? 999;
      return orderA - orderB;
    });

    return result;
  });

  protected readonly hasContent = computed(() => {
    return !!this.cleanSummary() || this.properties().length > 0;
  });

  protected getMapUrl(coords: CoordinatesValue): string {
    return `https://www.openstreetmap.org/?mlat=${coords.latitude}&mlon=${coords.longitude}#map=14/${coords.latitude}/${coords.longitude}`;
  }
}
