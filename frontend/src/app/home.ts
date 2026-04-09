import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Usuario, UsuarioService } from './usuario.service';
import { AuthService } from './servicios/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <header class="main-header">
        <button class="logo-button" type="button" (click)="volverAlInicio()">
          <div class="logo-circle">
            <img src="https://cdn-icons-png.flaticon.com/512/906/906334.png" alt="logo" />
          </div>
          <div class="logo-copy">
            <h1>TAREA FACIL</h1>
            <p>Administrador de Tareas ADSO</p>
          </div>
        </button>
      </header>

      @if (mensajeGlobal()) {
        <p class="top-message" [class.error]="tipoMensaje() === 'error'">{{ mensajeGlobal() }}</p>
      }

      <div class="content-wrapper">
        <aside class="sidebar">
          <div class="sidebar-title">
            <h3>Usuarios</h3>
            <small>Selecciona una persona</small>
          </div>

          @for (usuario of usuarios; track usuario.id) {
            <a
              class="user-item"
              [routerLink]="['/usuario', usuario.id]"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              <img [src]="usuario.foto" class="avatar" [alt]="usuario.nombre" />
              <span>
                {{ usuario.nombre }}
              </span>
            </a>
          }
        </aside>

        <main class="task-section">
          <section class="access-panel" [class.access-panel--admin]="sesionActiva()">
            @if (!sesionActiva()) {
              <form class="login-inline" (ngSubmit)="iniciarSesion()">
                <input
                  type="text"
                  name="username"
                  [(ngModel)]="loginForm.username"
                  placeholder="Usuario admin"
                  autocomplete="username"
                  required
                />
                <input
                  type="password"
                  name="password"
                  [(ngModel)]="loginForm.password"
                  placeholder="Contrasena"
                  autocomplete="current-password"
                  required
                />
                <button type="submit" [disabled]="procesandoSesion()">
                  {{ procesandoSesion() ? 'Ingresando...' : 'Iniciar sesion' }}
                </button>
              </form>
            } @else {
              <div class="session-summary">
                <strong>{{ adminActual()?.nombre }}</strong>
                <span>{{ adminActual()?.username }}</span>
              </div>
              <div class="session-actions">
                <button type="button" (click)="mostrarPerfil.set(!mostrarPerfil())">Editar perfil</button>
                <button type="button" (click)="mostrarNuevoAdmin.set(!mostrarNuevoAdmin())">Crear admin</button>
                <button type="button" class="btn-cancel" (click)="cerrarSesion()">Cerrar sesion</button>
              </div>
            }
          </section>

          @if (sesionActiva() && mostrarPerfil()) {
            <section class="embedded-card">
              <h3>Editar perfil</h3>
              <form class="stack-form" (ngSubmit)="guardarPerfil()">
                <input type="text" name="nombre" [(ngModel)]="perfilForm.nombre" placeholder="Nombre" required />
                <input
                  type="password"
                  name="passwordActual"
                  [(ngModel)]="perfilForm.passwordActual"
                  placeholder="Contrasena actual"
                  required
                />
                <input
                  type="password"
                  name="passwordNueva"
                  [(ngModel)]="perfilForm.passwordNueva"
                  placeholder="Nueva contrasena (opcional)"
                />
                <div class="modal-footer compact">
                  <button type="button" class="btn-cancel" (click)="cerrarPaneles()">Cancelar</button>
                  <button type="submit" class="btn-create">Guardar perfil</button>
                </div>
              </form>
            </section>
          }

          @if (sesionActiva() && mostrarNuevoAdmin()) {
            <section class="embedded-card">
              <h3>Crear administrador</h3>
              <form class="stack-form" (ngSubmit)="crearAdmin()">
                <input type="text" name="nombre" [(ngModel)]="adminForm.nombre" placeholder="Nombre" required />
                <input type="text" name="username" [(ngModel)]="adminForm.username" placeholder="Usuario" required />
                <input type="password" name="password" [(ngModel)]="adminForm.password" placeholder="Contrasena" required />
                <div class="modal-footer compact">
                  <button type="button" class="btn-cancel" (click)="cerrarPaneles()">Cancelar</button>
                  <button type="submit" class="btn-create">Crear admin</button>
                </div>
              </form>
            </section>
          }

          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styleUrls: ['./app.component.css'],
})
export class Home {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);

  readonly usuarios: Usuario[] = this.usuarioService.getUsuarios();
  readonly adminActual = this.authService.adminActual;
  readonly sesionActiva = this.authService.sesionActiva;
  readonly mostrarPerfil = signal(false);
  readonly mostrarNuevoAdmin = signal(false);
  readonly mensajeGlobal = signal('');
  readonly tipoMensaje = signal<'ok' | 'error'>('ok');
  readonly procesandoSesion = signal(false);
  loginForm = { username: '', password: '' };
  perfilForm = { nombre: '', passwordActual: '', passwordNueva: '' };
  adminForm = { nombre: '', username: '', password: '' };

  constructor() {
    effect(() => {
      const admin = this.adminActual();
      if (!admin) {
        return;
      }

      this.perfilForm = {
        nombre: admin.nombre,
        passwordActual: '',
        passwordNueva: '',
      };
    });
  }

  volverAlInicio() {
    this.router.navigateByUrl('/');
    this.cerrarPaneles();
    this.limpiarMensajes();
  }

  iniciarSesion() {
    if (this.procesandoSesion()) {
      return;
    }

    this.procesandoSesion.set(true);
    this.limpiarMensajes();

    this.authService.login(this.loginForm.username.trim(), this.loginForm.password).subscribe({
      next: ({ admin }) => {
        this.procesandoSesion.set(false);
        this.loginForm = { username: '', password: '' };
        this.perfilForm = { nombre: admin.nombre, passwordActual: '', passwordNueva: '' };
        this.tipoMensaje.set('ok');
        this.mensajeGlobal.set(`Sesion iniciada como ${admin.username}.`);
      },
      error: (error) => {
        this.procesandoSesion.set(false);
        this.tipoMensaje.set('error');
        this.mensajeGlobal.set(error.error?.mensaje ?? 'No se pudo iniciar sesion.');
      },
    });
  }

  guardarPerfil() {
    this.authService.actualizarPerfil({
      nombre: this.perfilForm.nombre.trim(),
      passwordActual: this.perfilForm.passwordActual,
      passwordNueva: this.perfilForm.passwordNueva.trim() || undefined,
    }).subscribe({
      next: ({ admin }) => {
        this.tipoMensaje.set('ok');
        this.mensajeGlobal.set('Perfil actualizado correctamente.');
        this.perfilForm = { nombre: admin.nombre, passwordActual: '', passwordNueva: '' };
        this.mostrarPerfil.set(false);
      },
      error: (error) => {
        this.tipoMensaje.set('error');
        this.mensajeGlobal.set(error.error?.mensaje ?? 'No se pudo actualizar el perfil.');
      },
    });
  }

  crearAdmin() {
    this.authService.crearAdministrador({
      nombre: this.adminForm.nombre.trim(),
      username: this.adminForm.username.trim(),
      password: this.adminForm.password,
    }).subscribe({
      next: () => {
        this.tipoMensaje.set('ok');
        this.mensajeGlobal.set('Administrador creado correctamente.');
        this.adminForm = { nombre: '', username: '', password: '' };
        this.mostrarNuevoAdmin.set(false);
      },
      error: (error) => {
        this.tipoMensaje.set('error');
        this.mensajeGlobal.set(error.error?.mensaje ?? 'No se pudo crear el administrador.');
      },
    });
  }

  cerrarSesion() {
    this.authService.logout();
    this.loginForm = { username: '', password: '' };
    this.perfilForm = { nombre: '', passwordActual: '', passwordNueva: '' };
    this.adminForm = { nombre: '', username: '', password: '' };
    this.cerrarPaneles();
    this.tipoMensaje.set('ok');
    this.mensajeGlobal.set('Sesion cerrada.');
  }

  cerrarPaneles() {
    this.mostrarPerfil.set(false);
    this.mostrarNuevoAdmin.set(false);
  }

  private limpiarMensajes() {
    this.mensajeGlobal.set('');
    this.tipoMensaje.set('ok');
  }
}
