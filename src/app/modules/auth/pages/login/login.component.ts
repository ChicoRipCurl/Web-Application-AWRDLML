import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {AuthService} from "../../services/auth.service";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  loginForm!: FormGroup;
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
      private router: Router,
      private authService: AuthService,
      private fb: FormBuilder

  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }


  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Por favor, completa todos los campos correctamente.';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        this.router.navigate(['/platos']);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error en login:', error);
          if (error.status === 401 || error.status === 403) {
              this.errorMessage = error.error?.message || 'Credenciales incorrectas. Intenta nuevamente.';
          } else {
              this.errorMessage = 'Error al conectar con el servidor. Intenta nuevamente más tarde.';
          }
        this.isLoading = false;
      }
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  goToRecover(): void {
    this.router.navigate(['/reset-password']);
  }
}