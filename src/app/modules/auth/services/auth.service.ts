import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {jwtDecode} from "jwt-decode";
import {config} from "../../../config/config";


export interface CurrentUser {
    id: string;
    restaurantName: string;
    email: string;
}

export interface AuthResponse {
    token: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    restaurantName: string;
    email: string;
    password: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadCurrentUserFromToken();
    }

    private loadCurrentUserFromToken(): void {
        const token = this.getToken();
        if (token) {
            try {

                const decodedToken: any = jwtDecode(token);
                const user: CurrentUser = {
                    id: decodedToken.id,
                    email: decodedToken.sub,
                    restaurantName: decodedToken.restaurantName,
                };

                const expiry = decodedToken.exp * 1000;
                if (Date.now() >= expiry) {
                    this.logout();
                } else {
                    this.currentUserSubject.next(user);
                }
            } catch (error) {
                console.error("No se pudo decodificar el token, deslogueando.", error);
                this.logout();
            }
        }
    }

    getToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('authToken');
        }
        return null;
    }

    private setSession(token: string): void {
        localStorage.setItem('authToken', token);
        this.loadCurrentUserFromToken();
    }


    isAuthenticated(): boolean {
        return this.getToken() !== null;
    }

    login(credentials: LoginRequest): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${config.apiUrl}/auth/login`, credentials).pipe(
            tap(response => this.setSession(response.token)),
            catchError(this.handleError)
        );
    }

    register(userData: RegisterRequest): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${config.apiUrl}/auth/register`, userData).pipe(
            tap(response => this.setSession(response.token)),
            catchError(this.handleError)
        );
    }

    emailExists(email: string): Observable<boolean> {

        return this.http.get<boolean>(`${config.apiUrl}/usuarios/existe?email=${email}`);
    }

    logout(): void {
        localStorage.removeItem('authToken');
        this.currentUserSubject.next(null);

        // this.router.navigate(['/login']);
    }

    // Helper para manejar errores de HTTP
    private handleError(error: any): Observable<never> {
        console.error('Ocurrió un error en la petición:', error);
        const errorMessage = error.error?.message || error.message || 'Error desconocido del servidor.';
        return throwError(() => new Error(errorMessage));
    }
}