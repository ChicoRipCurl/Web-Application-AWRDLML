import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import {AuthService} from "../../auth/services/auth.service";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  showNavigation = false;
  currentRoute = '';

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          this.currentRoute = event.url;
          this.updateNavigationVisibility();
        });

    this.currentRoute = this.router.url;
    this.updateNavigationVisibility();

    this.authService.currentUser$.subscribe(user => {
      this.updateNavigationVisibility();
    });
  }

  private updateNavigationVisibility() {
    const authRoutes = ['/login', '/register', '/reset-password'];
    this.showNavigation = !authRoutes.some(route => this.currentRoute.startsWith(route))
        && this.authService.isAuthenticated();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  isActiveRoute(route: string): boolean {
    return this.currentRoute.startsWith(route);
  }
}