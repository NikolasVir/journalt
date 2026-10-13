import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  hexToHsv,
  hsvToHex,
  mixHex,
  normalizeHex,
  onColorFor,
} from './color.util';

describe('color.util', () => {
  describe('normalizeHex', () => {
    it('lower-cases and adds a leading hash', () => {
      expect(normalizeHex('ABCDEF')).toBe('#abcdef');
      expect(normalizeHex('  #1A73E8 ')).toBe('#1a73e8');
    });

    it('rejects malformed values', () => {
      expect(normalizeHex('#abc')).toBeNull();
      expect(normalizeHex('nope')).toBeNull();
      expect(normalizeHex(null)).toBeNull();
      expect(normalizeHex(undefined)).toBeNull();
    });
  });

  describe('mixHex', () => {
    it('returns the first colour at weight 1 and the second at weight 0', () => {
      expect(mixHex('#000000', '#ffffff', 1)).toBe('#000000');
      expect(mixHex('#000000', '#ffffff', 0)).toBe('#ffffff');
    });

    it('blends evenly in the middle', () => {
      expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    });
  });

  describe('onColorFor', () => {
    it('picks dark text on light backgrounds and light text on dark ones', () => {
      expect(onColorFor('#ffffff')).toBe('#000000');
      expect(onColorFor('#000000')).toBe('#ffffff');
    });
  });

  describe('contrastRatio', () => {
    it('is maximal between black and white', () => {
      expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    });
  });

  describe('hsv round-trip', () => {
    it('converts primaries correctly', () => {
      expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
      expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 });
    });

    it('round-trips arbitrary colours', () => {
      for (const hex of ['#1a73e8', '#7b1fa2', '#2e7d32', '#ef6c00']) {
        expect(hsvToHex(hexToHsv(hex))).toBe(hex);
      }
    });
  });
});
