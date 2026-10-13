/**
 * Builds the "JT" brand favicon as an inline SVG so it can be re-tinted with the
 * user's accent colour at runtime. The markup mirrors `public/favicon.svg` (the
 * static default) so the dynamic icon looks identical apart from colour.
 */
export function buildFaviconSvg(accent: string, on: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="JournalT">' +
    `<rect width="64" height="64" rx="15" fill="${accent}"/>` +
    `<g fill="none" stroke="${on}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">` +
    '<path d="M22 17 V40 A7 7 0 0 1 8 40"/>' +
    '<path d="M35 17 H53"/>' +
    '<path d="M44 17 V47"/>' +
    '</g></svg>'
  );
}

/** Encodes an SVG document as a data URI suitable for a `<link rel="icon">`. */
export function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
