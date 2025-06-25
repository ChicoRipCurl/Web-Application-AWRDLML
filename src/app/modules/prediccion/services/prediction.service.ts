import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { PlatosService } from '../../platos/services/platos.service';
import {VentasService} from "../../registro/services/ventas.service";
import {ComprasService} from "../../registro/services/compras.service";
import { Venta } from '../../registro/entities/venta.interface';
import { Compra } from '../../registro/entities/compra.interface';
import { CompraInsumo } from '../../registro/entities/insumoCompra.interface';

// Interfaces para los resultados de la predicción (lo que devolvería el backend de ML)
export interface PrediccionPlato {
  nombre: string;
  cantidadEstimada: number;
}

export interface PrediccionInsumo {
  nombre: string;
  prediccionOptimaKg: number;
  compraSinSistemaKg: number; // Para la comparación
}

export interface PredictionResult {
  platosEstimados: PrediccionPlato[];
  insumosRequeridos: PrediccionInsumo[];
}

export interface HistoricalMonthData {
    key: string;
    mes: string;
    compras: number;
    consumo: number;
}

export interface HistoricalData {
    meses: HistoricalMonthData[];
    promedioCompras: number;
    promedioConsumo: number;
}

export interface WasteMonthData {
    key: string;
    mes: string;
    compradoKg: number;
    consumidoKg: number;
    desperdicioKg: number;
    desperdicioSoles: number;
    porcentajeDesperdicio: number;
}

export interface WasteAnalysisData {
    meses: WasteMonthData[];
    totalDesperdicioKg: number;
    totalDesperdicioSoles: number;
    porcentajeReduccionTotal: number;
}



@Injectable({
  providedIn: 'root'
})
export class PredictionService {

  // En un caso real, esta URL debe apuntar a nuestro backend de Machine Learning
  private predictionApiUrl = 'http://localhost:5000/predict'; // EJEMPLO de URL del backend de ML

  constructor(
      private http: HttpClient,
      private ventasService: VentasService,
      private comprasService: ComprasService,
      private platosService: PlatosService
  ) {}

  // Verifica si hay al menos 2 meses de datos de ventas

  checkDataAvailability(): Observable<boolean> {

     return this.ventasService.getVentas().pipe(
         map(ventas => {
           if (ventas.length < 1) {
             return false;
           }
           const fechas = ventas.map(v => new Date(v.fecha).getTime()).sort((a, b) => a - b);
           const fechaMasTemprana = new Date(fechas[0]);
           const fechaMasReciente = new Date(fechas[fechas.length - 1]);
           const diffMeses = (fechaMasReciente.getFullYear() - fechaMasTemprana.getFullYear()) * 12 +
               (fechaMasReciente.getMonth() - fechaMasTemprana.getMonth());

           return diffMeses >= 1;
         })
     );
  }

  getAvailableMonths(): Observable<{name: string, value: string}[]> {
        return forkJoin({
            ventas: this.ventasService.getVentas(),
            compras: this.comprasService.getAllCompras()
        }).pipe(
            map(({ ventas, compras }) => {
                const allDates = [
                    ...ventas.map(v => v.fecha),
                    ...compras.map(c => c.fecha)
                ];
                const monthKeys = [...new Set(allDates.map(date => date.substring(0, 7)))].sort();

                const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                return monthKeys.map(key => {
                    const [year, month] = key.split('-');
                    return {
                        name: `${mesesNombres[parseInt(month) - 1]} ${year}`,
                        value: key
                    };
                });
            })
       );
  }

