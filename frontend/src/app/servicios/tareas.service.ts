import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { Tarea } from '../usuario.service';
import { AuthService } from './auth.service';

export interface GuardarTareaPayload {
  titulo: string;
  fecha: string;
  desc: string;
}

interface TareaApi {
  id: string | number;
  titulo: string;
  resumen: string;
  expira: string;
  idUsuario: string | number;
  completada: boolean | number;
}

@Injectable({
  providedIn: 'root',
})
export class TareasService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${API_BASE_URL}/tareas`;

  crearNuevaTareaVacia(): GuardarTareaPayload {
    return {
      titulo: '',
      fecha: new Date().toISOString().slice(0, 10),
      desc: '',
    };
  }

  // Generar UUID v4
  private generarId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private getAuthHeaders() {
    const token = this.authService.getToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  getTareasPorUsuario(usuarioId: number): Observable<Tarea[]> {
    const options = {
      ...this.getAuthHeaders(),
      params: { idUsuario: usuarioId.toString() },
    };

    return this.http
      .get<TareaApi[]>(this.apiUrl, options)
      .pipe(map((apiTareas) => apiTareas.map(this.mapearTarea)));
  }

  crearTarea(usuarioId: number, payload: GuardarTareaPayload) {
    const tareaPayload = {
      id: this.generarId(),
      titulo: payload.titulo.trim(),
      resumen: payload.desc.trim(),
      expira: payload.fecha,
      idUsuario: usuarioId,
    };
    console.log('📤 Enviando tarea al servidor:', tareaPayload);
    console.log('🔗 URL:', this.apiUrl);

    return this.http.post(this.apiUrl, tareaPayload, this.getAuthHeaders());
  }

  actualizarTarea(tareaId: string, payload: GuardarTareaPayload) {
    return this.http.put(`${this.apiUrl}/${tareaId}`, {
      titulo: payload.titulo.trim(),
      resumen: payload.desc.trim(),
      expira: payload.fecha,
    }, this.getAuthHeaders());
  }

  completarTarea(tareaId: string) {
    return this.http.put(`${this.apiUrl}/${tareaId}`, {
      completada: true,
    }, this.getAuthHeaders());
  }

  eliminarTarea(tareaId: string) {
    return this.http.delete(`${this.apiUrl}/${tareaId}`, this.getAuthHeaders());
  }

  private mapearTarea(tarea: TareaApi): Tarea {
    return {
      id: tarea.id.toString(),
      titulo: tarea.titulo,
      fecha: tarea.expira,
      desc: tarea.resumen,
      completada: Boolean(tarea.completada),
    };
  }
}
