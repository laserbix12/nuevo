import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
                ? 'Modo administrador activo: puedes agregar, editar, completar y eliminar tareas.'
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
              <article class="task-card" [class.task-card-done]="tarea.completada">
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
                  <div class="btn-footer">
                    <button type="button" class="btn-edit" (click)="abrirModalEditar(tarea)">Editar</button>
                    <button
                      type="button"
                      class="btn-edit"
                      (click)="completar(tarea.id)"
                      [disabled]="tarea.completada"
                    >
                      Completar
                    </button>
                    <button type="button" class="btn-done" (click)="eliminar(tarea.id)">Eliminar</button>
                  </div>
                }
              </article>
            }
          </div>
        }
      </section>

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

  tareaEditandoId: string | null = null;
  formulario: GuardarTareaPayload = this.tareasService.crearNuevaTareaVacia();

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.usuario = this.usuarioService.getUsuario(id);
      this.cerrarModal();
      this.limpiarMensaje();

      if (!this.usuario) {
        this.tareas.set([]);
        this.cargando.set(false);
        return;
      }

      this.cargarTareas(this.usuario.id);
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
        this.mensajeEstado.set(error.error?.error ?? error.error?.message ?? 'No se pudo guardar la tarea.');
      },
    });
  }

  completar(tareaId: string) {
    if (!this.usuario || !this.sesionActiva()) {
      return;
    }

    this.tareasService.completarTarea(tareaId).subscribe({
      next: () => {
        this.tipoMensaje.set('ok');
        this.mensajeEstado.set('Tarea completada.');
        this.cargarTareas(this.usuario!.id);
      },
      error: (error) => {
        this.tipoMensaje.set('error');
        this.mensajeEstado.set(error.error?.mensaje ?? 'No se pudo completar la tarea.');
      },
    });
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
        this.mensajeEstado.set(error.error?.error ?? 'No se pudieron cargar las tareas.');
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
