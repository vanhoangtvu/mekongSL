'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { authService } from '@/lib/auth';
import { 
  Database, Lock, ArrowLeft, Info, Download, Archive, 
  StopCircle, CheckCircle, RefreshCw, AlertCircle, 
  Check, AlertTriangle, List, Loader2 
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface S3Object {
  key: string;
  size: number;
  lastModified: string;
}

interface LogEntry {
  ts: string;
  level: 'info' | 'ok' | 'error' | 'warn';
  msg: string;
}

function formatBytes(b: number): string {
  if (!b) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function BackupPage() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Backup state
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, done: 0, errors: 0, bytes: 0, totalBytes: 0 });

  const logsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (authService.canAccess('ADMIN')) {
      setIsAdmin(true);
    }
    setIsChecking(false);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    const entry: LogEntry = { ts: new Date().toLocaleTimeString('vi-VN'), level, msg };
    setLogs(prev => {
      const next = [...prev, entry];
      return next.slice(-300); // keep last 300 lines
    });
    // Auto-scroll
    setTimeout(() => {
      if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }, 30);
  }, []);

  // ── Download file: fetch → blob → <a> click ────────────
  async function downloadFile(key: string): Promise<boolean> {
    try {
      const encodedKey = key.split('/').map(encodeURIComponent).join('/');
      const downloadUrl = `/api/backup/download/${encodedKey}`;

      const token = authService.getToken();
      
      const res = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = key.replace(/\//g, '__');
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      await new Promise(r => setTimeout(r, 200));
      return true;
    } catch (err: any) {
      addLog('error', `Lỗi tải "${key}": ${err.message}`);
      return false;
    }
  }

  // ── Start Backup ─────────────────────────────────────────────────────────────
  async function startBackup() {
    setRunning(true);
    setDone(false);
    setLogs([]);
    setProgress(0);
    setStats({ total: 0, done: 0, errors: 0, bytes: 0, totalBytes: 0 });
    abortRef.current = false;

    try {
      addLog('info', 'Đang liệt kê toàn bộ file trên S3...');
      
      const token = authService.getToken();
      const res = await fetch('/api/backup/list', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const { objects, total, totalSize } = (await res.json()) as {
        objects: S3Object[];
        total: number;
        totalSize: number;
      };

      addLog('ok', `Tìm thấy ${total} files (${formatBytes(totalSize)})`);
      setStats(s => ({ ...s, total, totalBytes: totalSize }));

      if (total === 0) {
        addLog('warn', 'Bucket trống hoặc không có file nào!');
        setDone(true);
        return;
      }

      addLog('info', 'Bắt đầu tải xuống theo cây thư mục S3...');
      addLog('warn', 'Trình duyệt sẽ hỏi cho phép tải nhiều file — hãy cho phép!');

      let doneCount = 0;
      let errorCount = 0;
      let bytesDone = 0;

      for (let i = 0; i < objects.length; i++) {
        if (abortRef.current) {
          addLog('warn', 'Đã dừng backup.');
          break;
        }

        const obj = objects[i];
        addLog('info', `[${i + 1}/${total}] ${obj.key} (${formatBytes(obj.size)})`);

        const ok = await downloadFile(obj.key);
        if (ok) {
          doneCount++;
          bytesDone += obj.size;
        } else {
          errorCount++;
        }

        const pct = Math.round(((i + 1) / total) * 100);
        setProgress(pct);
        setStats(s => ({
          ...s,
          done: doneCount,
          errors: errorCount,
          bytes: bytesDone,
        }));
      }

      addLog('ok', `Xong! ${doneCount} files tải thành công, ${errorCount} lỗi.`);
      setDone(true);
    } catch (err: any) {
      addLog('error', `Lỗi: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  function startZipBackup() {
    setRunning(true);
    setDone(false);
    setLogs([]);
    setProgress(100);
    setStats({ total: 1, done: 1, errors: 0, bytes: 0, totalBytes: 0 });
    
    addLog('info', 'Đang yêu cầu Server tải và nén toàn bộ S3 thành 1 file ZIP...');
    addLog('warn', 'Vui lòng chờ trình duyệt bắt đầu tải xuống (có thể mất một lúc nếu dữ liệu lớn).');
    
    const token = authService.getToken();
    
    const a = document.createElement('a');
    a.href = `/api/backup/download-zip${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => {
      addLog('ok', 'Trình duyệt đang tải file ZIP. Hãy theo dõi tiến trình trong trình quản lý tải xuống của bạn!');
      setRunning(false);
      setDone(true);
    }, 4000);
  }

  function stopBackup() {
    abortRef.current = true;
    addLog('warn', 'Đang dừng...');
  }

  if (isChecking) return null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .bk-root {
          min-height: 100vh;
          background: var(--background);
          font-family: var(--font-sans);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          position: relative;
        }

        /* ── DASHBOARD ── */
        .dashboard {
          width: 100%; max-width: 780px;
          position: relative; z-index: 1;
          display: flex; flex-direction: column; gap: 1.25rem;
        }

        .dash-header {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 1.25rem 1.5rem;
          box-shadow: var(--shadow-sm);
        }

        .dash-brand { display: flex; align-items: center; gap: 1rem; }

        .dash-icon {
          width: 44px; height: 44px;
          background: var(--accent);
          color: #ffffff;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 168, 0.3);
        }

        .dash-title {
          font-size: 1.15rem; font-weight: 700;
          color: var(--text);
        }

        .dash-sub { font-size: .8rem; color: var(--text-muted); margin-top: .15rem; }

        .btn-back {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: var(--surface-strong);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: var(--radius-md);
          padding: .5rem .875rem;
          font-size: .85rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
        }
        .btn-back:hover { background: var(--border); }

        /* ── CARD ── */
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }

        .card-body { padding: 1.75rem; }

        .backup-btn-wrap { text-align: center; }

        .btn-backup {
          background: var(--accent);
          color: white; border: none; border-radius: var(--radius-lg);
          padding: 1rem 2rem;
          font-size: 1.05rem; font-weight: 600;
          cursor: pointer; transition: all .25s;
          box-shadow: 0 4px 12px rgba(37, 99, 168, 0.25);
          display: inline-flex; align-items: center; gap: .6rem;
        }
        .btn-backup:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 168, 0.35);
        }
        .btn-backup:disabled { opacity: .6; cursor: not-allowed; transform: none; box-shadow: none; }

        .btn-backup-zip {
          background: var(--success);
          box-shadow: 0 4px 12px rgba(25, 135, 84, 0.25);
        }
        .btn-backup-zip:hover:not(:disabled) {
          background: #146c43;
          box-shadow: 0 6px 16px rgba(25, 135, 84, 0.35);
        }

        .btn-stop {
          background: transparent;
          border: 1px solid var(--danger);
          color: var(--danger); border-radius: var(--radius-md);
          padding: .6rem 1.25rem; font-size: .9rem; font-weight: 500;
          cursor: pointer; transition: all .2s; margin-left: 1rem;
          display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .btn-stop:hover { background: rgba(220, 53, 69, 0.1); }

        .btn-again {
          background: transparent;
          border: 1px solid var(--success);
          color: var(--success); border-radius: var(--radius-md);
          padding: .6rem 1.25rem; font-size: .9rem; font-weight: 500;
          cursor: pointer; transition: all .2s; margin-top: 1rem;
          display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .btn-again:hover { background: rgba(25, 135, 84, 0.1); }

        /* Stats bar */
        .stats-row {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;
          margin-top: 1.5rem;
        }

        .stat-box {
          background: var(--surface-strong);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 1rem;
          text-align: center;
        }

        .stat-val {
          font-size: 1.25rem; font-weight: 700;
          color: var(--text);
        }

        .stat-lbl { font-size: .75rem; color: var(--text-muted); margin-top: .3rem; }

        /* Progress bar */
        .progress-wrap { margin-top: 1.5rem; }

        .progress-top {
          display: flex; justify-content: space-between;
          font-size: .85rem; color: var(--text-muted); margin-bottom: .5rem;
        }

        .progress-pct {
          font-weight: 600; color: var(--text);
        }

        .bar-track {
          height: 8px; background: var(--surface-strong); border-radius: 99px; overflow: hidden;
          border: 1px solid var(--border);
        }

        .bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 99px;
          transition: width .3s ease;
        }

        /* Done banner */
        .done-banner {
          background: rgba(25, 135, 84, 0.08);
          border: 1px solid rgba(25, 135, 84, 0.3);
          border-radius: var(--radius-md); padding: 1rem 1.25rem;
          color: var(--success);
          display: flex; align-items: center; justify-content: center; gap: .75rem;
          margin-top: 1.25rem; font-weight: 500;
        }

        /* Log panel */
        .log-wrap {
          background: #1e1e1e;
          color: #d4d4d4;
          border-radius: var(--radius-md);
          padding: 1rem;
          height: 280px; overflow-y: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: .8rem;
          margin-top: 1.5rem;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .log-line {
          line-height: 1.6; padding: 2px 0;
          display: flex; gap: 0.5rem; align-items: flex-start;
        }

        .log-ts { color: #6e7681; white-space: nowrap; }
        .log-info { color: #79c0ff; }
        .log-ok { color: #56d364; }
        .log-error { color: #f85149; }
        .log-warn { color: #e3b341; }
        .log-icon { flex-shrink: 0; margin-top: 2px; }

        /* Notice */
        .notice {
          background: rgba(37, 99, 168, 0.08);
          border: 1px solid rgba(37, 99, 168, 0.2);
          border-radius: var(--radius-md); padding: 1rem 1.25rem;
          font-size: .85rem; color: var(--accent-strong); line-height: 1.5;
          display: flex; gap: 0.75rem; align-items: flex-start;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .btn-login-redirect {
          background: var(--accent);
          color: white; border: none; border-radius: var(--radius-md);
          padding: .75rem 1.5rem; font-size: .95rem; font-weight: 500;
          cursor: pointer; transition: all .2s;
          display: inline-block; margin-top: 1.25rem;
          text-decoration: none;
        }
        .btn-login-redirect:hover { background: var(--accent-hover); }

        @media (max-width: 600px) {
          .stats-row { grid-template-columns: repeat(2,1fr); }
          .bk-root { padding: 1rem; }
          .dash-brand { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
        }
      `}</style>

      <div className="bk-root">
        {!isAdmin ? (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', width: '100%', maxWidth: '420px', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              <Lock size={48} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>Yêu cầu quyền truy cập</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Bạn cần đăng nhập bằng tài khoản Quản trị viên (ADMIN) để sử dụng hệ thống sao lưu dự phòng.</p>
            <a href="/auth" className="btn-login-redirect">Đến trang Đăng nhập</a>
          </div>
        ) : (
          <div className="dashboard">
            {/* Header */}
            <div className="dash-header">
              <div className="dash-brand">
                <div className="dash-icon">
                  <Database size={24} />
                </div>
                <div>
                  <div className="dash-title">S3 Backup Manager</div>
                  <div className="dash-sub">Mekong Salt Lab · Hệ thống sao lưu dự phòng</div>
                </div>
              </div>
              <a href="/dashboard" className="btn-back">
                <ArrowLeft size={16} /> Trở về Dashboard
              </a>
            </div>

            {/* Notice */}
            {!running && !done && (
              <div className="notice">
                <Info size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Lưu ý quan trọng:</strong> Khi chọn tải từng file, trình duyệt sẽ tự động tải các file từ S3 về máy. 
                  Hãy cho phép trình duyệt tải nhiều file (Multiple files download) khi được hỏi. 
                  Cấu trúc thư mục gốc trên S3 sẽ được giữ nguyên trong tên file tải về.
                </div>
              </div>
            )}

            {/* Main card */}
            <div className="card">
              <div className="card-body">

                <div className="backup-btn-wrap">
                  {!running && !done && (
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn-backup" onClick={startBackup}>
                        <Download size={20} />
                        Tải từng file rời
                      </button>
                      
                      <button className="btn-backup btn-backup-zip" onClick={startZipBackup}>
                        <Archive size={20} />
                        Tải toàn bộ 1 file ZIP
                      </button>
                    </div>
                  )}

                  {running && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                      <button className="btn-backup" disabled>
                        <Loader2 size={20} className="spinner" />
                        Đang xử lý...
                      </button>
                      <button className="btn-stop" onClick={stopBackup}>
                        <StopCircle size={18} /> Dừng lại
                      </button>
                    </div>
                  )}

                  {done && !running && (
                    <div style={{ textAlign: 'center' }}>
                      <div className="done-banner">
                        <CheckCircle size={24} />
                        <span>Sao lưu hoàn tất! Đã xử lý {stats.done} tệp tin.</span>
                      </div>
                      <button className="btn-again" onClick={() => { setDone(false); setLogs([]); }}>
                        <RefreshCw size={16} /> Thực hiện lại
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress */}
                {(running || done) && (
                  <>
                    <div className="progress-wrap">
                      <div className="progress-top">
                        <span>{stats.done} / {stats.total} files · {formatBytes(stats.bytes)} / {formatBytes(stats.totalBytes)}</span>
                        <span className="progress-pct">{progress}%</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="stats-row">
                      <div className="stat-box">
                        <div className="stat-val">{stats.done}</div>
                        <div className="stat-lbl">Đã tải</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-val">{stats.total - stats.done - stats.errors}</div>
                        <div className="stat-lbl">Còn lại</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-val" style={{ color: stats.errors > 0 ? 'var(--danger)' : undefined }}>
                          {stats.errors}
                        </div>
                        <div className="stat-lbl">Lỗi</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-val">{formatBytes(stats.bytes)}</div>
                        <div className="stat-lbl">Dung lượng</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Logs */}
                {logs.length > 0 && (
                  <div className="log-wrap" ref={logsRef}>
                    {logs.map((l, i) => (
                      <div key={i} className="log-line">
                        <span className="log-ts">[{l.ts}]</span>
                        {l.level === 'info' && <List size={14} className="log-info log-icon" />}
                        {l.level === 'ok' && <Check size={14} className="log-ok log-icon" />}
                        {l.level === 'error' && <AlertCircle size={14} className="log-error log-icon" />}
                        {l.level === 'warn' && <AlertTriangle size={14} className="log-warn log-icon" />}
                        <span className={`log-${l.level}`}>{l.msg}</span>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
