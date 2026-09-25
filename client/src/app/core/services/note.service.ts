import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateNoteRelationRequest,
  CreateNoteRequest,
  CreateNoteSourceRequest,
  NoteBacklinkResponse,
  NoteFilterParams,
  NoteRelationResponse,
  NoteResponse,
  NoteSourceResponse,
  NoteWikiIndexItem,
  PromoteNoteRequest,
  TagDto,
  TodoSummaryResponse,
  UpdateNoteRequest,
} from '../models/note.model';
import { PagedResult } from '../models/paged-result.model';

function toTagDto(tag: TagDto | string): TagDto {
  if (typeof tag === 'string') {
    const raw = tag.trim().replace(/^#/, '');
    if (raw.includes(':')) {
      const idx = raw.indexOf(':');
      return {
        tagType: 'Typed',
        category: raw.slice(0, idx),
        value: raw.slice(idx + 1),
      };
    }
    return {
      tagType: 'FreeForm',
      category: null,
      value: raw,
    };
  }
  return {
    tagType: tag.tagType ?? (tag.category ? 'Typed' : 'FreeForm'),
    category: tag.category ?? null,
    value: tag.value,
  };
}

@Injectable({
  providedIn: 'root',
})
export class NoteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/notes';

  public list(filter?: NoteFilterParams): Observable<PagedResult<NoteResponse>> {
    let params = new HttpParams();
    if (filter) {
      if (filter.level) params = params.set('level', filter.level);
      if (filter.libraryId) params = params.set('libraryId', filter.libraryId);
      if (filter.typeId) params = params.set('typeId', filter.typeId);
      if (filter.isTodo !== undefined) params = params.set('isTodo', filter.isTodo.toString());
      if (filter.isTrashed !== undefined)
        params = params.set('isTrashed', filter.isTrashed.toString());
      if (filter.search) params = params.set('search', filter.search);
      if (filter.tag) params = params.set('tag', filter.tag);
      if (filter.page) params = params.set('page', filter.page.toString());
      if (filter.pageSize) params = params.set('pageSize', filter.pageSize.toString());
    }
    return this.http.get<PagedResult<NoteResponse>>(this.baseUrl, { params });
  }

  public getById(id: string): Observable<NoteResponse> {
    return this.http.get<NoteResponse>(`${this.baseUrl}/${id}`);
  }

  /** Lightweight index of wiki-eligible notes (Journal + Quick), for the Explore tree. */
  public getWikiIndex(): Observable<NoteWikiIndexItem[]> {
    return this.http.get<NoteWikiIndexItem[]>(`${this.baseUrl}/wiki-index`);
  }

  public getBacklinks(id: string): Observable<NoteBacklinkResponse[]> {
    return this.http.get<NoteBacklinkResponse[]>(`${this.baseUrl}/${id}/backlinks`);
  }

  public create(request: CreateNoteRequest): Observable<NoteResponse> {
    const payload = {
      ...request,
      tags: request.tags
        ? request.tags
            .map(toTagDto)
            .filter((tag) => (tag.tagType === 'Typed' ? !!tag.category : !!tag.value))
        : null,
    };
    return this.http.post<NoteResponse>(this.baseUrl, payload);
  }

  public update(id: string, request: UpdateNoteRequest): Observable<NoteResponse> {
    const payload = {
      ...request,
      tags: request.tags
        ? request.tags
            .map(toTagDto)
            .filter((tag) => (tag.tagType === 'Typed' ? !!tag.category : !!tag.value))
        : null,
    };
    return this.http.put<NoteResponse>(`${this.baseUrl}/${id}`, payload);
  }

  public trash(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  public restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/restore`, {});
  }

  public deletePermanent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/permanent`);
  }

  public promote(id: string, request: PromoteNoteRequest): Observable<NoteResponse> {
    return this.http.post<NoteResponse>(`${this.baseUrl}/${id}/promote`, request);
  }

  public toggleTodo(id: string): Observable<NoteResponse> {
    return this.http.patch<NoteResponse>(`${this.baseUrl}/${id}/todo`, {});
  }

  public getTodoSummary(): Observable<TodoSummaryResponse> {
    return this.http.get<TodoSummaryResponse>(`${this.baseUrl}/todos/summary`);
  }

  public addSource(
    noteId: string,
    request: CreateNoteSourceRequest,
  ): Observable<NoteSourceResponse> {
    return this.http.post<NoteSourceResponse>(`${this.baseUrl}/${noteId}/sources`, request);
  }

  public getSources(noteId: string): Observable<NoteSourceResponse[]> {
    return this.http.get<NoteSourceResponse[]>(`${this.baseUrl}/${noteId}/sources`);
  }

  public deleteSource(noteId: string, sourceId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${noteId}/sources/${sourceId}`);
  }

  public addRelation(
    noteId: string,
    request: CreateNoteRelationRequest,
  ): Observable<NoteRelationResponse> {
    return this.http.post<NoteRelationResponse>(`${this.baseUrl}/${noteId}/relations`, request);
  }

  public getRelations(noteId: string): Observable<NoteRelationResponse[]> {
    return this.http.get<NoteRelationResponse[]>(`${this.baseUrl}/${noteId}/relations`);
  }

  public deleteRelation(noteId: string, relationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${noteId}/relations/${relationId}`);
  }

  public renderPreview(markdown: string): Observable<{ renderedHtml: string }> {
    return this.http.post<{ renderedHtml: string }>(`${this.baseUrl}/render`, { markdown });
  }
}
