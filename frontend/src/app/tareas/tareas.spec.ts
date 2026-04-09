import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { Tareas } from './tareas';

describe('Tareas', () => {
  let component: Tareas;
  let fixture: ComponentFixture<Tareas>;
  const paramMapSubject = new BehaviorSubject(convertToParamMap({ id: '1' }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tareas],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Tareas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deberia cargar el nombre y las tareas del usuario desde la ruta', () => {
    fixture.detectChanges();

    expect(component.nombre).toContain('Antonia');
    expect(component.idUsuario).toBe(1);
  });

  it('deberia abrir el formulario de nueva tarea', () => {
    component.alIniciarNuevaTarea();

    expect(component.estaAgregandoTareaNueva).toBe(true);
    expect(component.nuevaTarea.titulo).toBe('');
  });
});
