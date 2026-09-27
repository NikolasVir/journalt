import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  forwardRef,
  input,
  model,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * Shared markdown editor (CodeMirror 6).
 * Canonical value stays plain `bodyMarkdown` string to preserve server
 * Markdig parity (wiki-links, math, alerts). Works both as
 * ReactiveForms control (`formControlName`) and as signal binding
 * (`[value]` + `(valueChange)`).
 */
@Component({
  selector: 'app-note-content-editor',
  standalone: true,
  imports: [],
  templateUrl: './note-content-editor.component.html',
  styleUrl: './note-content-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NoteContentEditorComponent),
      multi: true,
    },
  ],
})
export class NoteContentEditorComponent
  implements ControlValueAccessor, AfterViewInit, OnDestroy
{
  /** Two-way value. Parent signal usage: `[value]="body()" (valueChange)="body.set($event)"`. */
  public readonly value = model<string>('');

  public readonly placeholder = input<string>('Write in Markdown...');
  public readonly ariaLabel = input<string>('Note content (Markdown)');
  public readonly minHeight = input<string>('200px');

  private readonly editorHost = viewChild<ElementRef<HTMLElement>>('editorHost');

  private view: EditorView | null = null;
  private readonly editableCompartment = new Compartment();
  private isDisabled = false;
  private suppressNextExternalSync = false;

  private onChange: (val: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Sync external model -> CodeMirror (form patch, type scaffold, note load).
    effect(() => {
      const next = this.value() ?? '';
      const host = this.editorHost()?.nativeElement;
      const cm = this.view;
      if (!host || !cm) return;
      if (this.suppressNextExternalSync) {
        this.suppressNextExternalSync = false;
        return;
      }
      const current = cm.state.doc.toString();
      if (current !== next) {
        cm.dispatch({
          changes: { from: 0, to: current.length, insert: next },
        });
      }
    });
  }

  public ngAfterViewInit(): void {
    const host = this.editorHost()?.nativeElement;
    if (!host) return;

    const initial = this.value() ?? '';
    const ph = this.placeholder();

    const state = EditorState.create({
      doc: initial,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        markdown(),
        oneDark,
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        cmPlaceholder(ph),
        this.editableCompartment.of(EditorView.editable.of(!this.isDisabled)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const next = update.state.doc.toString();
          if (next === this.value()) return;
          // Mark for effect-skip so we don't bounce the change back.
          this.suppressNextExternalSync = true;
          this.value.set(next);
          this.onChange(next);
        }),
        EditorView.domEventHandlers({
          blur: () => {
            this.onTouched();
            return false;
          },
        }),
      ],
    });

    this.view = new EditorView({ state, parent: host });
    this.view.contentDOM.setAttribute('aria-label', this.ariaLabel());
  }

  public ngOnDestroy(): void {
    this.view?.destroy();
    this.view = null;
  }

  // --- ControlValueAccessor (ReactiveForms: formControlName="bodyMarkdown") ---
  public writeValue(val: string | null): void {
    const next = val ?? '';
    if (next === this.value()) {
      // Still ensure CM matches (e.g. first write before view init is covered by initial doc).
      return;
    }
    this.value.set(next);
    // The effect() above pushes into CM once the view exists.
    // If view already exists, effect runs async; force sync for immediacy:
    const cm = this.view;
    if (cm) {
      const current = cm.state.doc.toString();
      if (current !== next) {
        this.suppressNextExternalSync = true;
        // Set model already done; dispatch directly to avoid waiting on effect.
        cm.dispatch({ changes: { from: 0, to: current.length, insert: next } });
        // Effect will see suppress flag and skip.
      }
    }
  }

  public registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.view?.dispatch({
      effects: this.editableCompartment.reconfigure(EditorView.editable.of(!isDisabled)),
    });
  }

  /** Focuses the CodeMirror editing surface (e.g. autofocus on Edit Note). */
  public focus(): void {
    if (this.view) {
      this.view.focus();
      return;
    }
    setTimeout(() => this.view?.focus(), 50);
  }
}
