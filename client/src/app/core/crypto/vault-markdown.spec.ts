import { renderVaultMarkdown } from './vault-markdown';

describe('renderVaultMarkdown links', () => {
  it('should open external links in a new tab', () => {
    const html = renderVaultMarkdown('[docs](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('should keep internal app links in the same tab', () => {
    const html = renderVaultMarkdown('[note](/notes/11111111-1111-1111-1111-111111111111)');
    expect(html).toContain('href="/notes/11111111-1111-1111-1111-111111111111"');
    expect(html).not.toContain('target="_blank"');
  });
});
