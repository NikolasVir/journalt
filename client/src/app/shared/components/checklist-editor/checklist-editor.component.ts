import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  forwardRef,
  input,
  model,
  signal,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  CdkDragHandle,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import * as Y from 'yjs';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

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

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function markdownToChecklist(md: string): ChecklistItem[] {
  if (!md || !md.trim()) return [];
  const lines = md.split(/\r?\n/);
  const items: ChecklistItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const taskMatch = trimmed.match(/^[-*+]\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      items.push({
        id: generateId(),
        completed: taskMatch[1].toLowerCase() === 'x',
        text: taskMatch[2].trim(),
      });
    } else {
      // Regular line converted to item
      const cleanText = trimmed.replace(/^[-*+]\s+/, '');
      items.push({
        id: generateId(),
        completed: false,
        text: cleanText,
      });
    }
  }
  return items;
}

export function checklistToMarkdown(items: ChecklistItem[]): string {
  // Put active items first, then completed items
  const active = items.filter(i => !i.completed && i.text.trim().length > 0);
  const completed = items.filter(i => i.completed && i.text.trim().length > 0);

  const lines: string[] = [];
  for (const item of active) {
    lines.push(`- [ ] ${item.text.trim()}`);
  }
  for (const item of completed) {
    lines.push(`- [x] ${item.text.trim()}`);
  }
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

@Component({
  selector: 'app-checklist-editor',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
  ],
  templateUrl: './checklist-editor.component.html',
  styleUrl: './checklist-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChecklistEditorComponent),
      multi: true,
    },
  ],
})
export class ChecklistEditorComponent
  implements ControlValueAccessor, OnDestroy
{
  public readonly value = model<string>('');
  public readonly placeholder = input<string>('List item');
  public readonly ariaLabel = input<string>('Checklist content');
  public readonly minHeight = input<string>('180px');
  public readonly collabNoteId = input<string | null>(null);
  public readonly collabUser = input<{ name: string; color: string } | null>(null);

  protected readonly items = signal<ChecklistItem[]>([]);
  protected readonly isCompletedExpanded = signal<boolean>(true);
  protected readonly newItemText = signal<string>('');

  private readonly itemInputs = viewChildren<ElementRef<HTMLInputElement>>('itemInput');
  private readonly newItemInput = viewChildren<ElementRef<HTMLInputElement>>('newItemInputRef');

  private onChange: (val: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private isDisabled = false;

  // Yjs & SignalR collaboration
  private ydoc: Y.Doc | null = null;
  private yitems: Y.Array<Y.Map<any>> | null = null;
  private hub: HubConnection | null = null;
  private isCollabActive = false;
  private suppressNextExternalSync = false;

  constructor() {
    // Synchronize external value -> local state if not collaborating
    effect(() => {
      const nextVal = this.value() ?? '';
      if (this.isCollabActive) return;
      if (this.suppressNextExternalSync) {
        this.suppressNextExternalSync = false;
        return;
      }

      const parsed = markdownToChecklist(nextVal);
      // If empty string and no items, start with one empty item so the user can immediately type
      if (parsed.length === 0 && this.items().length === 0) {
        this.items.set([{ id: generateId(), text: '', completed: false }]);
      } else if (parsed.length > 0) {
        this.items.set(parsed);
      }
    });

    // Setup collaboration when collabNoteId is provided
    effect(() => {
      const noteId = this.collabNoteId();
      if (noteId) {
        void this.initCollaboration(noteId);
      } else {
        this.destroyCollaboration();
      }
    });
  }

  public ngOnDestroy(): void {
    this.destroyCollaboration();
  }

  // --- ControlValueAccessor ---

  public writeValue(obj: any): void {
    if (typeof obj === 'string') {
      this.value.set(obj);
    }
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  // --- Getters for template ---

  protected get activeItems(): ChecklistItem[] {
    return this.items().filter(i => !i.completed);
  }

  protected get completedItems(): ChecklistItem[] {
    return this.items().filter(i => i.completed);
  }

  // --- Mutation & Yjs Sync Helpers ---

  private commitChange(newItems: ChecklistItem[], syncToYjs = true): void {
    this.items.set(newItems);
    const md = checklistToMarkdown(newItems);
    this.suppressNextExternalSync = true;
    this.value.set(md);
    this.onChange(md);
    this.onTouched();

    if (syncToYjs && this.isCollabActive && this.ydoc && this.yitems) {
      this.ydoc.transact(() => {
        if (!this.yitems) return;
        this.yitems.delete(0, this.yitems.length);
        const ymaps = newItems.map(item => {
          const map = new Y.Map<any>();
          map.set('id', item.id);
          map.set('text', item.text);
          map.set('completed', item.completed);
          return map;
        });
        this.yitems.insert(0, ymaps);
      });
    }
  }

  // --- User Actions ---

  public toggleItem(item: ChecklistItem): void {
    if (this.isDisabled) return;
    const current = this.items();
    const updated = current.map(i =>
      i.id === item.id ? { ...i, completed: !i.completed } : i
    );
    this.commitChange(updated);
  }

  public updateItemText(item: ChecklistItem, text: string): void {
    if (this.isDisabled) return;
    const current = this.items();
    const updated = current.map(i =>
      i.id === item.id ? { ...i, text } : i
    );
    this.commitChange(updated);
  }

  public deleteItem(item: ChecklistItem): void {
    if (this.isDisabled) return;
    const current = this.items();
    let updated = current.filter(i => i.id !== item.id);
    if (updated.length === 0) {
      updated = [{ id: generateId(), text: '', completed: false }];
    }
    this.commitChange(updated);
  }

  public onEnter(item: ChecklistItem, event: Event): void {
    event.preventDefault();
    if (this.isDisabled) return;

    const current = this.items();
    const idx = current.findIndex(i => i.id === item.id);
    const newItem: ChecklistItem = {
      id: generateId(),
      text: '',
      completed: item.completed,
    };

    const updated = [...current];
    updated.splice(idx + 1, 0, newItem);
    this.commitChange(updated);

    // Focus newly created item
    this.focusItemById(newItem.id);
  }

  public onBackspace(item: ChecklistItem, event: Event): void {
    if (item.text.length === 0) {
      event.preventDefault();
      const current = this.items();
      if (current.length <= 1) return; // Don't delete last item

      const active = this.activeItems;
      const currentActiveIdx = active.findIndex(i => i.id === item.id);
      const prevActiveItem = currentActiveIdx > 0 ? active[currentActiveIdx - 1] : null;

      this.deleteItem(item);

      if (prevActiveItem) {
        this.focusItemById(prevActiveItem.id, true);
      }
    }
  }

  public onArrowUp(item: ChecklistItem, event: Event): void {
    const active = item.completed ? this.completedItems : this.activeItems;
    const idx = active.findIndex(i => i.id === item.id);
    if (idx > 0) {
      event.preventDefault();
      this.focusItemById(active[idx - 1].id);
    }
  }

  public onArrowDown(item: ChecklistItem, event: Event): void {
    const active = item.completed ? this.completedItems : this.activeItems;
    const idx = active.findIndex(i => i.id === item.id);
    if (idx < active.length - 1) {
      event.preventDefault();
      this.focusItemById(active[idx + 1].id);
    }
  }

  /**
   * Handle pasting text. If the text has multiple lines, split them into separate items!
   */
  public onPaste(item: ChecklistItem, event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text.includes('\n') && !text.includes('\r')) {
      return; // Single line paste handled natively
    }

    event.preventDefault();
    const rawLines = text.split(/\r?\n/);
    const cleanLines = rawLines
      .map(l => l.trim().replace(/^[-*+]\s+/, '').replace(/^\[([ xX])\]\s+/, ''))
      .filter(l => l.length > 0);

    if (cleanLines.length === 0) return;

    const current = this.items();
    const idx = current.findIndex(i => i.id === item.id);
    if (idx === -1) return;

    const targetInput = event.target as HTMLInputElement;
    const curVal = targetInput?.value ?? item.text;
    const selStart = targetInput?.selectionStart ?? curVal.length;
    const selEnd = targetInput?.selectionEnd ?? curVal.length;

    const prefix = curVal.slice(0, selStart);
    const suffix = curVal.slice(selEnd);

    // First line merged with existing prefix
    const firstLine = (prefix + cleanLines[0]).trim();
    // Last line merged with existing suffix if more than one line
    const remainingLines = cleanLines.slice(1);
    if (remainingLines.length > 0) {
      remainingLines[remainingLines.length - 1] = (remainingLines[remainingLines.length - 1] + suffix).trim();
    } else {
      // If only 1 clean line
      item.text = (firstLine + suffix).trim();
      this.commitChange([...current]);
      return;
    }

    const newItemsToInsert: ChecklistItem[] = remainingLines.map(lineText => ({
      id: generateId(),
      text: lineText,
      completed: item.completed,
    }));

    const updated = [...current];
    updated[idx] = { ...item, text: firstLine };
    updated.splice(idx + 1, 0, ...newItemsToInsert);

    this.commitChange(updated);

    const lastInserted = newItemsToInsert[newItemsToInsert.length - 1];
    if (lastInserted) {
      this.focusItemById(lastInserted.id, true);
    }
  }

  public onNewItemEnter(event: Event): void {
    event.preventDefault();
    const text = this.newItemText().trim();
    if (!text) return;

    const newItem: ChecklistItem = {
      id: generateId(),
      text,
      completed: false,
    };

    const current = this.items();
    this.commitChange([...current, newItem]);
    this.newItemText.set('');
  }

  public addNewItemFromPrompt(): void {
    const newItem: ChecklistItem = {
      id: generateId(),
      text: '',
      completed: false,
    };
    const current = this.items();
    this.commitChange([...current, newItem]);
    this.focusItemById(newItem.id);
  }

  public toggleCompletedSection(): void {
    this.isCompletedExpanded.update(v => !v);
  }

  // --- CDK Drag & Drop ---

  public onDropActive(event: CdkDragDrop<ChecklistItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const active = [...this.activeItems];
    moveItemInArray(active, event.previousIndex, event.currentIndex);

    // Merge active with completed
    const merged = [...active, ...this.completedItems];
    this.commitChange(merged);
  }

  public onDropCompleted(event: CdkDragDrop<ChecklistItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const completed = [...this.completedItems];
    moveItemInArray(completed, event.previousIndex, event.currentIndex);

    const merged = [...this.activeItems, ...completed];
    this.commitChange(merged);
  }

  private focusItemById(id: string, selectEnd = false): void {
    requestAnimationFrame(() => {
      const inputs = this.itemInputs();
      for (const ref of inputs) {
        if (ref.nativeElement.dataset['itemId'] === id) {
          ref.nativeElement.focus();
          if (selectEnd) {
            const len = ref.nativeElement.value.length;
            ref.nativeElement.setSelectionRange(len, len);
          }
          break;
        }
      }
    });
  }

  // --- Real-time Collaboration (SignalR + Yjs) ---

  private async initCollaboration(noteId: string): Promise<void> {
    if (typeof window === 'undefined') return;
    this.destroyCollaboration();

    const ydoc = new Y.Doc();
    const yitems = ydoc.getArray<Y.Map<any>>('checklist');
    this.ydoc = ydoc;
    this.yitems = yitems;
    this.isCollabActive = true;

    // Observe local/remote Yjs updates to reflect in Angular signals
    yitems.observeDeep(() => {
      const itemsList: ChecklistItem[] = [];
      for (let i = 0; i < yitems.length; i++) {
        const map = yitems.get(i);
        itemsList.push({
          id: (map.get('id') as string) || generateId(),
          text: (map.get('text') as string) || '',
          completed: !!map.get('completed'),
        });
      }

      this.items.set(itemsList);
      const md = checklistToMarkdown(itemsList);
      this.suppressNextExternalSync = true;
      this.value.set(md);
      this.onChange(md);
    });

    const hub = new HubConnectionBuilder()
      .withUrl('/hubs/collaboration')
      .withAutomaticReconnect()
      .build();

    this.hub = hub;

    hub.on('ReceiveUpdate', (updateB64: string) => {
      if (!this.ydoc) return;
      try {
        const update = fromBase64(updateB64);
        Y.applyUpdate(this.ydoc, update, 'remote');
      } catch (err) {
        console.error('Checklist: Failed to apply remote update', err);
      }
    });

    ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === 'remote' || origin === 'init') return;
      if (hub.state === HubConnectionState.Connected) {
        const b64 = toBase64(update);
        hub.invoke('SendUpdate', noteId, b64).catch(err => {
          console.error('Checklist: Failed to send update', err);
        });
      }
    });

    try {
      await hub.start();
      const historyUpdates = await hub.invoke<string[]>('JoinNote', noteId);

      for (const u of historyUpdates) {
        Y.applyUpdate(ydoc, fromBase64(u), 'init');
      }

      // If document is empty and we have existing note markdown, seed it
      if (historyUpdates.length === 0 && yitems.length === 0) {
        const currentMd = this.value() ?? '';
        const initialItems = markdownToChecklist(currentMd);
        const toSeed = initialItems.length > 0
          ? initialItems
          : [{ id: generateId(), text: '', completed: false }];

        ydoc.transact(() => {
          const ymaps = toSeed.map(item => {
            const map = new Y.Map<any>();
            map.set('id', item.id);
            map.set('text', item.text);
            map.set('completed', item.completed);
            return map;
          });
          yitems.insert(0, ymaps);
        });
      }
    } catch (err) {
      console.warn('Checklist: Realtime collaboration connection failed, fallback to local', err);
    }
  }

  private destroyCollaboration(): void {
    if (this.hub) {
      const h = this.hub;
      this.hub = null;
      if (h.state === HubConnectionState.Connected && this.collabNoteId()) {
        h.invoke('LeaveNote', this.collabNoteId()).catch(() => undefined);
      }
      h.stop().catch(() => undefined);
    }

    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
      this.yitems = null;
    }
    this.isCollabActive = false;
  }
}
