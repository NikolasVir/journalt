import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  CreateLibraryRequest,
  LibraryResponse,
  LibraryTreeResponse,
  MoveLibraryRequest,
  RenameLibraryRequest
} from '../models/library.model';

export interface NavLibraryItem {
  id: string;
  name: string;
  parentId?: string | null;
  depth: number;
  hasChildren: boolean;
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
      hasChildren
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
  public readonly libraryMap = signal<Map<string, string>>(new Map());

  public loadLibraries(): void {
    this.getTree().subscribe({
      next: (tree) => {
        this.libraryTree.set(tree);
        const flattened = flattenTree(tree);
        this.navLibraries.set(flattened);
        const map = new Map<string, string>();
        for (const item of flattened) {
          map.set(item.id, item.name);
        }
        this.libraryMap.set(map);
      },
      error: () => {
        // gracefully handle nav load error
      }
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

