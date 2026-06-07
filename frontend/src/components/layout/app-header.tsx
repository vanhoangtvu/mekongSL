"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authService } from "../../lib/auth";
import { LogOut, User, Menu, X, Shield, LogIn, Home } from "lucide-react";

type AppHeaderProps = {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
};

export function AppHeader({ onToggleSidebar, isSidebarOpen }: AppHeaderProps) {
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
          {onToggleSidebar ? (
            <button className="app-header-mobile-toggle" onClick={onToggleSidebar} type="button" aria-label="Toggle menu">
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          ) : (
            <Link href="/" className="app-header-mobile-toggle" aria-label="Trang chủ">
              <Home size={20} />
            </Link>
          )}
          <div className="app-brand">
            <Link href="/" className="app-logo">
              <Image src="/logo.png" alt="Mekong Salt Lab" width={158} height={30} style={{ objectFit: "contain" }} />
              <span className="app-logo-text">Environmental Data For Mekong</span>
            </Link>
             <p className="app-slogan">Empowering Sustainable Water Management Through Data</p>
          </div>
        </div>
        <nav className="app-header-nav">
          {user && (user.role === 'ADMIN' || user.role === 'DATA_MANAGER') && (
            <Link href="/data">Quản trị</Link>
          )}
          {user ? (
            <>
              <span className="user-info">
                <User size={16} />
                <span className="user-info-text">{user.username} ({user.role})</span>
              </span>
              <button onClick={handleLogout} className="logout-btn">
                <LogOut size={16} />
                <span className="logout-btn-text">Đăng xuất</span>
              </button>
            </>
          ) : (
            <Link href="/auth">Login</Link>
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
