import { Pipe, PipeTransform } from '@angular/core';

/**
 * Renders markdown task-list checkboxes inside `[innerHTML]` bindings.
 *
 * The API emits `<input type="checkbox" disabled>` for `- [ ]` / `- [x]` list
 * items, but Angular's HTML sanitizer strips `<input>` elements, so the boxes
 * silently disappear. This pipe swaps each task checkbox for a `<span>` that
 * survives sanitization and is styled by `_markdown.scss`.
 */
@Pipe({
  name: 'mdTaskList',
  standalone: true
})
export class MarkdownTaskListPipe implements PipeTransform {
  private static readonly inputTag = /<input\b[^>]*>/gi;
  private static readonly checkboxType = /\btype\s*=\s*["']?checkbox/i;
  private static readonly checkedAttr = /\bchecked\b/i;

  public transform(html: string | null | undefined): string {
    if (!html) return '';

    return html.replace(MarkdownTaskListPipe.inputTag, (tag) => {
      if (!MarkdownTaskListPipe.checkboxType.test(tag)) return tag;
      const checked = MarkdownTaskListPipe.checkedAttr.test(tag);
      const modifier = checked ? ' md-task-checkbox--checked' : '';
      return `<span class="md-task-checkbox${modifier}" aria-hidden="true"></span>`;
    });
  }
}
