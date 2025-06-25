import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Compra } from "../entities/compra.interface";
import {config} from "../../../config/config";


@Injectable({
  providedIn: 'root'
})
export class ComprasService {
  private apiUrl = `${config.apiUrl}/compras`;

  constructor(private http: HttpClient) {}

  getAllCompras(): Observable<Compra[]> {

    return this.http.get<Compra[]>(this.apiUrl);
  }

  getComprasByMonth(anio: number, mes: number): Observable<Compra[]> {
    const params = new HttpParams()
        .set('anio', anio.toString())
        .set('mes', mes.toString());
    return this.http.get<Compra[]>(this.apiUrl, { params });
  }

  addCompra(compra: Omit<Compra, 'id' | 'usuarioId'>): Observable<Compra> {
    return this.http.post<Compra>(this.apiUrl, compra);
  }

  updateCompra(compra: Compra): Observable<Compra> {
    return this.http.put<Compra>(`${this.apiUrl}/${compra.id}`, compra);
  }

  deleteCompra(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}