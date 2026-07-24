'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../../lib/auth';
import { Lock, Mail, User, Eye, EyeOff, LogIn, UserPlus, Home, AlertCircle } from 'lucide-react';
import styles from './auth.module.css';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await authService.login({
          username: formData.username,
          password: formData.password,
        });
        authService.saveAuth(response);
        router.push(authService.getLandingPath());
      } else {
        const response = await authService.register(formData);
        authService.saveAuth(response);
        router.push(authService.getLandingPath());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <button className={styles.backHome} onClick={() => router.push('/')}>
        <Home size={20} />
        Back to Home
      </button>

      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <div className={styles.authLogo}>
              <div className={styles.logoWrapper}>
                <img src="/logo.png" alt="Mekong Salt Lab" />
              </div>
            </div>
            <p className={styles.authSubtitle}>
              {isLogin ? 'Sign in to the system' : 'Create a new account'}
            </p>
          </div>

          <div className={styles.authBody}>
          <div className={styles.authTabs}>
            <button
              type="button"
              className={`${styles.tab} ${isLogin ? styles.tabActive : ''}`}
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`${styles.tab} ${!isLogin ? styles.tabActive : ''}`}
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.authForm}>
            {error && (
              <div className={styles.authError}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="username">
                <User size={16} />
                Username
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
                required
                minLength={3}
              />
            </div>

            {!isLogin && (
              <div className={styles.formGroup}>
                <label htmlFor="email">
                  <Mail size={16} />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                  required
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="password">
                <Lock size={16} />
                Password
              </label>
              <div className={styles.passwordInput}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password (min 6 characters)"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.authSubmit} disabled={loading}>
              {loading ? (
                <span className={styles.loading}>Processing...</span>
              ) : isLogin ? (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Sign Up
                </>
              )}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
