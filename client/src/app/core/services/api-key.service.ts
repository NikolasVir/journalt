import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApiKeyCreatedResponse,
  ApiKeyResponse,
  CreateApiKeyRequest
} from '../models/api-key.model';

@Injectable({
  providedIn: 'root'
})
export class ApiKeyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/apikeys';

  public getAll(): Observable<ApiKeyResponse[]> {
    return this.http.get<ApiKeyResponse[]>(this.baseUrl);
  }

  public create(request: CreateApiKeyRequest): Observable<ApiKeyCreatedResponse> {
    return this.http.post<ApiKeyCreatedResponse>(this.baseUrl, request);
  }

  public revoke(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  public revokeByName(name: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/by-name/${encodeURIComponent(name)}`);
  }
}
