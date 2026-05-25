'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, Home, LogIn } from 'lucide-react';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-container">
        <div className="unauthorized-icon">
          <AlertCircle size={64} />
        </div>
        <h1>Không có quyền truy cập</h1>
        <p>Bạn không có quyền truy cập trang này. Vui lòng đăng nhập với tài khoản có quyền phù hợp.</p>
        
        <div className="unauthorized-actions">
          <button onClick={() => router.push('/')} className="btn-home">
            <Home size={18} />
            Về trang chủ
          </button>
          <button onClick={() => router.push('/auth')} className="btn-login">
            <LogIn size={18} />
            Đăng nhập lại
          </button>
        </div>
      </div>

      <style jsx>{`
        .unauthorized-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .unauthorized-container {
          background: white;
          border-radius: 20px;
          padding: 48px 40px;
          max-width: 480px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .unauthorized-icon {
          color: #ef4444;
          margin-bottom: 24px;
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 12px 0;
        }

        p {
          color: #64748b;
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 32px 0;
        }

        .unauthorized-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn-home, .btn-login {
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          border: none;
        }

        .btn-home {
          background: #f1f5f9;
          color: #475569;
        }

        .btn-home:hover {
          background: #e2e8f0;
        }

        .btn-login {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-login:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
      `}</style>
    </div>
  );
}
