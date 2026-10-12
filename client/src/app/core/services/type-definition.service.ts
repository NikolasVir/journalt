import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CloneTypeRequest,
  CreateTypeDefinitionRequest,
  CreateTypeVersionRequest,
  UpdateTypeDefinitionRequest,
  TypeDefinitionResponse,
  TypeMigrationPreviewItem,
  TypeMigrationRequest,
  TypeMigrationResult
} from '../models/type-definition.model';

@Injectable({
  providedIn: 'root'
})
export class TypeDefinitionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/types';

  public list(includeInactive = false, libraryId?: string | null): Observable<TypeDefinitionResponse[]> {
    let params = new HttpParams().set('includeInactive', includeInactive.toString());
    if (libraryId) {
      params = params.set('libraryId', libraryId);
    }
    return this.http.get<TypeDefinitionResponse[]>(this.baseUrl, { params });
  }

  public getById(id: string): Observable<TypeDefinitionResponse> {
    return this.http.get<TypeDefinitionResponse>(`${this.baseUrl}/${id}`);
  }

  public create(request: CreateTypeDefinitionRequest): Observable<TypeDefinitionResponse> {
    return this.http.post<TypeDefinitionResponse>(this.baseUrl, request);
  }

  public update(id: string, request: UpdateTypeDefinitionRequest): Observable<TypeDefinitionResponse> {
    return this.http.put<TypeDefinitionResponse>(`${this.baseUrl}/${id}`, request);
  }

  public createNewVersion(id: string, request: CreateTypeVersionRequest): Observable<TypeDefinitionResponse> {
    return this.http.post<TypeDefinitionResponse>(`${this.baseUrl}/${id}/version`, request);
  }

  public clone(id: string, request: CloneTypeRequest): Observable<TypeDefinitionResponse> {
    return this.http.post<TypeDefinitionResponse>(`${this.baseUrl}/${id}/clone`, request);
  }

  public duplicate(id: string, request: CloneTypeRequest): Observable<TypeDefinitionResponse> {
    return this.http.post<TypeDefinitionResponse>(`${this.baseUrl}/${id}/duplicate`, request);
  }

  public toggleActive(id: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/toggle-active`, {});
  }

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  public previewMigration(id: string, targetVersionId: string): Observable<TypeMigrationPreviewItem[]> {
    const params = new HttpParams().set('targetVersionId', targetVersionId);
    return this.http.get<TypeMigrationPreviewItem[]>(`${this.baseUrl}/${id}/migrations/preview`, { params });
  }

  public migrateNotes(id: string, request: TypeMigrationRequest): Observable<TypeMigrationResult> {
    return this.http.post<TypeMigrationResult>(`${this.baseUrl}/${id}/migrations`, request);
  }
}
