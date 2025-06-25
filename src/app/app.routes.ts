import { Routes } from '@angular/router';


import { AuthGuard } from './modules/auth/services/auth.guard';
import { GuestGuard } from './modules/auth/services/guest.guard';
import {PrediccionComponent} from "./modules/prediccion/pages/prediccion/prediccion.component";
export const routes: Routes = [
    // Rutas públicas (solo para usuarios no logueados)
    {
        path: 'login',
        loadComponent: () => import('./modules/auth/pages/login/login.component').then(m => m.LoginComponent),
        data: { layout: 'fullscreen' },
        canActivate: [GuestGuard]
    },
    {
        path: 'register',
        loadComponent: () => import('./modules/auth/pages/register/register.component').then(m => m.RegisterComponent),
        data: { layout: 'fullscreen' },
        canActivate: [GuestGuard]
    },
    {
        path: 'reset-password',
        loadComponent: () => import('./modules/auth/pages/recover/recover/recover.component').then(m => m.RecoverComponent),
        data: { layout: 'fullscreen' },
        canActivate: [GuestGuard]
    },

    // Rutas protegidas (solo para usuarios logueados)
    {
        path: 'platos',
        loadComponent: () => import('./modules/platos/pages/list/list.component').then(m => m.ListComponent),
        canActivate: [AuthGuard]
    },
    {
        path: 'registro',
        loadComponent: () => import('./modules/registro/pages/compra-venta/compra-venta.component').then(m => m.CompraVentaComponent),
        canActivate: [AuthGuard]
    },
    {
        path: 'demanda',
        loadComponent: () => import('./modules/prediccion/pages/prediccion/prediccion.component').then(m => m.PrediccionComponent),
        canActivate: [AuthGuard]
    },


    // Redirección por defecto
    { path: '**', redirectTo: 'login' }
];
