import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {AuthService} from "../../services/auth.service";


// Función para validación, las contraseñas deben coincidir
export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (!password || !confirmPassword || !password.value || !confirmPassword.value) {
    return null;
  }

  if (confirmPassword.errors && confirmPassword.errors['passwordMismatch'] && password.value === confirmPassword.value) {

    const { passwordMismatch, ...errors } = confirmPassword.errors;
    confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }

  if (password.value !== confirmPassword.value) {
    confirmPassword.setErrors({ ...confirmPassword.errors, passwordMismatch: true });
    return { passwordMismatch: true };
  }

  return null;
}


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  // Propiedades del formulario
  registerForm!: FormGroup;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
      private fb: FormBuilder,
      private router: Router,
      private authService: AuthService
  ) {}


  ngOnInit(): void {
    this.registerForm = this.fb.group({
      restaurantName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]],
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', Validators.required]
    }, {
      validators: passwordMatchValidator
    });
  }


  get restaurantName() { return this.registerForm.get('restaurantName'); }
  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }



  getPasswordStrength(): { level: number; text: string; color: string } {
    const pass = this.password?.value || '';
    if (!pass) return { level: 0, text: '', color: '' };

    let score = 0;
    const checks = [
      pass.length >= 8,
      /[A-Z]/.test(pass),
      /[a-z]/.test(pass),
      /\d/.test(pass),
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pass)
    ];

    score = checks.filter(Boolean).length;

    if (score <= 2) return { level: 1, text: 'Débil', color: '#e53e3e' };
    if (score <= 3) return { level: 2, text: 'Media', color: '#dd6b20' };
    if (score <= 4) return { level: 3, text: 'Fuerte', color: '#38a169' };
    return { level: 4, text: 'Muy fuerte', color: '#25975a' };
  }

  get hasMinLength(): boolean {
    return this.password?.value.length >= 8;
  }

  get hasUpperCase(): boolean {
    return /[A-Z]/.test(this.password?.value);
  }

  get hasLowerCase(): boolean {
    return /[a-z]/.test(this.password?.value);
  }

  get hasNumber(): boolean {
    return /\d/.test(this.password?.value);
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.errorMessage = 'Por favor, corrige los errores en el formulario.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.register({
      restaurantName: this.registerForm.value.restaurantName.trim(),
      email: this.registerForm.value.email.trim(),
      password: this.registerForm.value.password
    }).subscribe({
      next: (user) => {
        if (user) {
          this.successMessage = '¡Cuenta creada exitosamente! Redirigiendo...';
          setTimeout(() => {
            this.router.navigate(['/platos']);
          }, 2000);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error en registro:', error);
        if (error.message === 'El email ya está registrado') {
          this.errorMessage = 'Este correo electrónico ya está registrado.';
        } else {
          this.errorMessage = 'Error al crear la cuenta. Intenta nuevamente.';
        }
        this.isLoading = false;
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}