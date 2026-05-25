"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../../lib/auth";
import { LogOut, User } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    const auth = authService.getAuth();
    if (auth) {
      setUser({ username: auth.username, role: auth.role });
    }
  }, []);

  const handleLogout = () => {
    authService.logout();
    router.push('/auth');
  };

  return (
    <header className="app-header">
      <div className="app-header-content">
        <div className="app-header-left">
          <Link href="/" className="app-logo">
            🌊 Mekong WebGIS
          </Link>
        </div>
        <nav className="app-header-nav">
          <a href="/">Bản đồ</a>
          <a href="/data">Dữ liệu</a>
          {user ? (
            <>
              <span className="user-info">
                <User size={16} />
                {user.username} ({user.role})
              </span>
              <button onClick={handleLogout} className="logout-btn">
                <LogOut size={16} />
                Đăng xuất
              </button>
            </>
          ) : (
            <a href="/auth">Đăng nhập</a>
          )}
        </nav>
      </div>
      <style jsx>{`
        .user-info {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 14px;
          color: #475569;
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          background: #fee;
          color: #c33;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        .logout-btn:hover {
          background: #fcc;
        }
      `}</style>
    </header>
  );
}
