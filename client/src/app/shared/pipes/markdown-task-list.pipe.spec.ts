import { MarkdownTaskListPipe } from './markdown-task-list.pipe';

describe('MarkdownTaskListPipe', () => {
  const pipe = new MarkdownTaskListPipe();

  it('handles empty input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('replaces unchecked task checkboxes with a span', () => {
    const html = '<li class="task-list-item"><input disabled="disabled" type="checkbox"> first</li>';
    const result = pipe.transform(html);
    expect(result).toContain('<span class="md-task-checkbox" aria-hidden="true"></span>');
    expect(result).not.toContain('<input');
  });

  it('marks checked task checkboxes', () => {
    const html = '<li class="task-list-item"><input disabled type="checkbox" checked="checked"> done</li>';
    const result = pipe.transform(html);
    expect(result).toContain('md-task-checkbox--checked');
    expect(result).not.toContain('<input');
  });

  it('leaves non-checkbox inputs and other markup untouched', () => {
    const html = '<p>text</p><input type="text" placeholder="nope">';
    expect(pipe.transform(html)).toBe(html);
  });
});
