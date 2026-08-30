'use client';

import React, { useState } from 'react';
import type { Evidence } from '../types/ai-types';

export function EvidencePanel({ evidence }: { evidence: Evidence[] }) {
  const [open, setOpen] = useState(false);
  if (!evidence.length) return null;

  return (
    <div className="ev-panel">
      <button className="ev-toggle" onClick={() => setOpen((v) => !v)}>
        📋 Nguồn dữ liệu ({evidence.length} nguồn) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="ev-list">
          {evidence.map((e, i) => (
            <div key={i} className="ev-item">
              <div className="ev-source">{sourceIcon(e.source)} {e.source}</div>
              <div className="ev-detail">{e.detail}</div>
              <div className="ev-meta">
                {e.count} records · {e.unit && <span>{e.unit}</span>}
                {e.timestamp && <span> · {e.timestamp}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .ev-panel { font-size: 0.78rem; }
        .ev-toggle {
          display: flex; align-items: center; gap: 0.4rem;
          background: #f8fafc; border: 1px solid #cbd5e1;
          border-radius: 8px; padding: 0.4rem 0.75rem;
          color: #475569; cursor: pointer; font-size: 0.75rem; width: 100%;
          font-weight: 600;
          transition: all 0.2s;
        }
        .ev-toggle:hover { color: #0f172a; background: #f1f5f9; }
        .ev-list { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem; }
        .ev-item {
          padding: 0.5rem 0.75rem; border-radius: 8px;
          background: #ffffff; border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .ev-source { font-weight: 700; color: #1d4ed8; font-size: 0.72rem; }
        .ev-detail { color: #334155; margin: 0.1rem 0; font-weight: 500; }
        .ev-meta { color: #64748b; font-size: 0.68rem; }
      `}</style>
    </div>
  );
}

function sourceIcon(source: string): string {
  if (source?.toLowerCase().includes('mysql') || source?.toLowerCase().includes('postgres')) return '🗄️';
  if (source === 'S3') return '☁️';
  if (source?.includes('API')) return '🔌';
  return '📁';
}