    getHistoricalPerformance(startMonth?: string, endMonth?: string): Observable<HistoricalData> {
        return forkJoin({
            platos: this.platosService.getPlatos(),
            ventas: this.ventasService.getVentas(),
            compras: this.comprasService.getAllCompras()
        }).pipe(
            map(({ platos, ventas, compras }) => {
                const consumoPorMes: { [key: string]: number } = {};
                const comprasPorMes: { [key:string]: number } = {};

                // Calcular costos promedio de insumos
                const costosInsumos: { [nombre: string]: { totalCosto: number; totalKg: number } } = {};
                compras.forEach(compra => {
                    compra.insumos.forEach(insumo => {
                        if (!costosInsumos[insumo.nombre]) {
                            costosInsumos[insumo.nombre] = { totalCosto: 0, totalKg: 0 };
                        }
                        costosInsumos[insumo.nombre].totalCosto += insumo.costoTotal;
                        costosInsumos[insumo.nombre].totalKg += insumo.cantidad;
                    });
                });
                const costosPromedioKg: { [nombre: string]: number } = {};
                Object.keys(costosInsumos).forEach(nombre => {
                    const data = costosInsumos[nombre];
                    costosPromedioKg[nombre] = data.totalKg > 0 ? data.totalCosto / data.totalKg : 0;
                });

                // Calcular consumo valorizado por mes
                ventas.forEach(venta => {
                    const mesKey = venta.fecha.substring(0, 7);
                    if (!consumoPorMes[mesKey]) consumoPorMes[mesKey] = 0;

                    const platoVendido = platos.find(p => p.id === venta.platoId);
                    if (platoVendido) {
                        platoVendido.insumos.forEach(insumo => {
                            const costoKg = costosPromedioKg[insumo.nombre] || 0;
                            const consumoPlato = insumo.cantidadPorPorcion * venta.cantidad * costoKg;
                            consumoPorMes[mesKey] += consumoPlato;
                        });
                    }
                });

                //  Calcular compras por mes
                compras.forEach(compra => {
                    const mesKey = compra.fecha.substring(0, 7);
                    if (!comprasPorMes[mesKey]) comprasPorMes[mesKey] = 0;
                    comprasPorMes[mesKey] += compra.insumos.reduce((total, insumo) => total + insumo.costoTotal, 0);
                });

                // Formatear para el gráfico (con filtrado)
                const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                let allMesesKeys = [...new Set([...Object.keys(consumoPorMes), ...Object.keys(comprasPorMes)])].sort();

                const totalCompras = Object.values(comprasPorMes).reduce((a, b) => a + b, 0);
                const totalConsumo = Object.values(consumoPorMes).reduce((a, b) => a + b, 0);
                const numMesesTotal = allMesesKeys.length;

                if (startMonth && endMonth) {
                    allMesesKeys = allMesesKeys.filter(key => key >= startMonth && key <= endMonth);
                }

                const mesesData = allMesesKeys.map(key => {
                    const [year, month] = key.split('-');
                    return {
                        key: key,
                        mes: `${mesesNombres[parseInt(month) - 1]} ${year}`,
                        compras: comprasPorMes[key] || 0,
                        consumo: consumoPorMes[key] || 0,
                    };
                });

                return {
                    meses: mesesData,
                    promedioCompras: numMesesTotal > 0 ? totalCompras / numMesesTotal : 0,
                    promedioConsumo: numMesesTotal > 0 ? totalConsumo / numMesesTotal : 0,
                };
            })
        );
    }


// Recolecta todos los datos y los envía al backend de predicción.ESTA FUNCIÓN SIMULA LA LLAMADA AL BACKEND DE ML.
  getPrediction(startDate: string, endDate: string): Observable<PredictionResult> {
    // 1. Recolectar todos los datos necesarios para el modelo
    return forkJoin({
      platos: this.platosService.getPlatos(),
      ventas: this.ventasService.getVentas(),
      compras: this.comprasService.getAllCompras()
    }).pipe(
        switchMap(historicalData => {
          const payload = {
            startDate,
            endDate,
            historicalData
          };

          // En un caso real, se hace llamada POST al backend de ML
          // return this.http.post<PredictionResult>(this.predictionApiUrl, payload);

          // --- SIMULACIÓN DE LA RESPUESTA DEL BACKEND ---
          // Por mientras devolvemos datos de ejemplo con `of()`. para avanzar el UY


          console.log("Enviando al backend de ML (simulado):", payload);

          const mockResult: PredictionResult = {
            platosEstimados: [
              { nombre: 'Lomo saltado', cantidadEstimada: 60 },
              { nombre: 'Ají de gallina', cantidadEstimada: 40 },
              { nombre: 'Ceviche', cantidadEstimada: 53 }
            ],
            insumosRequeridos: [
              { nombre: 'Pollo', prediccionOptimaKg: 18, compraSinSistemaKg: 25 },
              { nombre: 'Tomate', prediccionOptimaKg: 11, compraSinSistemaKg: 15 },
              { nombre: 'Arroz', prediccionOptimaKg: 29, compraSinSistemaKg: 30 },
              { nombre: 'Papa amarilla', prediccionOptimaKg: 35, compraSinSistemaKg: 40 }
            ]
          };

          return of(mockResult);
        })
    );
  }

