import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Venta } from "../entities/venta.interface";
import {config} from "../../../config/config";

@Injectable({
  providedIn: 'root'
})
export class VentasService {

  private apiUrl = `${config.apiUrl}/ventas`;

  constructor(private http: HttpClient) {}

  getVentas(): Observable<Venta[]> {
    return this.http.get<Venta[]>(this.apiUrl);
  }

  getVentasByFecha(fecha: string): Observable<Venta[]> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get<Venta[]>(this.apiUrl, { params });
  }


  addVenta(venta: Omit<Venta, 'id' | 'usuarioId'>): Observable<Venta> {
    return this.http.post<Venta>(this.apiUrl, venta);
  }

  updateVenta(venta: Venta): Observable<Venta> {
    return this.http.put<Venta>(`${this.apiUrl}/${venta.id}`, venta);
  }


  deleteVenta(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}