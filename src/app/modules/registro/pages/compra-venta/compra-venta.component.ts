import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ValidatorFn, AbstractControl, ValidationErrors, AsyncValidatorFn
} from '@angular/forms';
import {Venta} from "../../entities/venta.interface";
import {Plato} from "../../../platos/entities/plato.interface";
import {Compra} from "../../entities/compra.interface";
import {VentasService} from "../../services/ventas.service";
import {ComprasService} from "../../services/compras.service";
import {PlatosService} from "../../../platos/services/platos.service";
import {AuthService} from "../../../auth/services/auth.service";
import {switchMap} from "rxjs/operators";
import {Observable, of} from "rxjs";



export function insumoEnListaValidator(listaValida: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {

    const valorActual = control.value;

    if (!valorActual || listaValida.length === 0) {
      return null;
    }
    const esValido = listaValida.includes(valorActual);

    return esValido ? null : { insumoNoEnLista: true };
  };
}

export function minLengthArray(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control instanceof FormArray && control.length < min) {
      return { minLengthArray: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-compra-venta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './compra-venta.component.html',
  styleUrl: './compra-venta.component.css'
})

export class CompraVentaComponent implements OnInit {
  // Variables para Ventas
  fechaSeleccionadaVentas: string = '';
  ventasDelDia: Venta[] = [];
  platos: Plato[] = [];
  platosDisponibles: Plato[] = [];
  mostrarFormularioVenta: boolean = false;
  editandoVenta: boolean = false;

  idVentaEditando: string | null = null;

  // Variables para Compras
  nombresInsumosDisponibles: string[] = [];
  filteredInsumos: string[] = [];
  activeInsumoIndex: number | null = null;
  mesSeleccionado: number;
  anioSeleccionado: number;
  comprasDelMes: Compra[] = [];
  fechasExpandidas: Set<string> = new Set();
  mostrarFormularioCompra: boolean = false;
  editandoCompra: boolean = false;
  unidades = ['kg', 'g', 'unid'];


  opcionesCantidad = [
    { valor: 0.125, texto: '1/8' },
    { valor: 0.25, texto: '1/4' },
    { valor: 0.5, texto: '1/2' },
    { valor: 0.75, texto: '3/4' },
    { valor: 1, texto: '1' },
    { valor: 'manual', texto: 'Especificar cantidad' }
  ];



  compraForm!: FormGroup;

  mensajeVentas: string = '';
  mensajeCompras: string = '';
  cargandoVentas: boolean = false;
  cargandoCompras: boolean = false;
  mensajeFormularioCompra: string = '';

  ventaForm!: FormGroup;

  constructor(
      private ventasService: VentasService,
      private comprasService: ComprasService,
      private platosService: PlatosService,
      private authService: AuthService,


      private fb: FormBuilder


  ) {
    this.compraForm = this.fb.group({});
    const hoy = new Date();
    this.fechaSeleccionadaVentas = this.formatearFechaInput(hoy);
    this.mesSeleccionado = hoy.getMonth() + 1;
    this.anioSeleccionado = hoy.getFullYear();
    this.ventaForm = this.fb.group({
      platoId: [null, Validators.required],
      cantidad: [null, [Validators.required, Validators.min(1)]]
    });

    console.log('Inicialización:', {
      fechaVentas: this.fechaSeleccionadaVentas,
      mes: this.mesSeleccionado,
      año: this.anioSeleccionado
    });
  }



  ngOnInit(): void {
    this.compraForm = this.fb.group({});

    this.cargarDatosIniciales();
    this.cargarComprasDelMes();
  }

