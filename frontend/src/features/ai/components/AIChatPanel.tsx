'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAIChat } from '../hooks/useAIChat';
import { useLocation } from '../hooks/useLocation';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
  /** Khi AI trả về GeoJSON layer → emit lên map */
  onGeoJsonLayer?: (layer: unknown) => void;
}

const QUICK_QUESTIONS = [
  '🦐 Khu vực nào phù hợp để nuôi tôm?',
  '💧 Độ mặn hiện tại tại các trạm?',
  '⚠️ Nguy cơ ngập lụt vùng nào cao?',
  '📊 Chất lượng nước tháng này?',
];

export function AIChatPanel({ open, onClose, onGeoJsonLayer }: AIChatPanelProps) {
  const { messages, isLoading, sessionId, sendMessage, clearChat } = useAIChat();
  const { location, loading: locLoading, requestLocation } = useLocation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [useGPS, setUseGPS] = useState(false);

  // Auto-scroll khi có tin nhắn mới
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Auto-request GPS khi bật useGPS
  useEffect(() => {
    if (useGPS && !location) requestLocation();
  }, [useGPS, location, requestLocation]);

  const handleSend = (text: string) => {
    sendMessage(text, useGPS ? location?.lat : null, useGPS ? location?.lon : null);
  };

  const handleQuick = (q: string) => {
    const clean = q.replace(/^[^\w\s]*\s*/, '');
    handleSend(clean);
  };

  return (
    <>
      {/* Backdrop trên mobile */}
      {open && <div className="ai-backdrop" onClick={onClose} />}

      <div className={`ai-panel ${open ? 'open' : ''}`} role="dialog" aria-label="AI Chat">
        {/* Header */}
        <div className="ai-panel-header">
          <div className="ai-header-left">
            <div className="ai-avatar-ring">
              <div className="ai-avatar-dot" />
            </div>
            <div>
              <div className="ai-header-title">MekongSalt AI</div>
              <div className="ai-header-sub">
                {sessionId
                  ? `Session: ${sessionId.slice(0, 8)}…`
                  : 'Trợ lý phân tích môi trường'}
              </div>
            </div>
          </div>
          <div className="ai-header-actions">
            <button
              className={`ai-gps-btn ${useGPS ? 'active' : ''}`}
              onClick={() => setUseGPS((v) => !v)}
              title={useGPS ? 'Tắt GPS' : 'Bật GPS vị trí'}
            >
              {locLoading ? '⏳' : useGPS ? '📍' : '🌐'}
              {useGPS && location
                ? ` ${location.lat.toFixed(3)},${location.lon.toFixed(3)}`
                : useGPS
                ? ' Đang lấy...'
                : ' GPS'}
            </button>
            {messages.length > 0 && (
              <button className="ai-icon-btn" onClick={clearChat} title="Xóa lịch sử">
                🗑
              </button>
            )}
            <button className="ai-icon-btn" onClick={onClose} title="Đóng">
              ✕
            </button>
          </div>
        </div>

        {/* GPS info bar */}
        {useGPS && location && (
          <div className="ai-gps-bar">
            📍 Vị trí: {location.lat.toFixed(5)}°N, {location.lon.toFixed(5)}°E
            {location.accuracy && ` · ±${Math.round(location.accuracy)}m`}
          </div>
        )}

        {/* Messages */}
        <div className="ai-messages">
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <div className="ai-welcome-icon">🌊</div>
              <h3>Xin chào! Tôi là AI Assistant</h3>
              <p>
                Tôi có thể giúp bạn phân tích dữ liệu môi trường, tìm địa điểm nuôi trồng phù
                hợp và đánh giá rủi ro.
              </p>
              <div className="ai-quick-list">
                {QUICK_QUESTIONS.map((q) => (
                  <button key={q} className="ai-quick-btn" onClick={() => handleQuick(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onShowOnMap={
                  msg.response?.geoJson && onGeoJsonLayer
                    ? () => onGeoJsonLayer(msg.response!.geoJson)
                    : undefined
                }
              />
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="ai-msg ai-msg-assistant">
              <div className="ai-bubble ai-bubble-assistant">
                <div className="ai-typing">
                  <span /><span /><span />
                </div>
                <span className="ai-thinking-text">Đang phân tích dữ liệu...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>

      <style>{`
        /* ===== AI Panel (LIGHT THEME) ===== */
        .ai-backdrop {
          display: none;
        }
        .ai-panel {
          position: absolute;
          top: 14px;
          right: 14px;
          bottom: 14px;
          width: 600px;
          max-width: calc(100% - 28px);
          height: calc(100% - 28px);
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid #cbd5e1;
          border-radius: 20px;
          display: none;
          flex-direction: column;
          transform: translateX(calc(100% + 30px));
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
          opacity: 0;
          pointer-events: none;
          z-index: 1200;
          box-shadow: -10px 10px 40px rgba(0, 0, 0, 0.12), 0 0 20px rgba(37, 99, 168, 0.08);
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden;
        }
        .ai-panel.open {
          display: flex;
          transform: translateX(0);
          opacity: 1;
          pointer-events: auto;
        }

        /* Header */
        .ai-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.75rem 1.15rem;
          background: rgba(255, 255, 255, 0.9);
          border-bottom: 1px solid #e4e4e7;
          flex-shrink: 0;
        }
        .ai-header-left { display: flex; align-items: center; gap: 0.75rem; }
        .ai-avatar-ring {
          width: 34px; height: 34px; border-radius: 50%;
          background: #ffffff; border: 1px solid #e4e4e7;
          display: flex; align-items: center; justify-content: center;
          animation: ai-pulse 3s ease-in-out infinite;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .ai-avatar-dot {
          width: 20px; height: 20px; border-radius: 50%;
          background: #18181b;
        }
        @keyframes ai-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.05); }
          50% { box-shadow: 0 0 0 4px rgba(0,0,0,0.02); }
        }
        .ai-header-title { color: #18181b; font-size: 0.95rem; font-weight: 600; letter-spacing: -0.01em; }
        .ai-header-sub { color: #71717a; font-size: 0.72rem; margin-top: 1px; }
        .ai-header-actions { display: flex; align-items: center; gap: 0.4rem; }

        .ai-gps-btn {
          display: flex; align-items: center; gap: 0.35rem;
          padding: 0.35rem 0.7rem; border-radius: 999px;
          background: #f4f4f5; border: 1px solid transparent;
          color: #52525b; font-size: 0.72rem; font-weight: 500; cursor: pointer;
          transition: all 0.2s;
        }
        .ai-gps-btn:hover { background: #e4e4e7; color: #18181b; }
        .ai-gps-btn.active { background: #18181b; color: #ffffff; }

        .ai-icon-btn {
          width: 30px; height: 30px; border-radius: 8px;
          background: transparent; border: 1px solid transparent;
          color: #71717a; font-size: 0.85rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .ai-icon-btn:hover { background: #fee2e2; color: #ef4444; }

        /* GPS bar */
        .ai-gps-bar {
          padding: 0.45rem 1.15rem;
          background: #eff6ff; border-bottom: 1px solid #dbeafe;
          color: #1d4ed8; font-size: 0.75rem; font-weight: 600;
        }

        /* Messages */
        .ai-messages {
          flex: 1; overflow-y: auto; padding: 1rem 1.15rem;
          display: flex; flex-direction: column; gap: 1rem;
          background: #ffffff;
        }
        .ai-messages::-webkit-scrollbar { width: 5px; }
        .ai-messages::-webkit-scrollbar-track { background: transparent; }
        .ai-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

        /* Welcome */
        .ai-welcome {
          text-align: center; padding: 1.5rem 0.5rem;
          animation: fadeIn 0.4s ease;
        }
        .ai-welcome-icon { font-size: 2.8rem; margin-bottom: 0.75rem; filter: drop-shadow(0 4px 8px rgba(37,99,168,0.2)); }
        .ai-welcome h3 { color: #0f172a; font-size: 1.15rem; font-weight: 700; margin: 0 0 0.5rem; }
        .ai-welcome p { color: #64748b; font-size: 0.85rem; line-height: 1.6; margin: 0 0 1.25rem; }

        .ai-quick-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .ai-quick-btn {
          padding: 0.75rem 1rem;
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 12px; color: #334155; font-size: 0.84rem; font-weight: 500;
          cursor: pointer; text-align: left; transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .ai-quick-btn:hover {
          background: #eff6ff; border-color: #93c5fd;
          color: #1d4ed8; transform: translateX(4px); box-shadow: 0 4px 12px rgba(37,99,168,0.1);
        }

        /* Message */
        .ai-msg {
          display: flex; gap: 0.8rem;
          animation: fadeInUp 0.3s ease;
          margin-bottom: 0.5rem;
        }
        .ai-msg-user { flex-direction: row-reverse; }

        .ai-bubble {
          max-width: 90%;
          font-size: 0.95rem; line-height: 1.7;
          color: #27272a;
        }
        .ai-bubble-user {
          background: #f4f4f5;
          padding: 0.65rem 1.1rem;
          border-radius: 1.25rem;
        }
        .ai-bubble-assistant {
          background: transparent;
          padding: 0.1rem 0;
          width: 100%;
        }

        /* Typing animation */
        .ai-typing {
          display: inline-flex; align-items: center; gap: 4px; margin-bottom: 4px;
        }
        .ai-typing span {
          width: 6px; height: 6px; border-radius: 50%;
          background: #2563a8; animation: typing 1.2s infinite;
        }
        .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
          0%,100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }
        .ai-thinking-text { display: block; color: #64748b; font-size: 0.78rem; font-weight: 500; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Mobile Responsive Fullscreen Overlay */
        @media (max-width: 640px) {
          .ai-panel {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100vw; height: 100dvh;
            max-width: 100vw;
            border-radius: 0;
            border: none;
            z-index: 9999;
          }
          .ai-backdrop {
            display: block; position: fixed; inset: 0;
            background: rgba(0,0,0,0.6); z-index: 9998;
          }
        }
      `}</style>
    </>
  );
}
