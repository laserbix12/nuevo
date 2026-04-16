import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './servicios/auth.service';
import { API_BASE_URL } from './api.config';

export interface Usuario {
  id: number;
  nombre: string;
  avatar: string;
  foto: string;
  ini: string;
}

export interface Tarea {
  id: string;
  titulo: string;
  fecha: string;
  desc: string;
  completada: boolean;
}

export interface AvatarOpcion {
  id: string;
  url: string;
}

export interface UsuarioPayload {
  nombre: string;
  avatar: string;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private mapUsuario(usuario: any): Usuario {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      avatar: usuario.avatar,
      foto: usuario.foto,
      ini: this.iniciales(usuario.nombre),
    };
  }

  getUsuarios(): Observable<Usuario[]> {
    return this.http
      .get<any[]>(`${API_BASE_URL}/usuarios`)
      .pipe(map((usuarios) => usuarios.map((usuario) => this.mapUsuario(usuario))));
  }

  getUsuario(id: number): Observable<Usuario> {
    return this.http
      .get<any>(`${API_BASE_URL}/usuarios/${id}`)
      .pipe(map((usuario) => this.mapUsuario(usuario)));
  }

  getAvatares(): Observable<AvatarOpcion[]> {
    return this.http.get<AvatarOpcion[]>(`${API_BASE_URL}/usuarios/avatars`);
  }

  crearUsuario(payload: UsuarioPayload): Observable<Usuario> {
    return this.http
      .post<any>(`${API_BASE_URL}/usuarios`, payload, this.getAuthHeaders())
      .pipe(map((usuario) => this.mapUsuario(usuario)));
  }

  actualizarUsuario(id: number, payload: UsuarioPayload): Observable<Usuario> {
    return this.http
      .put<any>(`${API_BASE_URL}/usuarios/${id}`, payload, this.getAuthHeaders())
      .pipe(map((usuario) => this.mapUsuario(usuario)));
  }

  eliminarUsuario(id: number) {
    return this.http.delete<{ mensaje: string }>(`${API_BASE_URL}/usuarios/${id}`, this.getAuthHeaders());
  }

  private getAuthHeaders() {
    const token = this.authService.getToken();
    return token
      ? {
          headers: new HttpHeaders({
            Authorization: `Bearer ${token}`,
          }),
        }
      : {};
  }

  private iniciales(nombre: string) {
    return nombre
      .split(' ')
      .map((parte) => parte[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
