import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="no-tasks">
      <p>Haz clic en el logo para volver aqui y selecciona un usuario para ver sus tareas.</p>
    </div>
  `,
  styleUrls: ['./app.component.css'],
})
export class InicioComponent {}
