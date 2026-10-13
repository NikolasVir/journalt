import { Injectable } from '@angular/core';

interface KatexRenderer {
  render(tex: string, element: HTMLElement, options?: Record<string, unknown>): void;
}

@Injectable({
  providedIn: 'root'
})
export class MarkdownEnhancerService {
  private prismLoaded = false;
  private katexLoaded = false;
  private katexModule: KatexRenderer | null = null;
  private prismModule: typeof import('prismjs') | null = null;

  public async enhance(container: HTMLElement): Promise<void> {
    if (!container) return;

    this.normalizeExternalLinks(container);

    const hasCode = container.querySelector('code[class*="language-"], pre code') !== null;
    const hasMath = container.querySelector('.math') !== null;

    if (hasCode) {
      await this.highlightCode(container);
    }

    if (hasMath) {
      await this.renderMath(container);
    }
  }

  /**
   * External links inside rendered markdown always open in a new tab.
   * Runs at render time so hover state, middle-click, and attribute
   * assertions see the final markup even before the global click handler.
   */
  private normalizeExternalLinks(container: HTMLElement): void {
    container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
      const href = (anchor.getAttribute('href') ?? '').trim();
      if (!/^https?:\/\//i.test(href)) return;
      anchor.setAttribute('target', '_blank');
      const rel = (anchor.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean);
      if (!rel.includes('noopener')) rel.push('noopener');
      if (!rel.includes('noreferrer')) rel.push('noreferrer');
      anchor.setAttribute('rel', rel.join(' '));
    });
  }

  private async highlightCode(container: HTMLElement): Promise<void> {
    try {
      if (!this.prismLoaded) {
        const prismMod = await import('prismjs');
        this.prismModule = prismMod.default || prismMod;

        // Load common language grammars in parallel
        await Promise.allSettled([
          import('prismjs/components/prism-csharp'),
          import('prismjs/components/prism-typescript'),
          import('prismjs/components/prism-javascript'),
          import('prismjs/components/prism-python'),
          import('prismjs/components/prism-bash'),
          import('prismjs/components/prism-json'),
          import('prismjs/components/prism-sql'),
          import('prismjs/components/prism-markdown')
        ]);

        this.prismLoaded = true;
      }

      if (this.prismModule) {
        const codeElements = container.querySelectorAll<HTMLElement>('pre code');
        codeElements.forEach((el) => {
          this.prismModule!.highlightElement(el);
        });
      }
    } catch (err) {
      console.warn('Failed to load or apply Prism syntax highlighting:', err);
    }
  }

  private async renderMath(container: HTMLElement): Promise<void> {
    try {
      if (!this.katexLoaded) {
        const katexMod = await import('katex');
        this.katexModule = ((katexMod as unknown as { default?: KatexRenderer }).default || katexMod) as KatexRenderer;
        this.katexLoaded = true;
      }

      if (this.katexModule) {
        const mathElements = container.querySelectorAll<HTMLElement>('.math');
        mathElements.forEach((el) => {
          let latex = el.textContent || '';
          latex = latex.trim();

          const isBlock = el.tagName === 'DIV' || (latex.startsWith('\\[') && latex.endsWith('\\]'));

          // Strip standard LaTeX delimiters emitted by Markdig
          if (latex.startsWith('\\(') && latex.endsWith('\\)')) {
            latex = latex.slice(2, -2).trim();
          } else if (latex.startsWith('\\[') && latex.endsWith('\\]')) {
            latex = latex.slice(2, -2).trim();
          }

          try {
            this.katexModule!.render(latex, el, {
              displayMode: isBlock,
              throwOnError: false
            });
          } catch {
            // Keep raw latex on syntax error
          }
        });
      }
    } catch (err) {
      console.warn('Failed to load or apply KaTeX math rendering:', err);
    }
  }
}
