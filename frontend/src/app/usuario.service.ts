import { Injectable } from '@angular/core';

export interface Tarea {
  id: string;
  titulo: string;
  fecha: string;
  desc: string;
  completada: boolean;
}

export interface Usuario {
  id: number;
  nombre: string;
  ini: string;
  foto: string;
}

@Injectable({
  providedIn: 'root',
})
export class UsuarioService {
  private readonly usuarios: Usuario[] = [
    { id: 1, nombre: 'Michaell Pulido', ini: 'MP', foto: 'https://i.pravatar.cc/100?u=1' },
    { id: 2, nombre: 'Karen Montoya', ini: 'KM', foto: 'https://i.pravatar.cc/100?u=2' },
    { id: 3, nombre: 'Adres Pulido', ini: 'AP', foto: 'https://i.pravatar.cc/100?u=3' },
    { id: 4, nombre: 'Gerardo Pulido', ini: 'GP', foto: 'https://i.pravatar.cc/100?u=4' },
    { id: 5, nombre: 'Andresito Pulido', ini: 'AN', foto: 'https://i.pravatar.cc/100?u=5' },
  ];

  getUsuarios(): Usuario[] {
    return [...this.usuarios];
  }

  getUsuario(id: number): Usuario | undefined {
    return this.usuarios.find((usuario) => usuario.id === id);
  }
}
