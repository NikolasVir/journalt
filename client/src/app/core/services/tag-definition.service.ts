import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateTagDefinitionRequest,
  TagDefinitionResponse,
  UpdateTagDefinitionRequest
} from '../models/tag-definition.model';

@Injectable({
  providedIn: 'root'
})
export class TagDefinitionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/tags/definitions';

  public list(): Observable<TagDefinitionResponse[]> {
    return this.http.get<TagDefinitionResponse[]>(this.baseUrl);
  }

  public getById(id: string): Observable<TagDefinitionResponse> {
    return this.http.get<TagDefinitionResponse>(`${this.baseUrl}/${id}`);
  }

  public create(request: CreateTagDefinitionRequest): Observable<TagDefinitionResponse> {
    const payload = {
      category: request.category,
      allowedValuesJson: request.allowedValuesJson ?? (request.allowedValues ? JSON.stringify(request.allowedValues) : null)
    };
    return this.http.post<TagDefinitionResponse>(this.baseUrl, payload);
  }

  public update(id: string, request: UpdateTagDefinitionRequest): Observable<TagDefinitionResponse> {
    const payload = {
      allowedValuesJson: request.allowedValuesJson ?? (request.allowedValues ? JSON.stringify(request.allowedValues) : null)
    };
    return this.http.put<TagDefinitionResponse>(`${this.baseUrl}/${id}`, payload);
  }

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
