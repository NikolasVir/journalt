import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  CreateLibraryRequest,
  LibraryResponse,
  LibrarySharesResponse,
  LibraryTreeResponse,
  MoveLibraryRequest,
  RenameLibraryRequest,
  ShareLibraryRequest
} from '../models/library.model';

export interface NavLibraryItem {
  id: string;
  name: string;
  parentId?: string | null;
  depth: number;
  hasChildren: boolean;
  isOwner?: boolean;
  isShared?: boolean;
  ownerUserName?: string;
  notesCount?: number;
}

function flattenTree(nodes: LibraryTreeResponse[], depth = 0, parentId: string | null = null): NavLibraryItem[] {
  const result: NavLibraryItem[] = [];
  for (const node of nodes) {
    const hasChildren = (node.children?.length ?? 0) > 0;
    result.push({
      id: node.id,
      name: node.name,
      parentId,
      depth,
      hasChildren,
      isOwner: node.isOwner,
      isShared: node.isShared,
      ownerUserName: node.ownerUserName,
      notesCount: node.notesCount
    });
    if (hasChildren) {
      result.push(...flattenTree(node.children, depth + 1, node.id));
    }
  }
  return result;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/libraries';

  public readonly libraryTree = signal<LibraryTreeResponse[]>([]);
  public readonly navLibraries = signal<NavLibraryItem[]>([]);
  public readonly sharedLibraryTree = signal<LibraryTreeResponse[]>([]);
  public readonly sharedNavLibraries = signal<NavLibraryItem[]>([]);
  public readonly libraryMap = signal<Map<string, string>>(new Map());

  public loadLibraries(): void {
    this.getTree().subscribe({
      next: (tree) => {
        this.libraryTree.set(tree);
        const flattened = flattenTree(tree);
        this.navLibraries.set(flattened);
        this.updateLibraryMap(flattened);
      },
      error: () => {
        // gracefully handle nav load error
      }
    });

    this.getSharedTree().subscribe({
      next: (sharedTree) => {
        this.sharedLibraryTree.set(sharedTree);
        const flattened = flattenTree(sharedTree);
        this.sharedNavLibraries.set(flattened);
        this.updateLibraryMap(flattened);
      },
      error: () => {
        // gracefully handle shared nav load error
      }
    });
  }

  private updateLibraryMap(items: NavLibraryItem[]): void {
    this.libraryMap.update((map) => {
      const next = new Map(map);
      for (const item of items) {
        next.set(item.id, item.name);
      }
      return next;
    });
  }

  public getLibraryName(id: string): string | undefined {
    return this.libraryMap().get(id);
  }

  public list(): Observable<LibraryResponse[]> {
    return this.http.get<LibraryResponse[]>(`${this.baseUrl}?flat=true`);
  }

  public getTree(): Observable<LibraryTreeResponse[]> {
    return this.http.get<LibraryTreeResponse[]>(this.baseUrl);
  }

  public getSharedTree(): Observable<LibraryTreeResponse[]> {
    return this.http.get<LibraryTreeResponse[]>(`${this.baseUrl}/shared`);
  }

  public getShares(id: string): Observable<LibrarySharesResponse> {
    return this.http.get<LibrarySharesResponse>(`${this.baseUrl}/${id}/shares`);
  }

  public share(id: string, request: ShareLibraryRequest): Observable<LibrarySharesResponse> {
    return this.http.post<LibrarySharesResponse>(`${this.baseUrl}/${id}/shares`, request).pipe(
      tap(() => this.loadLibraries())
    );
  }

  public removeShare(id: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/shares/${userId}`).pipe(
      tap(() => this.loadLibraries())
    );
  }

  public create(request: CreateLibraryRequest): Observable<LibraryResponse> {
    return this.http.post<LibraryResponse>(this.baseUrl, request).pipe(
      tap(() => this.loadLibraries())
    );
  }

  public rename(id: string, request: RenameLibraryRequest): Observable<LibraryResponse> {
    return this.http.put<LibraryResponse>(`${this.baseUrl}/${id}`, request).pipe(
      tap(() => this.loadLibraries())
    );
  }

  public move(id: string, request: MoveLibraryRequest): Observable<LibraryResponse> {
    return this.http.put<LibraryResponse>(`${this.baseUrl}/${id}/move`, request).pipe(
      tap(() => this.loadLibraries())
    );
  }

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.loadLibraries())
    );
  }
}

