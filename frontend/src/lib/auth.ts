export interface AuthUser {
  username: string;
  email: string;
  role: string;
  token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  type: string;
  username: string;
  email: string;
  role: string;
}

import { API_URL } from './api';

const ROLE_PRIORITY: Record<string, number> = {
  USER: 0,
  DATA_MANAGER: 1,
  ADMIN: 2,
};

const API_URL = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8084/api');

class AuthService {
  private readonly STORAGE_KEY = 'auth';

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Invalid username or password');
    }
    
    return response.json();
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(error.error || 'Registration failed');
    }
    
    return response.json();
  }

  saveAuth(auth: AuthResponse): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(auth));
  }

  getAuth(): AuthResponse | null {
    if (typeof window === 'undefined') return null;
    try {
      const auth = localStorage.getItem(this.STORAGE_KEY);
      return auth ? JSON.parse(auth) : null;
    } catch {
      return null;
    }
  }

  logout(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getAuth();
  }

  hasRole(role: string): boolean {
    const auth = this.getAuth();
    return auth?.role === role;
  }

  hasAccess(requiredRole?: string): boolean {
    if (!requiredRole) {
      return this.isAuthenticated();
    }

    const auth = this.getAuth();
    const currentPriority = auth ? ROLE_PRIORITY[auth.role] ?? -1 : -1;
    const requiredPriority = ROLE_PRIORITY[requiredRole] ?? Number.MAX_SAFE_INTEGER;

    return this.isAuthenticated() && currentPriority >= requiredPriority;
  }

  getToken(): string | null {
    return this.getAuth()?.token || null;
  }

  // Verify token is still valid by checking expiration
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < exp;
    } catch {
      return false;
    }
  }

  // Check if user has required role and token is valid
  canAccess(requiredRole?: string): boolean {
    if (!this.isAuthenticated()) return false;
    if (!this.isTokenValid()) {
      this.logout();
      return false;
    }
    return this.hasAccess(requiredRole);
  }

  getLandingPath(): string {
    const auth = this.getAuth();

    if (!auth) {
      return '/';
    }

    if (auth.role === 'ADMIN') {
      return '/dashboard';
    }

    if (auth.role === 'DATA_MANAGER') {
      return '/data';
    }

    return '/';
  }
}

export const authService = new AuthService();