  // MÉTODOS PARA VENTAS
  cargarDatosIniciales(): void {
    this.cargandoVentas = true; // Inicia el spinner
    this.mensajeVentas = '';

    // 1. Primero, siempre carga los platos
    this.platosService.getPlatos().pipe(
        switchMap(platos => {
          // 2. Una vez que tenemos los platos, los guardamos
          this.platos = platos;
          const todosLosInsumos = platos.flatMap(plato => plato.insumos.map(insumo => insumo.nombre));
          this.nombresInsumosDisponibles = [...new Set(todosLosInsumos)].sort();
          this.actualizarValidadoresDeInsumos();

          // 3. Si hay platos, ahora SÍ pedimos las ventas del día.
          //    Si no hay platos, devolvemos un array vacío de ventas para evitar una llamada innecesaria.
          if (platos.length > 0) {
            return this.ventasService.getVentasByFecha(this.fechaSeleccionadaVentas);
          } else {
            return of([]); // 'of' crea un Observable que emite un valor y se completa.
          }
        })
    ).subscribe({
      next: (ventas) => {
        // 4. Este bloque se ejecuta DESPUÉS de tener los platos y las ventas
        this.ventasDelDia = ventas.map(venta => {
          // AHORA, this.platos SÍ tiene datos, por lo que la búsqueda funcionará.
          const plato = this.platos.find(p => p.id === venta.platoId);
          return { ...venta, plato: plato?.nombre || 'Plato no encontrado' };
        });

        this.actualizarPlatosDisponibles();
        if (this.ventasDelDia.length === 0) {
          this.mensajeVentas = this.platos.length === 0
              ? 'No hay platos registrados. Añade uno para poder registrar ventas.'
              : 'No se han registrado ventas aún para esta fecha';
        }

        this.cargandoVentas = false; // Detiene el spinner
      },
      error: (error) => {
        console.error('Error al cargar datos iniciales:', error);
        this.mensajeVentas = 'Error al cargar los datos de ventas';
        this.cargandoVentas = false;
      }
    });
  }






  onFechaVentasChange(): void {
    this.cargarVentasDelDia();
    this.cerrarFormularioVenta();
  }

  cargarVentasDelDia(): void {
    if (!this.fechaSeleccionadaVentas) return;

    this.cargandoVentas = true;
    this.ventasService.getVentasByFecha(this.fechaSeleccionadaVentas).subscribe({
      next: (ventas) => {
        // La lógica de mapeo ahora está aquí
        this.ventasDelDia = ventas.map(venta => {
          const plato = this.platos.find(p => p.id === venta.platoId);
          return { ...venta, plato: plato?.nombre || 'Plato no encontrado' };
        });
        this.actualizarPlatosDisponibles();
        this.mensajeVentas = this.ventasDelDia.length === 0 ? 'No se han registrado ventas aún para esta fecha' : '';
        this.cargandoVentas = false;
      },
      error: (error) => {
        console.error('Error al cargar ventas:', error);
        this.mensajeVentas = 'Error al cargar las ventas';
        this.cargandoVentas = false;
      }
    });
  }

  actualizarPlatosDisponibles(): void {
    const platosVendidos = this.ventasDelDia.map(v => v.platoId);
    this.platosDisponibles = this.platos.filter(plato =>
        !platosVendidos.includes(plato.id)
    );
  }

  abrirFormularioVenta(): void {
    if (this.platos.length === 0) {
      this.mensajeVentas = 'No hay platos registrados aún.';
      return;
    }

    this.mostrarFormularioVenta = true;
    this.editandoVenta = false;
    this.idVentaEditando = null;


    this.ventaForm.reset({
      platoId: null,
      cantidad: 1
    });
  }

  editarVenta(venta: Venta): void {
    this.mostrarFormularioVenta = true;
    this.editandoVenta = true;
    this.idVentaEditando = venta.id;


    this.ventaForm.patchValue({
      platoId: venta.platoId,
      cantidad: venta.cantidad
    });
  }

  cerrarFormularioVenta(): void {
    this.mostrarFormularioVenta = false;
  }

