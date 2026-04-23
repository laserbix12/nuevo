import { Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
        <div class="header-bar">
          <div class="logo-section" (click)="volverAlInicio()" style="cursor: pointer;">
            <div class="logo-circle">
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <rect x="50" y="60" width="100" height="30" rx="5" fill="none" stroke="#80ff72" stroke-width="3"/>
                <polyline points="65,75 75,85 95,70" stroke="#80ff72" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="header-text">
              <h1>TAREA FACIL</h1>
              <p>Administrador de Tareas ADSO</p>
            </div>
          </div>

          <div class="header-right">
            @if (sesionActiva()) {
              <p class="welcome-text">Hola, {{ adminActual()?.username }}</p>
              <nav class="top-nav">
                <button type="button" class="nav-link" (click)="mostrarPerfil.set(!mostrarPerfil())">Mi Perfil</button>
                <button type="button" class="nav-link" (click)="mostrarNuevoAdmin.set(!mostrarNuevoAdmin())">Registrar Admin</button>
                <button type="button" class="nav-link" (click)="toggleGestionUsuarios()">Gestionar Usuarios</button>
                <button type="button" class="nav-link nav-link--logout" (click)="cerrarSesion()">Cerrar Sesion</button>
              </nav>
            }
          </div>
        </div>
      </header>

      @if (mensajeGlobal()) {
        <p class="top-message" [class.error]="tipoMensaje() === 'error'">{{ mensajeGlobal() }}</p>
      }

      <div class="content-wrapper">
        <aside class="sidebar">
          @if (usuariosCargando()) {
            <p class="top-message">Cargando usuarios...</p>
          } @else {
            @for (usuario of usuarios(); track usuario.id) {
              <a
                class="user-item"
                [routerLink]="['/usuario', usuario.id]"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="cerrarPaneles()"
              >
                <img [src]="usuario.foto" class="avatar" [alt]="usuario.nombre" />
                <span>{{ usuario.nombre }}</span>
              </a>
            }
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
                <span>Sesion de administrador activa</span>
              </div>
            }
          </section>

          @if (sesionActiva() && mostrarPerfil()) {
            <section class="embedded-card">
              <h3>Editar perfil</h3>
              <form class="stack-form" (ngSubmit)="guardarPerfil()">
                <input type="text" name="username" [(ngModel)]="perfilForm.username" placeholder="Usuario" required />
                <input
                  type="password"
                  name="password"
                  [(ngModel)]="perfilForm.password"
                  placeholder="Contrasena"
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
                <input type="text" name="username" [(ngModel)]="adminForm.username" placeholder="Usuario" required />
                <input type="password" name="password" [(ngModel)]="adminForm.password" placeholder="Contrasena" required />
                <div class="modal-footer compact">
                  <button type="button" class="btn-cancel" (click)="cerrarPaneles()">Cancelar</button>
                  <button type="submit" class="btn-create">Crear admin</button>
                </div>
              </form>
            </section>
          }

          @if (sesionActiva() && mostrarGestionUsuarios()) {
            <section class="embedded-card users-admin-card">
              <div class="users-admin-header">
                <div>
                  <h3>Administrar usuarios</h3>
                  <p>Crear, editar o eliminar usuarios y sus tareas.</p>
                </div>
                <button type="button" class="btn-add" (click)="abrirModalCrearUsuario()">Crear usuario</button>
              </div>

              @if (mensajeUsuario()) {
                <p class="form-error" [class.form-success]="tipoMensajeUsuario() !== 'error'">{{ mensajeUsuario() }}</p>
              }

              @if (usuariosCargando()) {
                <p>Cargando usuarios...</p>
              } @else if (usuarios().length === 0) {
                <p>No hay usuarios disponibles.</p>
              } @else {
                <div class="user-list">
                  @for (usuario of usuarios(); track usuario.id) {
                    <article class="user-card" (click)="seleccionarUsuario(usuario)" style="cursor: pointer;" title="Ver tareas de {{ usuario.nombre }}">
                      <div class="user-card-details">
                        <img [src]="usuario.foto" [alt]="usuario.nombre" />
                        <div>
                          <strong>{{ usuario.nombre }}</strong>
                          <small>ID: {{ usuario.id }}</small>
                        </div>
                      </div>
                      <div class="user-card-buttons">
                        <button type="button" class="btn-edit" (click)="abrirModalEditarUsuario(usuario); $event.stopPropagation()">Editar</button>
                        <button type="button" class="btn-create">Ver tareas</button>
                        <button type="button" class="btn-delete" (click)="eliminarUsuario(usuario); $event.stopPropagation()">Eliminar</button>
                      </div>
                    </article>
                  }
                </div>
              }
            </section>
          }

          <router-outlet></router-outlet>

          @if (modalUsuarioAbierto()) {
            <div class="modal-overlay" (click)="cerrarModalPorFondo($event)">
              <section class="modal-content">
                <h2>{{ usuarioEditando() ? 'Editar usuario' : 'Crear nuevo usuario' }}</h2>
                <form (ngSubmit)="guardarUsuario()">
                  <div class="form-group">
                    <label for="nombreUsuario">Nombre</label>
                    <input id="nombreUsuario" type="text" name="nombre" [(ngModel)]="usuarioForm().nombre" required />
                  </div>

                  <div class="form-group">
                    <label>Avatar</label>
                    @if (avataresCargando()) {
                      <p>Cargando avatares...</p>
                    } @else {
                      <div class="avatar-grid">
                        @for (avatar of avatares(); track avatar.id) {
                          <button
                            type="button"
                            class="avatar-option"
                            [class.selected]="usuarioForm().avatar === avatar.id"
                            (click)="usuarioForm.set({ ...usuarioForm(), avatar: avatar.id })"
                          >
                            <img [src]="avatar.url" [alt]="avatar.id" />
                          </button>
                        }
                      </div>
                    }
                  </div>

                  <div class="modal-footer">
                    <button type="button" class="btn-cancel" (click)="cerrarModalUsuario()">Cancelar</button>
                    <button type="submit" class="btn-create">{{ usuarioEditando() ? 'Guardar cambios' : 'Crear usuario' }}</button>
                  </div>
                </form>
              </section>
            </div>
          }
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
  private readonly platformId = inject(PLATFORM_ID);

  readonly usuarios = signal<Usuario[]>([]);
  readonly usuariosCargando = signal(true);
  readonly avatares = signal<{ id: string; url: string }[]>([]);
  readonly avataresCargando = signal(true);
  readonly modalUsuarioAbierto = signal(false);
  readonly usuarioEditando = signal<Usuario | null>(null);
  readonly usuarioForm = signal({ nombre: '', avatar: '' });
  readonly mensajeUsuario = signal('');
  readonly tipoMensajeUsuario = signal<'ok' | 'error'>('ok');

  readonly adminActual = this.authService.adminActual;
  readonly sesionActiva = this.authService.sesionActiva;
  readonly mostrarPerfil = signal(false);
  readonly mostrarNuevoAdmin = signal(false);
  readonly mostrarGestionUsuarios = signal(false);
  readonly mensajeGlobal = signal('');
  readonly tipoMensaje = signal<'ok' | 'error'>('ok');
  readonly procesandoSesion = signal(false);

  loginForm = { username: '', password: '' };
  perfilForm = { username: '', password: '' };
  adminForm = { username: '', password: '' };

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarUsuarios();
      this.cargarAvatares();
    } else {
      this.usuariosCargando.set(false);
      this.avataresCargando.set(false);
    }

    effect(() => {
      const admin = this.adminActual();
      if (!admin) {
        this.mostrarPerfil.set(false);
        this.mostrarNuevoAdmin.set(false);
        this.modalUsuarioAbierto.set(false);
        return;
      }

      this.perfilForm = {
        username: admin.username,
        password: '',
      };
    });
  }

  private cargarUsuarios() {
    this.usuariosCargando.set(true);
    this.usuarioService.getUsuarios().subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.usuariosCargando.set(false);
      },
      error: (error) => {
        console.error('Error cargando usuarios:', error);
        this.usuarios.set([]);
        this.usuariosCargando.set(false);
        this.tipoMensaje.set('error');
        this.mensajeGlobal.set('No se pudieron cargar los usuarios.');
      },
    });
  }

  private cargarAvatares() {
    this.avataresCargando.set(true);
    this.usuarioService.getAvatares().subscribe({
      next: (avatares) => {
        this.avatares.set(avatares);
        this.avataresCargando.set(false);
      },
      error: (error) => {
        console.error('Error cargando avatares:', error);
        this.avatares.set([]);
        this.avataresCargando.set(false);
      },
    });
  }

  abrirModalCrearUsuario() {
    this.usuarioEditando.set(null);
    this.usuarioForm.set({ nombre: '', avatar: this.avatares()[0]?.id ?? '' });
    this.mensajeUsuario.set('');
    this.tipoMensajeUsuario.set('ok');
    this.modalUsuarioAbierto.set(true);
  }

  abrirModalEditarUsuario(usuario: Usuario) {
    this.usuarioEditando.set(usuario);
    this.usuarioForm.set({ nombre: usuario.nombre, avatar: usuario.avatar });
    this.mensajeUsuario.set('');
    this.tipoMensajeUsuario.set('ok');
    this.modalUsuarioAbierto.set(true);
  }

  cerrarModalUsuario() {
    this.modalUsuarioAbierto.set(false);
    this.usuarioEditando.set(null);
    this.usuarioForm.set({ nombre: '', avatar: '' });
    this.mensajeUsuario.set('');
    this.tipoMensajeUsuario.set('ok');
  }

  guardarUsuario() {
    if (!this.usuarioForm().nombre.trim() || !this.usuarioForm().avatar) {
      this.tipoMensajeUsuario.set('error');
      this.mensajeUsuario.set('Completa nombre y avatar.');
      return;
    }

    const payload = {
      nombre: this.usuarioForm().nombre.trim(),
      avatar: this.usuarioForm().avatar,
    };

    const peticion = this.usuarioEditando()
      ? this.usuarioService.actualizarUsuario(this.usuarioEditando()!.id, payload)
      : this.usuarioService.crearUsuario(payload);

    peticion.subscribe({
      next: () => {
        this.tipoMensajeUsuario.set('ok');
        this.mensajeUsuario.set(this.usuarioEditando() ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
        this.cargarUsuarios();
        this.cerrarModalUsuario();
      },
      error: (error) => {
        console.error('Error guardando usuario:', error);
        this.tipoMensajeUsuario.set('error');
        this.mensajeUsuario.set(error.error?.mensaje ?? 'No se pudo guardar el usuario.');
      },
    });
  }

  eliminarUsuario(usuario: Usuario) {
    if (!confirm(`Eliminar a ${usuario.nombre}? Esta acción también eliminará sus tareas.`)) {
      return;
    }

    this.usuarioService.eliminarUsuario(usuario.id).subscribe({
      next: () => {
        this.tipoMensaje.set('ok');
        this.mensajeGlobal.set('Usuario eliminado correctamente.');
        this.cargarUsuarios();
      },
      error: (error) => {
        console.error('Error eliminando usuario:', error);
        this.tipoMensaje.set('error');
        this.mensajeGlobal.set(error.error?.mensaje ?? 'No se pudo eliminar el usuario.');
      },
    });
  }

  seleccionarUsuario(usuario: Usuario) {
    this.router.navigate(['/usuario', usuario.id]);
    this.cerrarPaneles();
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
        this.perfilForm = { username: admin.username, password: '' };
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
    this.authService
      .actualizarPerfil({
        username: this.perfilForm.username.trim(),
        password: this.perfilForm.password.trim() || undefined,
      })
      .subscribe({
        next: ({ admin }) => {
          this.tipoMensaje.set('ok');
          this.mensajeGlobal.set('Perfil actualizado correctamente.');
          this.perfilForm = { username: admin.username, password: '' };
          this.mostrarPerfil.set(false);
        },
        error: (error) => {
          this.tipoMensaje.set('error');
          this.mensajeGlobal.set(error.error?.mensaje ?? 'No se pudo actualizar el perfil.');
        },
      });
  }

  crearAdmin() {
    this.authService
      .crearAdministrador({
        username: this.adminForm.username.trim(),
        password: this.adminForm.password,
      })
      .subscribe({
        next: () => {
          this.tipoMensaje.set('ok');
          this.mensajeGlobal.set('Administrador creado correctamente.');
          this.adminForm = { username: '', password: '' };
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
    this.perfilForm = { username: '', password: '' };
    this.adminForm = { username: '', password: '' };
    this.cerrarPaneles();
    this.tipoMensaje.set('ok');
    this.mensajeGlobal.set('Sesion cerrada.');
  }

  toggleGestionUsuarios() {
    this.mostrarGestionUsuarios.set(!this.mostrarGestionUsuarios());
    this.mostrarPerfil.set(false);
    this.mostrarNuevoAdmin.set(false);
  }

  cerrarPaneles() {
    this.mostrarPerfil.set(false);
    this.mostrarNuevoAdmin.set(false);
    this.mostrarGestionUsuarios.set(false);
  }

  cerrarModalPorFondo(event: Event) {
    if (event.target === event.currentTarget) {
      this.cerrarModalUsuario();
    }
  }

  private limpiarMensajes() {
    this.mensajeGlobal.set('');
    this.tipoMensaje.set('ok');
  }
}
