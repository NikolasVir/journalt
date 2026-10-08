import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserSummaryResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/users';

  public search(query?: string): Observable<UserSummaryResponse[]> {
    let params = new HttpParams();
    if (query) {
      params = params.set('search', query);
    }
    return this.http.get<UserSummaryResponse[]>(this.baseUrl, { params });
  }
}