  guardarVenta(): void {
    // 1. Marcar todos los campos para mostrar errores
    this.ventaForm.markAllAsTouched();

    // 2. Si el formulario es inválido, no hacer nada más. Los errores se muestran en el HTML.
    if (this.ventaForm.invalid) {
      return;
    }

    const formValue = this.ventaForm.value;
    const ventaPayload = {
      fecha: this.fechaSeleccionadaVentas,
      platoId: formValue.platoId,
      cantidad: formValue.cantidad
    };

    if (this.editandoVenta && this.idVentaEditando) {
      // ACTUALIZAR VENTA
      const ventaAActualizar: Venta = {
        id: this.idVentaEditando,
        usuarioId: '', // El backend lo ignora
        ...ventaPayload
      };
      this.ventasService.updateVenta(ventaAActualizar).subscribe({
        next: () => {
          this.cargarVentasDelDia();
          this.cerrarFormularioVenta();
          this.mensajeVentas = 'Venta actualizada correctamente';
        },
        error: (error) => {
          console.error('Error al actualizar venta:', error);
          this.mensajeVentas = 'Error al actualizar la venta';
        }
      });

    } else {
      this.ventasService.addVenta(ventaPayload).subscribe({
        next: () => {
          this.cargarVentasDelDia();
          this.cerrarFormularioVenta();
          this.mensajeVentas = 'Venta registrada correctamente';
        },
        error: (error) => {
          console.error('Error al registrar venta:', error);
          this.mensajeVentas = 'Error al registrar la venta';
        }
      });
    }
  }



  eliminarVenta(venta: Venta): void {
    if (confirm(`¿Está seguro de eliminar la venta de ${venta.plato}?`)) {
      this.ventasService.deleteVenta(venta.id).subscribe({
        next: () => {
          this.cargarVentasDelDia();
          this.mensajeVentas = 'Venta eliminada correctamente';
        },
        error: (error) => {
          console.error('Error al eliminar venta:', error);
          this.mensajeVentas = 'Error al eliminar la venta';
        }
      });
    }
  }

  // MÉTODOS PARA COMPRAS
  onMesComprasChange(): void {
    console.log('=== CAMBIO MES/AÑO ===');
    console.log('Mes antes de conversión:', this.mesSeleccionado, 'tipo:', typeof this.mesSeleccionado);
    console.log('Año antes de conversión:', this.anioSeleccionado, 'tipo:', typeof this.anioSeleccionado);

    this.mesSeleccionado = Number(this.mesSeleccionado);
    this.anioSeleccionado = Number(this.anioSeleccionado);

    console.log('Mes después de conversión:', this.mesSeleccionado, 'tipo:', typeof this.mesSeleccionado);
    console.log('Año después de conversión:', this.anioSeleccionado, 'tipo:', typeof this.anioSeleccionado);

    this.cargarComprasDelMes();
    this.cerrarFormularioCompra();
    this.fechasExpandidas.clear();
  }

  onMesChange(): void {
    console.log('Cambio de mes a:', this.mesSeleccionado);
    this.onMesComprasChange();
  }

  onAnioChange(): void {
    console.log('Cambio de año a:', this.anioSeleccionado);
    this.onMesComprasChange();
  }


  cargarComprasDelMes(): void {
    this.cargandoCompras = true;
    this.mensajeCompras = '';

    this.comprasService.getComprasByMonth(this.anioSeleccionado, this.mesSeleccionado).subscribe({
      next: (comprasDelMes) => {
        console.log('=== DATOS RECIBIDOS DEL BACKEND ===');
        console.log('Total compras filtradas por el backend:', comprasDelMes.length);

        this.comprasDelMes = comprasDelMes.sort((a, b) => b.fecha.localeCompare(a.fecha));

        if (this.comprasDelMes.length === 0) {
          this.mensajeCompras = `No hay compras registradas para ${this.obtenerNombreMes(this.mesSeleccionado)} ${this.anioSeleccionado}`;
        }

        this.cargandoCompras = false;
      },
      error: (error) => {
        console.error('Error al cargar compras:', error);
        this.mensajeCompras = 'Error al cargar las compras';
        this.cargandoCompras = false;
      }
    });
  }

  toggleFechaExpansion(fecha: string): void {
    if (this.fechasExpandidas.has(fecha)) {
      this.fechasExpandidas.delete(fecha);
    } else {
      this.fechasExpandidas.add(fecha);
    }
  }

  esFechaExpandida(fecha: string): boolean {
    return this.fechasExpandidas.has(fecha);
  }

  obtenerComprasPorFecha(fecha: string): Compra[] {
    return this.comprasDelMes.filter(compra => compra.fecha === fecha);
  }

  obtenerFechasUnicas(): string[] {
    const fechas = [...new Set(this.comprasDelMes.map(compra => compra.fecha))];
    return fechas.sort((a, b) => {
      const fechaA = new Date(a + 'T00:00:00.000Z');
      const fechaB = new Date(b + 'T00:00:00.000Z');
      return fechaB.getTime() - fechaA.getTime();
    });
  }

