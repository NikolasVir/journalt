import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateLibraryRequest,
  LibraryResponse,
  LibraryTreeResponse,
  MoveLibraryRequest,
  RenameLibraryRequest
} from '../models/library.model';

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/libraries';

  public list(): Observable<LibraryResponse[]> {
    return this.http.get<LibraryResponse[]>(`${this.baseUrl}?flat=true`);
  }

  public getTree(): Observable<LibraryTreeResponse[]> {
    return this.http.get<LibraryTreeResponse[]>(this.baseUrl);
  }

  public create(request: CreateLibraryRequest): Observable<LibraryResponse> {
    return this.http.post<LibraryResponse>(this.baseUrl, request);
  }

  public rename(id: string, request: RenameLibraryRequest): Observable<LibraryResponse> {
    return this.http.put<LibraryResponse>(`${this.baseUrl}/${id}`, request);
  }

  public move(id: string, request: MoveLibraryRequest): Observable<LibraryResponse> {
    return this.http.put<LibraryResponse>(`${this.baseUrl}/${id}/move`, request);
  }
}
