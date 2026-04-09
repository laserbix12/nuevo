import { Routes } from '@angular/router';
import { Home } from './home';
import { UsuarioDetalle } from './usuario/usuario';
import { AcercaComponent } from './acerca.component';
import { InicioComponent } from './inicio.component';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    children: [
      { path: '', component: InicioComponent },
      { path: 'usuario/:id', component: UsuarioDetalle },
      {
        path: 'acerca-de',
        component: AcercaComponent
      },
    ]
  },
];