    getWasteAnalysisData(startMonth: string, endMonth: string): Observable<WasteAnalysisData> {
        return forkJoin({
            platos: this.platosService.getPlatos(),
            ventas: this.ventasService.getVentas(),
            compras: this.comprasService.getAllCompras()
        }).pipe(
            map(({ platos, ventas, compras }) => {
                const compradoPorMes: { [key: string]: number } = {};
                const consumidoPorMes: { [key: string]: { [insumo: string]: number } } = {};
                const comprasValorizadasPorMes: { [key: string]: number } = {};

                compras.forEach(compra => {
                    const mesKey = compra.fecha.substring(0, 7);
                    if (!compradoPorMes[mesKey]) compradoPorMes[mesKey] = 0;
                    if (!comprasValorizadasPorMes[mesKey]) comprasValorizadasPorMes[mesKey] = 0;

                    compra.insumos.forEach(insumo => {
                        compradoPorMes[mesKey] += insumo.cantidad;
                        comprasValorizadasPorMes[mesKey] += insumo.costoTotal;
                    });
                });

                ventas.forEach(venta => {
                    const mesKey = venta.fecha.substring(0, 7);
                    if (!consumidoPorMes[mesKey]) consumidoPorMes[mesKey] = {};
                    const platoVendido = platos.find(p => p.id === venta.platoId);
                    if (platoVendido) {
                        platoVendido.insumos.forEach(insumo => {
                            if (!consumidoPorMes[mesKey][insumo.nombre]) {
                                consumidoPorMes[mesKey][insumo.nombre] = 0;
                            }
                            consumidoPorMes[mesKey][insumo.nombre] += insumo.cantidadPorPorcion * venta.cantidad;
                        });
                    }
                });

                const costosInsumos: { [nombre: string]: { totalCosto: number; totalKg: number } } = {};
                compras.forEach(compra => {
                    compra.insumos.forEach(insumo => {
                        if (!costosInsumos[insumo.nombre]) costosInsumos[insumo.nombre] = { totalCosto: 0, totalKg: 0 };
                        costosInsumos[insumo.nombre].totalCosto += insumo.costoTotal;
                        costosInsumos[insumo.nombre].totalKg += insumo.cantidad;
                    });
                });
                const costosPromedioKg: { [nombre: string]: number } = {};
                Object.keys(costosInsumos).forEach(nombre => {
                    costosPromedioKg[nombre] = costosInsumos[nombre].totalKg > 0 ? costosInsumos[nombre].totalCosto / costosInsumos[nombre].totalKg : 0;
                });

                let allMesesKeys = [...new Set([...Object.keys(compradoPorMes), ...Object.keys(consumidoPorMes)])].sort()
                    .filter(key => key >= startMonth && key <= endMonth);

                const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                const mesesData: WasteMonthData[] = allMesesKeys.map(key => {
                    const compradoKg = compradoPorMes[key] || 0;
                    const insumosConsumidosMes = consumidoPorMes[key] || {};
                    const consumidoKg = Object.values(insumosConsumidosMes).reduce((a, b) => a + b, 0);
                    const desperdicioKg = Math.max(0, compradoKg - consumidoKg);

                    let desperdicioSoles = 0;
                    Object.keys(insumosConsumidosMes).forEach(insumoNombre => {
                    });
                    const comprasMes = comprasValorizadasPorMes[key] || 0;
                    const costoPromedioKgMes = compradoKg > 0 ? comprasMes / compradoKg : 0;
                    desperdicioSoles = desperdicioKg * costoPromedioKgMes;

                    const porcentajeDesperdicio = compradoKg > 0 ? (desperdicioKg / compradoKg) * 100 : 0;

                    const [year, month] = key.split('-');
                    return {
                        key: key,
                        mes: `${mesesNombres[parseInt(month) - 1]} ${year}`,
                        compradoKg, consumidoKg, desperdicioKg, desperdicioSoles, porcentajeDesperdicio
                    };
                });

                const totalDesperdicioKg = mesesData.reduce((sum, m) => sum + m.desperdicioKg, 0);
                const totalDesperdicioSoles = mesesData.reduce((sum, m) => sum + m.desperdicioSoles, 0);
                let porcentajeReduccionTotal = 0;
                if (mesesData.length > 1) {
                    const primerPorcentaje = mesesData[0].porcentajeDesperdicio;
                    const ultimoPorcentaje = mesesData[mesesData.length - 1].porcentajeDesperdicio;
                    if (primerPorcentaje > 0) {
                        porcentajeReduccionTotal = ((primerPorcentaje - ultimoPorcentaje) / primerPorcentaje) * 100;
                    }
                }

                return { meses: mesesData, totalDesperdicioKg, totalDesperdicioSoles, porcentajeReduccionTotal };
            })
        );
    }


    // Función para calcular el stock teórico
    public getTheoreticalStock(): Observable<{ [insumoNombre: string]: number }> {
        return forkJoin({
            platos: this.platosService.getPlatos(),
            ventas: this.ventasService.getVentas(),
            compras: this.comprasService.getAllCompras()
        }).pipe(
            map(({ platos, ventas, compras }) => {
                const stock: { [insumoNombre: string]: number } = {};

                //Sumar todas las compras históricas por insumo
                compras.forEach(compra => {
                    compra.insumos.forEach(insumo => {
                        stock[insumo.nombre] = (stock[insumo.nombre] || 0) + insumo.cantidad;
                    });
                });

                //Restar el total consumo histórico por insumo
                ventas.forEach(venta => {
                    const platoVendido = platos.find(p => p.id === venta.platoId);
                    if (platoVendido) {
                        platoVendido.insumos.forEach(insumo => {
                            const consumoTotal = insumo.cantidadPorPorcion * venta.cantidad;
                            stock[insumo.nombre] = (stock[insumo.nombre] || 0) - consumoTotal;
                        });
                    }
                });

                // Asegurarse de que no haya stocks negativos (debido a datos incorrectos)
                Object.keys(stock).forEach(key => {
                    if (stock[key] < 0) {
                        stock[key] = 0;
                    }
                });

                return stock;
            })
        );
    }

}