  calcularTotalFecha(fecha: string): number {
    const comprasFecha = this.obtenerComprasPorFecha(fecha);
    return comprasFecha.reduce((total, compra) => {
      return total + compra.insumos.reduce((subtotal, insumo) => subtotal + insumo.costoTotal, 0);
    }, 0);
  }

  calcularTotalMes(): number {
    return this.comprasDelMes.reduce((total, compra) => {
      return total + compra.insumos.reduce((subtotal, insumo) => subtotal + insumo.costoTotal, 0);
    }, 0);
  }


  agregarInsumo(): void {
    this.insumosFormArray.push(this.createInsumoCompraForm());
    this.onUnidadChangeCompra(this.insumosFormArray.length - 1);
  }

  eliminarInsumo(index: number): void {
    if (this.insumosFormArray.length > 1) {
      this.insumosFormArray.removeAt(index);
    }
  }


  get insumosFormArray(): FormArray {
    return this.compraForm.get('insumos') as FormArray;
  }


  createCompraForm(compra?: Compra): FormGroup {
    const hoy = new Date();
    const fechaDefecto = new Date(this.anioSeleccionado, this.mesSeleccionado - 1, hoy.getDate());

    if (fechaDefecto.getMonth() + 1 !== this.mesSeleccionado) {
      fechaDefecto.setDate(1);
    }
    const fechaFormateada = this.formatearFechaInput(fechaDefecto);

    const form = this.fb.group({
      id: [compra?.id || null],
      fecha: [
        compra?.fecha || fechaFormateada,
        [Validators.required], // Validadores síncronos
        [this.fechaDuplicadaValidator()] // Validadores asíncronos
      ],
      insumos: this.fb.array(
          [], // El array se llenará a continuación
          [minLengthArray(1)] // Validador a nivel de FormArray
      )
    });

    const insumosFormArray = form.get('insumos') as FormArray;
    if (compra && compra.insumos && compra.insumos.length > 0) {
      compra.insumos.forEach(insumo => {
        let cantidadMostrada = insumo.cantidad;
        if(insumo.unidad === 'g') {
          cantidadMostrada = insumo.cantidad * 1000;
        } else if(insumo.unidad === 'unid' && insumo.pesoAprox) {
          cantidadMostrada = insumo.cantidad / insumo.pesoAprox;
        }

        const insumoFormGroup = this.createInsumoCompraForm(insumo);
        insumosFormArray.push(insumoFormGroup);
      });
    } else {
      insumosFormArray.push(this.createInsumoCompraForm());
    }

    return form;
  }

  createInsumoCompraForm(insumo?: any): FormGroup {
    const pesoAproxEnGramos = insumo?.pesoAprox ? insumo.pesoAprox * 1000 : '';

    return this.fb.group({
      nombre: [
        insumo?.nombre || '',
        [
          Validators.required,
          insumoEnListaValidator(this.nombresInsumosDisponibles)
        ]
      ],
      cantidad: [insumo?.cantidad || '', [Validators.required, Validators.min(0.001)]],
      unidad: [insumo ? insumo.unidad.toLowerCase() : 'kg', [Validators.required]],
      costoTotal: [insumo?.costoTotal || '', [Validators.required, Validators.min(0.01)]],
      pesoAprox: [pesoAproxEnGramos, []]
    });
  }

  abrirFormularioCompra(): void {
    this.mostrarFormularioCompra = true;
    this.editandoCompra = false;
    this.compraForm = this.createCompraForm();
    this.mensajeFormularioCompra = '';
  }

  editarCompra(compra: Compra): void {
    this.mostrarFormularioCompra = true;
    this.editandoCompra = true;
    this.compraForm = this.createCompraForm(compra);
  }

  cerrarFormularioCompra(): void {
    this.mostrarFormularioCompra = false;
    this.editandoCompra = false;
    this.compraForm.reset();
  }

