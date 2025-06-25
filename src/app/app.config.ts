import {ApplicationConfig, inject} from '@angular/core';
import { provideRouter } from '@angular/router';
import {provideHttpClient, withFetch, withInterceptors} from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { routes } from './app.routes';
import {authInterceptor} from "./modules/auth/services/auth.interceptor";


export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes),
        provideHttpClient(
            withFetch(),
            withInterceptors([authInterceptor])
        )
    ]
};
