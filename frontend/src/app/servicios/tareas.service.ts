import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { Tarea } from '../usuario.service';

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
  private readonly apiUrl = `${API_BASE_URL}/tareas`;

  crearNuevaTareaVacia(): GuardarTareaPayload {
    return {
      titulo: '',
      fecha: new Date().toISOString().slice(0, 10),
      desc: '',
    };
  }

  getTareasPorUsuario(usuarioId: number): Observable<Tarea[]> {
    return this.http
      .get<TareaApi[]>(`${this.apiUrl}/usuario/${usuarioId}`)
      .pipe(map((tareas) => tareas.map((tarea) => this.mapearTarea(tarea))));
  }

  crearTarea(usuarioId: number, payload: GuardarTareaPayload) {
    return this.http.post(this.apiUrl, {
      titulo: payload.titulo.trim(),
      resumen: payload.desc.trim(),
      expira: payload.fecha,
      idUsuario: usuarioId,
    });
  }

  actualizarTarea(tareaId: string, payload: GuardarTareaPayload) {
    return this.http.put(`${this.apiUrl}/${tareaId}`, {
      titulo: payload.titulo.trim(),
      resumen: payload.desc.trim(),
      expira: payload.fecha,
    });
  }

  completarTarea(tareaId: string) {
    return this.http.patch(`${this.apiUrl}/${tareaId}/completar`, {});
  }

  eliminarTarea(tareaId: string) {
    return this.http.delete(`${this.apiUrl}/${tareaId}`);
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