  guardarCompra(): void {
    this.compraForm.markAllAsTouched();

    if (this.compraForm.invalid) {
      console.error('Formulario inválido. Errores:', this.compraForm.errors);
      return;
    }

    const formValue = this.compraForm.value;


    const insumosProcesados = formValue.insumos
        .map((insumo: any) => {

          const cantidadOriginal = Number(insumo.cantidad);
          const unidad = insumo.unidad;
          const pesoAproxEnKg = insumo.pesoAprox ? Number(insumo.pesoAprox) / 1000 : 0;
          let cantidadEnKg: number;

          switch (unidad) {
            case 'g':
              cantidadEnKg = cantidadOriginal / 1000;
              break;
            case 'unid':
              cantidadEnKg = cantidadOriginal * pesoAproxEnKg;
              break;
            default:
              cantidadEnKg = cantidadOriginal;
              break;
          }

          const insumoFinal: any = {
            nombre: insumo.nombre,
            cantidad: cantidadEnKg,
            unidad: unidad,
            costoTotal: Number(insumo.costoTotal)
          };

          if (unidad === 'unid') {
            insumoFinal.pesoAprox = pesoAproxEnKg;
          }

          return insumoFinal;
        })
        .filter((insumo: any) => insumo.nombre && insumo.nombre.trim() !== '');


    if (insumosProcesados.length === 0) {
      this.insumosFormArray.setErrors({ required: true });
      return;
    }

    const compraPayload: Omit<Compra, 'id' | 'usuarioId'> = {
      fecha: formValue.fecha,
      insumos: insumosProcesados,
    };


    if (this.editandoCompra) {
      const compraAActualizar: Compra = {
        id: formValue.id,
        usuarioId: '',
        ...compraPayload,
      };
      this.comprasService.updateCompra(compraAActualizar).subscribe({
        next: () => this.handleSuccess('Compra actualizada correctamente', formValue.fecha),
        error: (err) => this.handleError(err, true)
      });
    } else {
      this.comprasService.addCompra(compraPayload).subscribe({
        next: () => this.handleSuccess('Compra registrada correctamente', formValue.fecha),
        error: (err) => this.handleError(err, false)
      });
    }
  }






  onUnidadChangeCompra(index: number): void {
    const insumoControl = this.insumosFormArray.at(index) as FormGroup;
    const unidad = insumoControl.get('unidad')?.value;
    const pesoAproxControl = insumoControl.get('pesoAprox');

    pesoAproxControl?.clearValidators();
    pesoAproxControl?.setValue('');

    if (unidad === 'unid') {
      pesoAproxControl?.setValidators([Validators.required, Validators.min(1)]);
    }

    pesoAproxControl?.updateValueAndValidity();
  }


  eliminarCompra(compra: Compra): void {
    if (confirm('¿Está seguro de eliminar esta compra?')) {
      this.comprasService.deleteCompra(compra.id).subscribe({
        next: () => {
          this.cargarComprasDelMes();
          this.mensajeCompras = 'Compra eliminada correctamente';
        },
        error: (error) => {
          console.error('Error al eliminar compra:', error);
          this.mensajeCompras = 'Error al eliminar la compra';
        }
      });
    }
  }

  fechaDuplicadaValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (this.editandoCompra) {
        return of(null);
      }

      const fechaSeleccionada = control.value;
      const existe = this.comprasDelMes.some(compra => compra.fecha === fechaSeleccionada);

      if (existe) {

        return of({ fechaDuplicada: true });
      }

