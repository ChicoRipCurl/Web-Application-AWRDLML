import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';
import {CanActivate, Router} from "@angular/router";

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {

  constructor(
      private authService: AuthService,
      private router: Router
  ) {}

  canActivate(): boolean {
    if (!this.authService.isAuthenticated()) {
      return true;
    } else {
      this.router.navigate(['/platos']);
      return false;
    }
  }
}
