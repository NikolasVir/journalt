import { NoteLevel } from '@core/models/note.model';

/**
 * A node in the Explore tree. Libraries hold nested libraries and their own
 * notes as leaves, so the tree is the only navigation column.
 */
export type ExploreNodeKind = 'library' | 'unfiled' | 'note';

export interface ExploreNode {
  kind: ExploreNodeKind;
  id: string;
  label: string;
  /** Nesting depth, used for indentation. */
  depth: number;
  /** Notes in this subtree. Always 0 for note nodes. */
  noteCount: number;
  /** Only library and unfiled nodes can be expanded. */
  expandable: boolean;
  noteLevel?: NoteLevel;
  /** Quick notes reach the wiki by being linked from another note. */
  isReferenced?: boolean;
  children: ExploreNode[];
}

/** Synthetic node id for notes that are not filed in any library. */
export const UNFILED_NODE_ID = '__unfiled__';
