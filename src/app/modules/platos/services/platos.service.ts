import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Plato } from '../entities/plato.interface';
import {config} from "../../../config/config";


@Injectable({
  providedIn: 'root'
})
export class PlatosService {
  private apiUrl = `${config.apiUrl}/platos`;

  constructor(private http: HttpClient) {}


  getPlatos(): Observable<Plato[]> {
    return this.http.get<Plato[]>(this.apiUrl);
  }

  getPlatoById(id: string): Observable<Plato> {
    return this.http.get<Plato>(`${this.apiUrl}/${id}`);
  }

  addPlato(plato: Omit<Plato, 'id' | 'usuarioId'>): Observable<Plato> {
    return this.http.post<Plato>(this.apiUrl, plato);
  }

  updatePlato(plato: Plato): Observable<Plato> {
    return this.http.put<Plato>(`${this.apiUrl}/${plato.id}`, plato);
  }

  deletePlato(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  existePlatoConNombre(nombre: string, excludeId?: string): Observable<boolean> {
    let url = `${this.apiUrl}/existe?nombre=${encodeURIComponent(nombre)}`;
    if (excludeId) {
      url += `&excludeId=${excludeId}`;
    }
    return this.http.get<boolean>(url);
  }
}