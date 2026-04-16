import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface AdminSession {
  id: number;
  username: string;
  nombre: string;
}

interface LoginResponse {
  token: string;
  admin: AdminSession;
}

interface AdminPayload {
  username: string;
  password: string;
  nombre: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly tokenKey = 'tareas_admin_token';
  private readonly sessionState = signal<AdminSession | null>(null);

  readonly adminActual = this.sessionState.asReadonly();
  readonly sesionActiva = computed(() => this.sessionState() !== null);

  constructor() {
    this.restaurarSesion();
  }

  private getAuthHeaders() {
    const token = this.getToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/login`, { username, password })
      .pipe(tap((response) => this.persistirSesion(response.token, response.admin)));
  }

  obtenerPerfil(): Observable<{ admin: AdminSession }> {
    return this.http.get<{ admin: AdminSession }>(`${API_BASE_URL}/auth/me`, this.getAuthHeaders()).pipe(
      tap((response) => {
        this.sessionState.set(response.admin);
      }),
    );
  }

  actualizarPerfil(payload: { username: string; password?: string }) {
    return this.http
      .put<{ admin: AdminSession }>(`${API_BASE_URL}/auth/profile`, payload, this.getAuthHeaders())
      .pipe(tap((response) => this.sessionState.set(response.admin)));
  }

  crearAdministrador(payload: AdminPayload) {
    return this.http.post(`${API_BASE_URL}/auth/admins`, payload, this.getAuthHeaders());
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.tokenKey);
    }

    this.sessionState.set(null);
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return localStorage.getItem(this.tokenKey);
  }

  private restaurarSesion() {
    const token = this.getToken();
    if (!token) {
      return;
    }

    this.obtenerPerfil().subscribe({
      error: () => this.logout(),
    });
  }

  private persistirSesion(token: string, admin: AdminSession) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.tokenKey, token);
    }

    this.sessionState.set(admin);
  }
}
