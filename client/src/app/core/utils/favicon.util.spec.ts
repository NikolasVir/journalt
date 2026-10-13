import { describe, expect, it } from 'vitest';
import { buildFaviconSvg, toSvgDataUri } from './favicon.util';

describe('favicon.util', () => {
  it('renders the JT badge with the given accent and on-colour', () => {
    const svg = buildFaviconSvg('#7b1fa2', '#ffffff');
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain('fill="#7b1fa2"');
    expect(svg).toContain('stroke="#ffffff"');
  });

  it('encodes the SVG as a data URI', () => {
    const uri = toSvgDataUri('<svg/>');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(uri).not.toContain('<svg/>');
    expect(decodeURIComponent(uri)).toContain('<svg/>');
  });
});
