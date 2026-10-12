export type NoteLevel = 'Inbox' | 'Note' | 'Journal';
export type NoteFormat = 'Markdown' | 'List';

export interface WikiLinkWarning {
  title: string;
  reason: string;
}

export interface TagDto {
  tagType?: 'FreeForm' | 'Typed';
  category?: string | null;
  value: string | null;
}

export function formatTag(tag: TagDto): string {
  if (!tag.category) return tag.value ?? '';
  return tag.value ? `${tag.category}:${tag.value}` : tag.category;
}

export interface NoteSourceResponse {
  id: string;
  noteId: string;
  title: string;
  citation?: string;
  description?: string | null;
  url?: string | null;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface NoteRelationResponse {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  targetNoteTitle: string;
  role: string;
  context?: string | null;
  createdAtUtc: string;
}

export interface NoteBacklinkResponse {
  relationId: string;
  sourceNoteId: string;
  sourceNoteTitle: string;
  role: string;
  context?: string | null;
}

/** Lightweight wiki-eligible note projection powering the Explore library tree. */
export interface NoteWikiIndexItem {
  id: string;
  level: NoteLevel;
  title: string;
  libraryId?: string | null;
  typeId?: string | null;
  updatedAtUtc: string;
  /** True when another non-trashed note holds a relation pointing at this one. */
  isReferenced: boolean;
}

export interface NoteResponse {
  id: string;
  userId: string;
  level: NoteLevel;
  format?: NoteFormat;
  title: string;
  summary?: string | null;
  bodyMarkdown: string;
  renderedHtml: string;
  libraryId?: string | null;
  typeId?: string | null;
  typeVersion?: number | null;
  typedMetadataJson?: string | null;
  isTodo: boolean;
  todoCompletedAtUtc?: string | null;
  isTrashed: boolean;
  trashedAtUtc?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  tags?: TagDto[] | null;
  wikiLinks?: string[] | null;
  sources?: NoteSourceResponse[] | null;
  outboundRelations?: NoteRelationResponse[] | null;
  backlinks?: NoteBacklinkResponse[] | null;
  unresolvedWikiLinks?: WikiLinkWarning[] | null;
  typeValidationWarnings?: string[] | null;
  isOwner?: boolean;
  isShared?: boolean;
  ownerUserName?: string | null;
  shares?: NoteShareUserDto[] | null;
  isPinned?: boolean;
  pinnedAtUtc?: string | null;
}

export interface NoteSummaryResponse {
  id: string;
  level: NoteLevel;
  format?: NoteFormat;
  title: string;
  summary?: string | null;
  bodyMarkdown?: string | null;
  renderedHtml?: string | null;
  libraryId?: string | null;
  typeId?: string | null;
  isTodo: boolean;
  todoCompletedAtUtc?: string | null;
  isTrashed: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  tags?: TagDto[] | null;
  typedMetadataJson?: string | null;
  userId?: string;
  isOwner?: boolean;
  isShared?: boolean;
  ownerUserName?: string | null;
  isPinned?: boolean;
  pinnedAtUtc?: string | null;
}

export interface NoteShareUserDto {
  userId: string;
  userName: string;
  sharedAtUtc: string;
}

export interface NoteSharesResponse {
  noteId: string;
  ownerId: string;
  ownerUserName: string;
  isOwner: boolean;
  shares: NoteShareUserDto[];
}

export interface ShareNoteRequest {
  userName?: string;
  userId?: string;
}

export interface CreateNoteRequest {
  level: NoteLevel;
  format?: NoteFormat;
  title: string;
  summary?: string | null;
  bodyMarkdown?: string;
  libraryId?: string | null;
  typeId?: string | null;
  typedMetadataJson?: string | null;
  isTodo?: boolean;
  tags?: (TagDto | string)[];
  isPinned?: boolean;
}

export interface UpdateNoteRequest {
  title?: string;
  summary?: string | null;
  bodyMarkdown?: string;
  libraryId?: string | null;
  typeId?: string | null;
  typedMetadataJson?: string | null;
  isTodo?: boolean;
  tags?: (TagDto | string)[];
  isPinned?: boolean;
}

export interface PromoteNoteRequest {
  targetLevel: NoteLevel;
  typeId?: string | null;
  typedMetadataJson?: string | null;
  libraryId?: string | null;
  tags?: TagDto[];
  resolvedConflictPayload?: string | null;
}

export interface NoteFilterParams {
  level?: NoteLevel;
  libraryId?: string;
  typeId?: string;
  isTodo?: boolean;
  isTrashed?: boolean;
  search?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface TodoSummaryResponse {
  pendingCount: number;
  completedCount: number;
  pendingTodos: NoteSummaryResponse[];
  recentCompletedTodos: NoteSummaryResponse[];
}

export interface CreateNoteSourceRequest {
  title: string;
  citation?: string;
  description?: string | null;
  url?: string | null;
}

export interface CreateNoteRelationRequest {
  targetNoteId: string;
  role: string;
  context?: string | null;
}
