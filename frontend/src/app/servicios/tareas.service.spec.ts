import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { TareasService } from './tareas.service';

describe('TareasService', () => {
  let service: TareasService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TareasService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deberia solicitar las tareas del usuario al backend', () => {
    let tareasResultado = [];

    service.getTareasPorUsuario(2).subscribe((tareas) => {
      tareasResultado = tareas;
    });

    const req = httpMock.expectOne('http://localhost:3000/api/tareas/usuario/2');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'abc123',
        titulo: 'Preparar entrega',
        resumen: 'Revisar pendientes finales',
        expira: '2026-04-14',
        idUsuario: '2',
        completada: 0,
      },
    ]);

    expect(tareasResultado).toEqual([
      {
        id: 'abc123',
        titulo: 'Preparar entrega',
        desc: 'Revisar pendientes finales',
        fecha: '2026-04-14',
        completada: false,
      },
    ]);
  });

  it('deberia crear una tarea valida en el backend', () => {
    service.crearTarea(2, {
      titulo: 'Preparar entrega',
      fecha: '2026-04-14',
      desc: 'Revisar pendientes finales',
    }).subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/tareas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.titulo).toBe('Preparar entrega');
    expect(req.request.body.resumen).toBe('Revisar pendientes finales');
    expect(req.request.body.idUsuario).toBe(2);
    req.flush({ mensaje: 'ok' });
  });

  it('deberia eliminar una tarea en el backend', () => {
    service.eliminarTarea('abc123').subscribe();

    const req = httpMock.expectOne('http://localhost:3000/api/tareas/abc123');
    expect(req.request.method).toBe('DELETE');
    req.flush({ mensaje: 'ok' });
  });
});
