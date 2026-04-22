import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../servicios/auth.service';
import { GuardarTareaPayload, TareasService } from '../servicios/tareas.service';
import { Tarea, Usuario, UsuarioService } from '../usuario.service';

@Component({
  selector: 'app-usuario-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (usuario) {
      <section id="tareas">
        <header class="task-header">
          <div>
            <h2>Tareas de {{ usuario.nombre }}</h2>
            <p class="reading-mode">
              {{ sesionActiva()
                ? 'Modo administrador activo: puedes agregar, editar, terminar y eliminar tareas.'
                : 'Modo lectura: solo puedes consultar tareas.' }}
            </p>
          </div>

          @if (sesionActiva()) {
            <button type="button" class="btn-add" (click)="abrirModalCrear()">Agregar Tarea Nueva</button>
          }
        </header>

        @if (mensajeEstado()) {
          <p class="form-error" [class.form-success]="tipoMensaje() !== 'error'">{{ mensajeEstado() }}</p>
        }

        @if (cargando()) {
          <div class="skeleton-list">
            @for (_item of skeletons; track $index) {
              <article class="task-card skeleton-card">
                <span class="skeleton-line short"></span>
                <span class="skeleton-line"></span>
                <span class="skeleton-line"></span>
                <span class="skeleton-line tiny"></span>
              </article>
            }
          </div>
        } @else if (tareas().length === 0) {
          <div class="no-tasks">
            <p>No hay tareas para este usuario.</p>
          </div>
        } @else {
          <div class="task-list">
            @for (tarea of tareas(); track tarea.id) {
              <article
                class="task-card"
                [class.task-card-done]="tarea.completada"
                (click)="abrirDetalle(tarea, $event)"
                style="cursor: pointer;"
              >
                <div class="task-top old-style">
                  <div>
                    <span class="chip" [class.success]="tarea.completada">
                      {{ tarea.completada ? 'Completada' : 'Pendiente' }}
                    </span>
                    <h3>{{ tarea.titulo }}</h3>
                  </div>
                  <p class="task-date">{{ tarea.fecha | date:"EEEE, d 'de' MMMM 'de' y, h:mm a" | lowercase }}</p>
                </div>

                <p class="task-desc">{{ tarea.desc }}</p>

                @if (sesionActiva()) {
                  <div class="btn-footer" (click)="$event.stopPropagation()">
                    <button type="button" class="btn-action" (click)="abrirModalEditar(tarea)">Editar</button>
                    <button
                      type="button"
                      class="btn-action"
                      [class.btn-action--success]="!tarea.completada"
                      [class.btn-action--reopen]="tarea.completada"
                      (click)="toggleEstado(tarea)"
                    >
                      {{ tarea.completada ? 'Reabrir' : 'Terminar' }}
                    </button>
                    <button type="button" class="btn-action btn-action--danger" (click)="eliminar(tarea.id)">Eliminar</button>
                  </div>
                }
              </article>
            }
          </div>
        }
      </section>

      @if (detalleAbierto()) {
        <div class="modal-overlay" (click)="cerrarDetalle($event)">
          <section class="modal-content detail-modal">
            <span class="chip" [class.success]="tareaDetalle()?.completada" style="margin-bottom: 12px;">
              {{ tareaDetalle()?.completada ? 'Completada' : 'Pendiente' }}
            </span>
            <h2 style="margin-top: 0;">{{ tareaDetalle()?.titulo }}</h2>
            <p class="task-date" style="margin-bottom: 16px;">{{ tareaDetalle()?.fecha | date:"EEEE, d 'de' MMMM 'de' y, h:mm a" | lowercase }}</p>
            <p class="task-desc" style="margin-bottom: 24px; white-space: pre-wrap;">{{ tareaDetalle()?.desc }}</p>
            <div class="modal-footer">
              @if (sesionActiva()) {
                <button type="button" class="btn-edit" (click)="cerrarDetalleYEditar()">Editar</button>
                <button
                  type="button"
                  [class]="tareaDetalle()?.completada ? 'btn-reopen' : 'btn-create'"
                  (click)="toggleEstadoDesdeDetalle()"
                >
                  {{ tareaDetalle()?.completada ? 'Reabrir' : 'Terminar' }}
                </button>
              }
              <button type="button" class="btn-cancel" (click)="cerrarDetalleSolo()">Cerrar</button>
            </div>
          </section>
        </div>
      }

      @if (modalAbierto()) {
        <div class="modal-overlay" (click)="cerrarModalPorFondo($event)">
          <section class="modal-content">
            <h2>{{ modoEdicion() ? 'Editar Tarea' : 'Agregar Nueva Tarea' }}</h2>
            <form (ngSubmit)="guardar()">
              <div class="form-group">
                <label for="titulo">Titulo</label>
                <input id="titulo" type="text" name="titulo" [(ngModel)]="formulario.titulo" required />
              </div>

              <div class="form-group">
                <label for="desc">Resumen</label>
                <textarea id="desc" name="desc" rows="4" [(ngModel)]="formulario.desc" required></textarea>
              </div>

              <div class="form-group">
                <label for="fecha">Fecha</label>
                <input id="fecha" type="date" name="fecha" [(ngModel)]="formulario.fecha" required />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="cerrarModal()">Cancelar</button>
                <button type="submit" class="btn-create" [disabled]="guardando()">
                  {{ guardando() ? 'Guardando...' : (modoEdicion() ? 'Guardar cambios' : 'Crear tarea') }}
                </button>
              </div>
            </form>
          </section>
        </div>
      }
    } @else {
      <div class="no-tasks">
        <p>Usuario no encontrado.</p>
      </div>
    }
  `,
  styleUrls: ['../app.component.css'],
})
export class UsuarioDetalle implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usuarioService = inject(UsuarioService);
  private readonly tareasService = inject(TareasService);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  usuario: Usuario | undefined;
  readonly tareas = signal<Tarea[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly modalAbierto = signal(false);
  readonly modoEdicion = signal(false);
  readonly mensajeEstado = signal('');
  readonly tipoMensaje = signal<'ok' | 'error'>('ok');
  readonly sesionActiva = this.authService.sesionActiva;
  readonly skeletons = Array.from({ length: 3 });
  readonly hayTareas = computed(() => this.tareas().length > 0);
  readonly detalleAbierto = signal(false);
  readonly tareaDetalle = signal<Tarea | null>(null);

  tareaEditandoId: string | null = null;
  formulario: GuardarTareaPayload = this.tareasService.crearNuevaTareaVacia();

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.cerrarModal();
      this.limpiarMensaje();
      this.usuario = undefined;

      if (!id) {
        this.tareas.set([]);
        this.cargando.set(false);
        return;
      }

      this.cargarUsuario(id);
    });
  }

  private cargarUsuario(id: number) {
    this.cargando.set(true);
    this.usuarioService.getUsuario(id).subscribe({
      next: (usuario) => {
        this.usuario = usuario;
        this.cargarTareas(usuario.id);
      },
      error: (error) => {
        console.error('Error cargando usuario:', error);
        this.usuario = undefined;
        this.tareas.set([]);
        this.cargando.set(false);
        if (error.status === 404) {
          this.recuperarDesdeUsuarioNoEncontrado();
          return;
        }

        this.tipoMensaje.set('error');
        this.mensajeEstado.set(error.error?.mensaje ?? error.error?.error ?? 'No se pudo cargar el usuario.');
      },
    });
  }

  private recuperarDesdeUsuarioNoEncontrado() {
    this.usuarioService.getUsuarios().subscribe({
      next: (usuarios) => {
        if (usuarios.length > 0) {
          this.router.navigate(['/usuario', usuarios[0].id]);
          return;
        }

        this.tipoMensaje.set('error');
        this.mensajeEstado.set('No hay usuarios disponibles. Crea uno para poder registrar tareas.');
      },
      error: (error) => {
        this.tipoMensaje.set('error');
        this.mensajeEstado.set(
          error.error?.mensaje ?? 'El usuario solicitado no existe y no se pudo cargar la lista de usuarios.',
        );
      },
    });
  }

  abrirModalCrear() {
    this.modoEdicion.set(false);
    this.tareaEditandoId = null;
    this.formulario = this.tareasService.crearNuevaTareaVacia();
    this.modalAbierto.set(true);
  }

  abrirModalEditar(tarea: Tarea) {
    this.modoEdicion.set(true);
    this.tareaEditandoId = tarea.id;
    this.formulario = {
      titulo: tarea.titulo,
      fecha: tarea.fecha.split('T')[0],
      desc: tarea.desc,
    };
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.guardando.set(false);
    this.modoEdicion.set(false);
    this.tareaEditandoId = null;
    this.formulario = this.tareasService.crearNuevaTareaVacia();
  }

  cerrarModalPorFondo(event: Event) {
    if (event.target === event.currentTarget) {
      this.cerrarModal();
    }
  }

  guardar() {
    if (!this.usuario || !this.sesionActiva() || this.guardando()) {
      return;
    }

    const payload = this.normalizarFormulario();
    if (!payload.titulo || !payload.desc || !payload.fecha) {
      this.tipoMensaje.set('error');
      this.mensajeEstado.set('Completa titulo, descripcion y fecha antes de guardar.');
      return;
    }

    this.guardando.set(true);
    const estabaEditando = this.modoEdicion();
    const operacion = this.modoEdicion() && this.tareaEditandoId
      ? this.tareasService.actualizarTarea(this.tareaEditandoId, payload)
      : this.tareasService.crearTarea(this.usuario.id, payload);

    operacion.subscribe({
      next: (response) => {
        console.log('✅ Tarea guardada exitosamente:', response);
        this.cerrarModal();
        this.tipoMensaje.set('ok');
        this.mensajeEstado.set(estabaEditando ? 'Tarea actualizada.' : 'Tarea creada.');
        this.cargarTareas(this.usuario!.id);
      },
      error: (error) => {
        console.error('❌ Error al guardar tarea:', error);
        console.error('   Status:', error.status);
        console.error('   Message:', error.message);
        console.error('   Body:', error.error);
        this.guardando.set(false);
        this.tipoMensaje.set('error');
        this.mensajeEstado.set(
          error.error?.mensaje ?? error.error?.error ?? error.error?.message ?? 'No se pudo guardar la tarea.',
        );
      },
    });
  }

  toggleEstado(tarea: Tarea) {
    if (!this.usuario || !this.sesionActiva()) {
      return;
    }

    const nuevoEstado = !tarea.completada;
    this.tareasService.toggleCompletada(tarea.id, nuevoEstado).subscribe({
      next: () => {
        this.tipoMensaje.set('ok');
        this.mensajeEstado.set(nuevoEstado ? 'Tarea completada.' : 'Tarea reabierta.');
        this.cargarTareas(this.usuario!.id);
      },
      error: (error) => {
        this.tipoMensaje.set('error');
        this.mensajeEstado.set(error.error?.mensaje ?? 'No se pudo cambiar el estado de la tarea.');
      },
    });
  }

  abrirDetalle(tarea: Tarea, event: Event) {
    // Open task detail modal on single click on the card
    this.tareaDetalle.set(tarea);
    this.detalleAbierto.set(true);
  }

  cerrarDetalle(event: Event) {
    if (event.target === event.currentTarget) {
      this.detalleAbierto.set(false);
      this.tareaDetalle.set(null);
    }
  }

  cerrarDetalleSolo() {
    this.detalleAbierto.set(false);
    this.tareaDetalle.set(null);
  }

  cerrarDetalleYEditar() {
    const tarea = this.tareaDetalle();
    this.detalleAbierto.set(false);
    this.tareaDetalle.set(null);
    if (tarea) {
      this.abrirModalEditar(tarea);
    }
  }

  toggleEstadoDesdeDetalle() {
    const tarea = this.tareaDetalle();
    if (tarea) {
      this.detalleAbierto.set(false);
      this.tareaDetalle.set(null);
      this.toggleEstado(tarea);
    }
  }

  eliminar(tareaId: string) {
    if (!this.usuario || !this.sesionActiva()) {
      return;
    }

    this.tareasService.eliminarTarea(tareaId).subscribe({
      next: () => {
        this.tipoMensaje.set('ok');
        this.mensajeEstado.set('Tarea eliminada.');
        this.cargarTareas(this.usuario!.id);
      },
      error: (error) => {
        this.tipoMensaje.set('error');
        this.mensajeEstado.set(error.error?.mensaje ?? 'No se pudo eliminar la tarea.');
      },
    });
  }

  private cargarTareas(usuarioId: number) {
    if (!isPlatformBrowser(this.platformId)) {
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    console.log('📥 Cargando tareas para usuario:', usuarioId);
    this.tareasService.getTareasPorUsuario(usuarioId).subscribe({
      next: (tareas) => {
        console.log('✅ Tareas cargadas:', tareas);
        this.tareas.set(tareas);
        this.cargando.set(false);
      },
      error: (error) => {
        console.error('❌ Error cargando tareas:', error);
        this.tareas.set([]);
        this.cargando.set(false);
        this.tipoMensaje.set('error');
        this.mensajeEstado.set(error.error?.mensaje ?? error.error?.error ?? 'No se pudieron cargar las tareas.');
      },
    });
  }

  private normalizarFormulario(): GuardarTareaPayload {
    return {
      titulo: this.formulario.titulo.trim(),
      fecha: this.formulario.fecha,
      desc: this.formulario.desc.trim(),
    };
  }

  private limpiarMensaje() {
    this.mensajeEstado.set('');
    this.tipoMensaje.set('ok');
  }
}
