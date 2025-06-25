import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {Insumo, Plato} from "../../entities/plato.interface";
import {PlatosService} from "../../services/platos.service";
import {AuthService} from "../../../auth/services/auth.service";

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './list.component.html',
  styleUrl: './list.component.css'
})
export class ListComponent implements OnInit, OnDestroy {
  platos: Plato[] = [];
  mostrarFormulario = false;
  modoEdicion = false;
  platoEditando: Plato | null = null;
  platoForm: FormGroup;
  mensaje = '';
  tipoMensaje: 'success' | 'error' = 'success';
  mostrarMensaje = false;

  unidades = ['kg', 'g', 'unid'];
  opcionesCantidad = [
    { valor: 0.125, texto: '1/8' },
    { valor: 0.25, texto: '1/4' },
    { valor: 0.5, texto: '1/2' },
    { valor: 0.75, texto: '3/4' },
    { valor: 1, texto: '1' },
    { valor: 'manual', texto: 'Especificar cantidad' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
      private platosService: PlatosService,
      private authService: AuthService,
      private fb: FormBuilder
  ) {
    this.platoForm = this.createForm();
  }

  ngOnInit(): void {
    this.refrescarLista();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombre: ['', [Validators.required]],
      insumos: this.fb.array([])
    });
  }

  get insumosFormArray(): FormArray {
    return this.platoForm.get('insumos') as FormArray;
  }

  createInsumoForm(insumo?: Insumo): FormGroup {
    const form = this.fb.group({
      nombre: [insumo?.nombre || '', [Validators.required]],
      cantidadPorPorcion: [''],
      cantidadManual: [''],
      unidad: [insumo ? insumo.unidad.toLowerCase() : 'kg', [Validators.required]],
      pesoAprox: ['']
    });

    if (insumo) {
      this.setValoresIniciales(form, insumo);
    } else {
      form.patchValue({
        cantidadPorPorcion: 'manual'
      });
      this.setValidatorsBasedOnUnit(form, 'kg');
    }

    return form;
  }

  private setValoresIniciales(form: FormGroup, insumo: Insumo): void {
    const unidadNormalizada = insumo.unidad.toLowerCase();
    form.get('unidad')?.setValue(unidadNormalizada);

    if (unidadNormalizada === 'unid') {
      const cantidadOriginalUnidades = insumo.cantidadPorPorcion / (insumo.pesoAprox || 1);
      const cantidadOption = this.getCantidadOption(cantidadOriginalUnidades);

      form.patchValue({
        cantidadPorPorcion: cantidadOption,
        cantidadManual: cantidadOption === 'manual' ? cantidadOriginalUnidades : '',
        pesoAprox: (insumo.pesoAprox || 0) * 1000
      });

      this.setValidatorsBasedOnUnit(form, 'unid');

    } else if (unidadNormalizada === 'g') {
      const gramosParaMostrar = insumo.cantidadPorPorcion * 1000;

      form.patchValue({
        cantidadPorPorcion: 'manual',
        cantidadManual: gramosParaMostrar
      });
      this.setValidatorsBasedOnUnit(form, 'g');

    } else {
      form.patchValue({
        cantidadPorPorcion: 'manual',
        cantidadManual: insumo.cantidadPorPorcion
      });

      this.setValidatorsBasedOnUnit(form, 'kg');
    }
  }

  private setValidatorsBasedOnUnit(form: FormGroup, unidad: string): void {
    const cantidadPorPorcionControl = form.get('cantidadPorPorcion');
    const cantidadManualControl = form.get('cantidadManual');
    const pesoAproxControl = form.get('pesoAprox');

    cantidadPorPorcionControl?.clearValidators();
    cantidadManualControl?.clearValidators();
    pesoAproxControl?.clearValidators();

    if (unidad === 'unid') {
      cantidadPorPorcionControl?.setValidators([Validators.required]);
      pesoAproxControl?.setValidators([Validators.required, Validators.min(0.01)]);

      const cantidadValue = cantidadPorPorcionControl?.value;
      if (cantidadValue === 'manual') {
        cantidadManualControl?.setValidators([Validators.required, Validators.min(0.01)]);
      }
    } else {
      cantidadManualControl?.setValidators([Validators.required, Validators.min(0.01)]);
    }

    cantidadPorPorcionControl?.updateValueAndValidity();
    cantidadManualControl?.updateValueAndValidity();
    pesoAproxControl?.updateValueAndValidity();
  }

  private getCantidadOption(valor: number): string | number {
    const opcion = this.opcionesCantidad.find(op => typeof op.valor === 'number' && Math.abs(op.valor - valor) < 0.001);
    return opcion ? opcion.valor : 'manual';
  }

  mostrarFormularioAnadir(): void {
    this.mostrarFormulario = true;
    this.modoEdicion = false;
    this.platoEditando = null;
    this.platoForm = this.createForm();
    this.agregarInsumo();
  }

  editarPlato(plato: Plato): void {
    this.mostrarFormulario = true;
    this.modoEdicion = true;
    this.platoEditando = plato;
    this.platoForm = this.createForm();
    this.platoForm.patchValue({
      nombre: plato.nombre,
    });
    plato.insumos.forEach(insumo => {
      this.insumosFormArray.push(this.createInsumoForm(insumo));
    });
  }

  agregarInsumo(): void {
    this.insumosFormArray.push(this.createInsumoForm());
  }

  eliminarInsumo(index: number): void {
    this.insumosFormArray.removeAt(index);
  }

  cancelar(): void {
    this.mostrarFormulario = false;
    this.modoEdicion = false;
    this.platoEditando = null;
    this.platoForm = this.createForm();
    this.ocultarMensaje();
  }

  refrescarLista(): void {
    this.platosService.getPlatos()
        .pipe(takeUntil(this.destroy$))
        .subscribe(platos => {
          this.platos = platos;
        });
  }

  onUnidadChange(index: number): void {
    const insumoControl = this.insumosFormArray.at(index) as FormGroup;
    const unidad = insumoControl.get('unidad')?.value;

    insumoControl.patchValue({
      cantidadPorPorcion: '',
      cantidadManual: '',
      pesoAprox: ''
    });

    if (unidad === 'unid') {
      insumoControl.get('cantidadPorPorcion')?.enable();
      insumoControl.patchValue({ cantidadPorPorcion: 1 });
      this.setValidatorsBasedOnUnit(insumoControl, 'unid');
    } else {
      insumoControl.get('cantidadPorPorcion')?.disable();
      insumoControl.patchValue({
        cantidadPorPorcion: 'manual'
      });
      this.setValidatorsBasedOnUnit(insumoControl, unidad);
    }
  }

  onCantidadChange(index: number): void {
    const insumoControl = this.insumosFormArray.at(index);
    const cantidad = insumoControl.get('cantidadPorPorcion')?.value;

    if (cantidad === 'manual') {
      insumoControl.get('cantidadManual')?.setValidators([Validators.required, Validators.min(0.01)]);
      insumoControl.patchValue({ cantidadManual: '' });
    } else {
      insumoControl.get('cantidadManual')?.clearValidators();
      insumoControl.get('cantidadManual')?.setValue('');
    }
    insumoControl.get('cantidadManual')?.updateValueAndValidity();
  }


  deberMostrarSelectorCantidad(index: number): boolean {
    const insumoControl = this.insumosFormArray.at(index);
    return insumoControl.get('unidad')?.value === 'unid';
  }

  private convertirAKilogramos(cantidad: number, unidad: string, pesoAprox?: number): number {
    switch (unidad) {
      case 'g':
        return cantidad / 1000;
      case 'unid':
        return cantidad * (pesoAprox || 0);
      case 'kg':
      default:
        return cantidad;
    }
  }

  guardar(): void {
    if (this.platoForm.valid && this.insumosFormArray.length > 0) {
      const formValue = this.platoForm.value;
      const excludeId = this.modoEdicion ? this.platoEditando?.id : undefined;

      this.platosService.existePlatoConNombre(formValue.nombre, excludeId).subscribe(existe => {

        if (existe) {
          this.mostrarMensajeError('Ya existe un plato con ese nombre.');
          return;
        }


        const platoBase = {
          nombre: formValue.nombre,
          insumos: formValue.insumos.map((insumo: any) => {
            let cantidadReal: number;

            if (insumo.unidad === 'unid') {
              cantidadReal = insumo.cantidadPorPorcion === 'manual'
                  ? Number(insumo.cantidadManual)
                  : Number(insumo.cantidadPorPorcion);
            } else {
              cantidadReal = Number(insumo.cantidadManual);
            }

            const insumoFinal: Insumo = {
              nombre: insumo.nombre,
              cantidadPorPorcion: this.convertirAKilogramos(
                  cantidadReal,
                  insumo.unidad,
                  insumo.unidad === 'unid' ? Number(insumo.pesoAprox) / 1000 : undefined
              ),
              unidad: insumo.unidad
            };

            if (insumo.unidad === 'unid') {
              insumoFinal.pesoAprox = Number(insumo.pesoAprox) / 1000;
            }

            return insumoFinal;
          })
        };

        if (this.modoEdicion && this.platoEditando?.id !== undefined) {
          const platoEditado: Plato = {
            id: this.platoEditando.id,
            ...platoBase,
            usuarioId: this.platoEditando.usuarioId
          };

          this.platosService.updatePlato(platoEditado).subscribe(() => {
            this.refrescarLista();
            this.mostrarMensajeExito('Cambios guardados con éxito.');
            this.cancelar();
          });
        } else {
          this.platosService.addPlato(platoBase).subscribe(() => {
            this.refrescarLista();
            this.mostrarMensajeExito('Plato registrado correctamente.');
            this.cancelar();
          });
        }
      });
    } else {
      this.mostrarMensajeError('Por favor, complete todos los campos requeridos y añada al menos un insumo.');
    }
  }

  eliminarPlato(id?: string): void {
    if (id === undefined) return;
    if (confirm('¿Estás seguro de que deseas eliminar este plato?')) {
      this.platosService.deletePlato(id).subscribe(() => {
        this.platos = this.platos.filter(p => p.id !== id);
        this.mostrarMensajeExito('Plato eliminado correctamente.');
      }, () => {
        this.mostrarMensajeError('Hubo un error al eliminar el plato.');
      });
    }
  }

  mostrarMensajeExito(mensaje: string): void {
    this.mensaje = mensaje;
    this.tipoMensaje = 'success';
    this.mostrarMensaje = true;
    setTimeout(() => this.ocultarMensaje(), 4000);
  }

  mostrarMensajeError(mensaje: string): void {
    this.mensaje = mensaje;
    this.tipoMensaje = 'error';
    this.mostrarMensaje = true;
    setTimeout(() => this.ocultarMensaje(), 4000);
  }

  ocultarMensaje(): void {
    this.mostrarMensaje = false;
  }

  esFormularioValido(): boolean {
    return this.platoForm.valid && this.insumosFormArray.length > 0 &&
        this.insumosFormArray.controls.every(control => control.valid);
  }



  // Metodo auxiliar para mostrar la cantidad en el frontend
  mostrarCantidad(insumo: Insumo): string {
    if (insumo.unidad === 'unid') {
      const cantidad = insumo.cantidadPorPorcion / (insumo.pesoAprox || 1);
      return `${cantidad} ${insumo.unidad}`;
    } else if (insumo.unidad === 'g') {
      return `${insumo.cantidadPorPorcion * 1000} g`;
    } else {
      return `${insumo.cantidadPorPorcion} kg`;
    }
  }
}