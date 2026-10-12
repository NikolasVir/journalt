/**
 * Safe client-side markdown renderer for Vault notes.
 * Converts markdown to sanitized HTML without server communication.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderVaultMarkdown(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Code block toggle
    if (rawLine.trim().startsWith('```')) {
      if (inCodeBlock) {
        output.push(`<pre><code>${codeBlockLines.join('\n')}</code></pre>`);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(escapeHtml(rawLine));
      continue;
    }

    const trimmed = rawLine.trim();

    // List item
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      output.push(`<li>${formatInline(listMatch[1])}</li>`);
      continue;
    } else if (inList) {
      output.push('</ul>');
      inList = false;
    }

    // Empty line
    if (!trimmed) {
      output.push('<br>');
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      output.push(`<h3>${formatInline(trimmed.substring(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      output.push(`<h2>${formatInline(trimmed.substring(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      output.push(`<h1>${formatInline(trimmed.substring(2))}</h1>`);
      continue;
    }

    // Regular paragraph
    output.push(`<p>${formatInline(trimmed)}</p>`);
  }

  if (inCodeBlock) {
    output.push(`<pre><code>${codeBlockLines.join('\n')}</code></pre>`);
  }
  if (inList) {
    output.push('</ul>');
  }

  return output.join('');
}

function formatInline(text: string): string {
  let safe = escapeHtml(text);

  // Inline code: `code`
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold: **text**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links: [text](url) - only http/https/relative URLs allowed
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  return safe;
}
