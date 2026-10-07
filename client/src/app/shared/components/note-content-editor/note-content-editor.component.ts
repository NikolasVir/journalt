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
import * as Y from 'yjs';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Shared markdown editor (CodeMirror 6) with optional Yjs/SignalR real-time collaboration.
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
  public readonly collabNoteId = input<string | null>(null);
  public readonly collabUser = input<{ name: string; color: string } | null>(null);

  private readonly editorHost = viewChild<ElementRef<HTMLElement>>('editorHost');

  private view: EditorView | null = null;
  private readonly editableCompartment = new Compartment();
  private isDisabled = false;
  private suppressNextExternalSync = false;

  private isCollabActive = false;
  private hasJoinedSession = false;
  private isFirstClient = false;
  private pendingInitialText = '';

  private ydoc: Y.Doc | null = null;
  private ytext: Y.Text | null = null;
  private awareness: Awareness | null = null;
  private hub: HubConnection | null = null;

  private onChange: (val: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Sync external model -> CodeMirror (form patch, type scaffold, note load).
    effect(() => {
      if (this.isCollabActive) return;
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

  public async ngAfterViewInit(): Promise<void> {
    const host = this.editorHost()?.nativeElement;
    if (!host) return;

    const noteId = this.collabNoteId();
    if (noteId) {
      await this.initCollaboration(noteId, host);
    } else {
      this.initLocalEditor(host);
    }
  }

  private initLocalEditor(host: HTMLElement): void {
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

  private async initCollaboration(noteId: string, host: HTMLElement): Promise<void> {
    this.isCollabActive = true;
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('codemirror');
    this.awareness = new Awareness(this.ydoc);

    const user = this.collabUser() ?? {
      name: 'User ' + Math.floor(1000 + Math.random() * 9000),
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    };
    this.awareness.setLocalStateField('user', user);

    this.hub = new HubConnectionBuilder()
      .withUrl('/hubs/collaboration')
      .withAutomaticReconnect()
      .build();

    this.hub.on('ReceiveUpdate', (updateB64: string) => {
      if (this.ydoc) {
        Y.applyUpdate(this.ydoc, fromBase64(updateB64), 'server');
      }
    });

    this.hub.on('ReceiveAwareness', (awarenessB64: string) => {
      if (this.awareness) {
        applyAwarenessUpdate(this.awareness, fromBase64(awarenessB64), 'server');
      }
    });

    this.ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'server' && this.hub && this.hub.state === HubConnectionState.Connected) {
        this.hub.invoke('SendUpdate', noteId, toBase64(update)).catch((err) => {
          console.error('[Collab] SendUpdate error:', err);
        });
      }
    });

    this.awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
      if (origin !== 'server' && this.hub && this.hub.state === HubConnectionState.Connected && this.awareness) {
        const update = encodeAwarenessUpdate(this.awareness, added.concat(updated, removed));
        this.hub.invoke('SendAwareness', noteId, toBase64(update)).catch((err) => {
          console.error('[Collab] SendAwareness error:', err);
        });
      }
    });

    this.ytext.observe(() => {
      if (!this.ytext) return;
      const next = this.ytext.toString();
      if (next !== this.value()) {
        this.suppressNextExternalSync = true;
        this.value.set(next);
        this.onChange(next);
      }
    });

    try {
      await this.hub.start();
      const existingUpdates: string[] = await this.hub.invoke('JoinNote', noteId);
      this.hasJoinedSession = true;

      if (existingUpdates && existingUpdates.length > 0) {
        this.isFirstClient = false;
        for (const u of existingUpdates) {
          Y.applyUpdate(this.ydoc, fromBase64(u));
        }
        const text = this.ytext.toString();
        this.suppressNextExternalSync = true;
        this.value.set(text);
        this.onChange(text);
      } else {
        // First client in this room: seed from pendingInitialText or current model value
        this.isFirstClient = true;
        const initial = this.pendingInitialText || this.value() || '';
        if (initial && this.ytext.length === 0) {
          this.ytext.insert(0, initial);
          const seed = Y.encodeStateAsUpdate(this.ydoc);
          await this.hub.invoke('SendUpdate', noteId, toBase64(seed));
        }
      }
    } catch (err) {
      this.hasJoinedSession = true;
      console.warn('[Collab] Hub connection failed, continuing locally:', err);
    }

    const ph = this.placeholder();
    const undoManager = new Y.UndoManager(this.ytext);

    const state = EditorState.create({
      doc: this.ytext.toString(),
      extensions: [
        keymap.of([...defaultKeymap, ...yUndoManagerKeymap]),
        yCollab(this.ytext, this.awareness, { undoManager }),
        markdown(),
        oneDark,
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        cmPlaceholder(ph),
        this.editableCompartment.of(EditorView.editable.of(!this.isDisabled)),
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
    if (this.hub) {
      const noteId = this.collabNoteId();
      if (noteId && this.hub.state === HubConnectionState.Connected) {
        this.hub.invoke('LeaveNote', noteId).catch(() => {});
      }
      this.hub.stop().catch(() => {});
      this.hub = null;
    }
    this.ydoc?.destroy();
    this.ydoc = null;
    this.awareness?.destroy();
    this.awareness = null;
  }

  // --- ControlValueAccessor (ReactiveForms: formControlName="bodyMarkdown") ---
  public writeValue(val: string | null): void {
    const next = val ?? '';
    this.pendingInitialText = next;

    if (this.isCollabActive && this.ytext) {
      // If we haven't joined the hub session yet, save the text in pendingInitialText and wait.
      // If we HAVE joined and we are the first client, and ytext is still empty:
      if (this.hasJoinedSession && this.isFirstClient && this.ytext.length === 0 && next) {
        this.ytext.insert(0, next);
        if (this.hub && this.hub.state === HubConnectionState.Connected && this.collabNoteId() && this.ydoc) {
          const seed = Y.encodeStateAsUpdate(this.ydoc);
          this.hub.invoke('SendUpdate', this.collabNoteId(), toBase64(seed)).catch((err) => {
            console.error('[Collab] writeValue SendUpdate error:', err);
          });
        }
      }
      if (this.ytext.length > 0) {
        this.value.set(this.ytext.toString());
      }
      return;
    }

    if (next === this.value()) {
      return;
    }
    this.value.set(next);
    const cm = this.view;
    if (cm) {
      const current = cm.state.doc.toString();
      if (current !== next) {
        this.suppressNextExternalSync = true;
        cm.dispatch({ changes: { from: 0, to: current.length, insert: next } });
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
