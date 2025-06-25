import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, of } from 'rxjs';

import { ListComponent } from './list.component';
import {PlatosService} from "../../services/platos.service";
import {Plato} from "../../entities/plato.interface";


describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let mockPlatosService: jasmine.SpyObj<PlatosService>;

  const mockPlatos: Plato[] = [
    {
      "id": "1",
      "usuarioId": "1",
      "nombre": "Lomo saltado",
      "insumos": [
        {
          "nombre": "Papa amarilla",
          "cantidadPorPorcion": 100,
          "unidad": "g"
        },
        {
          "nombre": "Lomo",
          "cantidadPorPorcion": 200,
          "unidad": "g"
        }
      ]
    },
    {
      "id": "c810",
      "usuarioId": "1",
      "nombre": "Arroz con pollo",
      "insumos": [
        {
          "nombre": "Arroz",
          "cantidadPorPorcion": 120,
          "unidad": "g"
        },
        {
          "nombre": "Pollo",
          "cantidadPorPorcion": 150,
          "unidad": "g"
        }
      ]
    }
  ];

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('PlatosService', [
      'getPlatos',
      'getPlatoById',
      'addPlato',
      'updatePlato',
      'existePlatoConNombre'
    ], {
      'platos$': new BehaviorSubject(mockPlatos)
    });

    await TestBed.configureTestingModule({
      imports: [ListComponent, ReactiveFormsModule],
      providers: [
        { provide: PlatosService, useValue: spy }
      ]
    })
        .compileComponents();

    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    mockPlatosService = TestBed.inject(PlatosService) as jasmine.SpyObj<PlatosService>;


    mockPlatosService.getPlatos.and.returnValue(of(mockPlatos));
    mockPlatosService.existePlatoConNombre.and.returnValue(of([]));

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load platos on init', () => {
    expect(component.platos).toEqual(mockPlatos);
    expect(mockPlatosService.getPlatos).toHaveBeenCalled();
  });

  it('should show form when clicking add button', () => {
    component.mostrarFormularioAnadir();
    expect(component.mostrarFormulario).toBeTruthy();
    expect(component.modoEdicion).toBeFalsy();
    expect(component.insumosFormArray.length).toBe(1);
  });

  it('should populate form when editing plato', () => {
    const platoToEdit = mockPlatos[0];
    component.editarPlato(platoToEdit);

    expect(component.mostrarFormulario).toBeTruthy();
    expect(component.modoEdicion).toBeTruthy();
    expect(component.platoEditando).toEqual(platoToEdit);
    expect(component.platoForm.get('nombre')?.value).toBe(platoToEdit.nombre);
    expect(component.insumosFormArray.length).toBe(platoToEdit.insumos.length);
  });

  it('should add insumo to form array', () => {
    component.mostrarFormularioAnadir();
    const initialLength = component.insumosFormArray.length;

    component.agregarInsumo();

    expect(component.insumosFormArray.length).toBe(initialLength + 1);
  });

  it('should remove insumo from form array', () => {
    component.mostrarFormularioAnadir();
    component.agregarInsumo();
    const initialLength = component.insumosFormArray.length;

    component.eliminarInsumo(0);

    expect(component.insumosFormArray.length).toBe(initialLength - 1);
  });

  it('should validate form correctly', () => {
    component.mostrarFormularioAnadir();


    expect(component.esFormularioValido()).toBeFalsy();


    component.platoForm.patchValue({
      nombre: 'Test Plato',
      precioVenta: 20.00
    });


    const firstInsumo = component.insumosFormArray.at(0);
    firstInsumo.patchValue({
      nombre: 'Test Insumo',
      cantidadPorPorcion: 0.1,
      unidad: 'kg',
      costoPorUnidad: 5.00
    });

    expect(component.esFormularioValido()).toBeTruthy();
  });

  it('should save new plato', () => {
    component.mostrarFormularioAnadir();

    component.platoForm.patchValue({
      nombre: 'Nuevo Plato',
      precioVenta: 30.00
    });

    const firstInsumo = component.insumosFormArray.at(0);
    firstInsumo.patchValue({
      nombre: 'Insumo Test',
      cantidadPorPorcion: 0.2,
      unidad: 'kg',
      costoPorUnidad: 8.00
    });

    component.guardar();

    expect(mockPlatosService.addPlato).toHaveBeenCalled();
    expect(component.mostrarFormulario).toBeFalsy();
  });

  it('should update existing plato', () => {
    const platoToEdit = mockPlatos[0];
    component.editarPlato(platoToEdit);


    component.platoForm.patchValue({
      nombre: 'Plato Modificado'
    });

    component.guardar();

    expect(mockPlatosService.updatePlato).toHaveBeenCalled();
    expect(component.mostrarFormulario).toBeFalsy();
  });



  it('should cancel form and reset state', () => {
    component.mostrarFormularioAnadir();
    component.platoForm.patchValue({ nombre: 'Test' });

    component.cancelar();

    expect(component.mostrarFormulario).toBeFalsy();
    expect(component.modoEdicion).toBeFalsy();
    expect(component.platoEditando).toBeNull();
    expect(component.platoForm.get('nombre')?.value).toBe('');
  });

  it('should show success message after saving', () => {
    component.mostrarMensajeExito('Test message');

    expect(component.mensaje).toBe('Test message');
    expect(component.tipoMensaje).toBe('success');
    expect(component.mostrarMensaje).toBeTruthy();
  });

  it('should show error message', () => {
    component.mostrarMensajeError('Error message');

    expect(component.mensaje).toBe('Error message');
    expect(component.tipoMensaje).toBe('error');
    expect(component.mostrarMensaje).toBeTruthy();
  });

  it('should delete a plato', () => {
    const platoIdToDelete = mockPlatos[0].id;

    if (platoIdToDelete !== undefined) {
      spyOn(window, 'confirm').and.returnValue(true);
      mockPlatosService.deletePlato.and.returnValue(of(undefined));

      component.eliminarPlato(platoIdToDelete);

      expect(mockPlatosService.deletePlato).toHaveBeenCalledWith(platoIdToDelete);
    }
  });

  it('should not save form with no insumos', () => {
    component.mostrarFormularioAnadir();

    component.eliminarInsumo(0);

    component.platoForm.patchValue({
      nombre: 'Test Plato',
    });

    component.guardar();

    expect(mockPlatosService.addPlato).not.toHaveBeenCalled();
    expect(component.tipoMensaje).toBe('error');
  });
});