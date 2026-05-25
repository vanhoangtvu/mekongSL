'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../../lib/auth';
import { Lock, Mail, User, Eye, EyeOff, LogIn, UserPlus, Home, AlertCircle } from 'lucide-react';

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
        
        // Redirect based on role
        if (response.role === 'DATA_MANAGER') {
          router.push('/data');
        } else {
          router.push('/');
        }
      } else {
        const response = await authService.register(formData);
        authService.saveAuth(response);
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <button className="back-home" onClick={() => router.push('/')}>
        <Home size={20} />
        Về trang chủ
      </button>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <span className="logo-icon">🌊</span>
              <h1>Mekong WebGIS</h1>
            </div>
            <p className="auth-subtitle">
              {isLogin ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản mới'}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              className={`tab ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              Đăng nhập
            </button>
            <button
              className={`tab ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">
                <User size={16} />
                Tên đăng nhập
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Nhập tên đăng nhập"
                required
                minLength={3}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={16} />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Nhập email"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">
                <Lock size={16} />
                Mật khẩu
              </label>
              <div className="password-input">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="loading">Đang xử lý...</span>
              ) : isLogin ? (
                <>
                  <LogIn size={18} />
                  Đăng nhập
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Đăng ký
                </>
              )}
            </button>
          </form>

          <div className="auth-demo">
            <div className="demo-title">🔑 Tài khoản demo</div>
            <div className="demo-accounts">
              <div className="demo-account">
                <span className="demo-label">User:</span>
                <code>user / user123</code>
              </div>
              <div className="demo-account">
                <span className="demo-label">Manager:</span>
                <code>manager / manager123</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          padding: 20px;
          position: relative;
        }

        .back-home {
          position: absolute;
          top: 24px;
          left: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #475569;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 10;
        }

        .back-home:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .auth-container {
          width: 100%;
          max-width: 420px;
        }

        .auth-card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 10px 15px rgba(0, 0, 0, 0.1);
          padding: 40px 32px;
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .auth-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .logo-icon {
          font-size: 32px;
        }

        .auth-logo h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .auth-subtitle {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        .auth-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
        }

        .tab {
          flex: 1;
          padding: 10px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab.active {
          background: white;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .auth-error {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #fee2e2;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .form-group input {
          padding: 11px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s;
          outline: none;
          font-family: inherit;
        }

        .form-group input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .password-input {
          position: relative;
        }

        .password-input input {
          width: 100%;
          padding-right: 44px;
        }

        .toggle-password {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .toggle-password:hover {
          color: #3b82f6;
        }

        .auth-submit {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          margin-top: 6px;
        }

        .auth-submit:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading {
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .auth-demo {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
        }

        .demo-title {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
          text-align: center;
          font-weight: 500;
        }

        .demo-accounts {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .demo-account {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
        }

        .demo-label {
          color: #64748b;
          font-weight: 500;
        }

        .demo-account code {
          background: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 32px 24px;
          }

          .back-home {
            top: 16px;
            left: 16px;
            padding: 8px 16px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