      return of(null);
    };
  }

  // Métodos auxiliares
  formatearFecha(fecha: string): string {
    try {
      const [anio, mes, dia] = fecha.split('-');
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${anio}`;
    } catch (error) {
      console.error('Error al formatear fecha:', fecha, error);
      return fecha;
    }
  }

  formatearMoneda(valor: number): string {
    return `S/. ${valor.toFixed(2)}`;
  }

  obtenerNombreMes(mes: number): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1] || '';
  }

  formatearFechaInput(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }


  mostrarCantidadCompra(insumo: any): string {
    if (!insumo) return '';

    const pesoTotalKg = insumo.cantidad;

    switch (insumo.unidad) {
      case 'unid':

        if (insumo.pesoAprox && insumo.pesoAprox > 0) {
          const cantidadUnidades = pesoTotalKg / insumo.pesoAprox;
          return `${cantidadUnidades.toFixed(0)} unid`;
        }
        return `(unidades)`;

      case 'g':
        const cantidadGramos = pesoTotalKg * 1000;
        return `${cantidadGramos} g`;

      case 'kg':
      default:
        return `${pesoTotalKg} kg`;
    }
  }


  onInsumoNameChange(event: Event, index: number): void {
    const searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
    this.filteredInsumos = searchTerm
        ? this.nombresInsumosDisponibles.filter(insumo => insumo.toLowerCase().includes(searchTerm))
        : [...this.nombresInsumosDisponibles];
  }

  selectInsumo(insumoName: string, index: number): void {
    this.insumosFormArray.at(index).get('nombre')?.setValue(insumoName);
    this.activeInsumoIndex = null;
  }

  onInsumoFocus(index: number): void {
    this.activeInsumoIndex = index;
    this.filteredInsumos = [...this.nombresInsumosDisponibles];
  }

  onInsumoBlur(index: number): void {
    setTimeout(() => {
      if (this.activeInsumoIndex === index) {
        this.activeInsumoIndex = null;
      }
    }, 150);
  }

  actualizarValidadoresDeInsumos(): void {
    if (!this.compraForm || !this.compraForm.get('insumos')) return;

    const insumosArray = this.compraForm.get('insumos') as FormArray;
    insumosArray.controls.forEach(control => {
      const nombreControl = control.get('nombre');
      nombreControl?.setValidators([
        Validators.required,
        insumoEnListaValidator(this.nombresInsumosDisponibles)
      ]);
      nombreControl?.updateValueAndValidity({ emitEvent: false });
    });
  }

  // Para verificar en consola si se manejan los datos correctamente

  verificarDatos(): void {
    console.log('=== DEBUG COMPRAS ===');
    console.log('Mes seleccionado:', this.mesSeleccionado);
    console.log('Año seleccionado:', this.anioSeleccionado);
    console.log('Total compras del mes:', this.comprasDelMes.length);
    console.log('Fechas únicas:', this.obtenerFechasUnicas());
    this.comprasDelMes.forEach((compra, index) => {
      console.log(`Compra ${index + 1}:`, {
        id: compra.id,
        fecha: compra.fecha,
        insumos: compra.insumos.length
      });
    });
  }



  verificarDatosCompras(): void {
    console.log('=== VERIFICACIÓN MANUAL DE DATOS ===');
    console.log('Estado actual del componente:');
    console.log('- Mes seleccionado:', this.mesSeleccionado, '(tipo:', typeof this.mesSeleccionado, ')');
    console.log('- Año seleccionado:', this.anioSeleccionado, '(tipo:', typeof this.anioSeleccionado, ')');
    console.log('- Total compras cargadas:', this.comprasDelMes.length);

    this.comprasService.getComprasByMonth(this.anioSeleccionado, this.mesSeleccionado).subscribe(compras => {
      console.log('Datos directos del servicio:');
      console.log('- Total compras en BD:', compras.length);
      console.log('- Fechas disponibles:', compras.map(c => c.fecha).sort());

      if (compras.length > 0) {
        const primeraCompra = compras[0];
        console.log('Estructura de la primera compra:', {
          id: primeraCompra.id,
          fecha: primeraCompra.fecha,
          tipoFecha: typeof primeraCompra.fecha,
          insumos: primeraCompra.insumos.length
        });
      }
    });
  }

  private handleSuccess(mensaje: string, fechaCompra: string): void {
    const fecha = new Date(fechaCompra + 'T12:00:00Z');
    this.mesSeleccionado = fecha.getUTCMonth() + 1;
    this.anioSeleccionado = fecha.getUTCFullYear();

    this.cargarComprasDelMes();
    this.cerrarFormularioCompra();
    this.mensajeCompras = mensaje;

    setTimeout(() => this.mensajeCompras = '', 4000);
  }

  private handleError(error: any, esEdicion: boolean): void {
    console.error('Error al guardar/actualizar compra:', error);
    this.mensajeCompras = esEdicion
        ? 'Error al actualizar la compra.'
        : 'Error al registrar la compra.';
  }
}