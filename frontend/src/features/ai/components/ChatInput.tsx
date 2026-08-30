'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(24, Math.min(scrollH, 120))}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
  };

  return (
    <div className="ai-input-wrap">
      <div className="ai-input-box">
        <textarea
          ref={textareaRef}
          className="ai-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi AI về môi trường, độ mặn, vị trí nuôi tôm..."
          rows={1}
          disabled={disabled}
        />
        <button
          className="ai-send-btn"
          onClick={submit}
          disabled={!text.trim() || disabled}
          title="Gửi (Enter)"
        >
          <Send size={15} />
        </button>
      </div>

      <style>{`
        .ai-input-wrap {
          padding: 0.75rem 1rem 1rem;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          flex-shrink: 0;
        }

        .ai-input-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 16px;
          padding: 0.4rem 0.6rem 0.4rem 1rem;
          transition: all 0.2s;
          min-height: 44px;
          box-sizing: border-box;
        }

        .ai-input-box:focus-within {
          border-color: #2563a8;
          box-shadow: 0 0 0 3px rgba(37, 99, 168, 0.12);
          background: #ffffff;
        }

        .ai-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #0f172a;
          font-size: 0.88rem;
          font-family: inherit;
          resize: none;
          min-height: 24px;
          max-height: 120px;
          line-height: 1.4;
          padding: 3px 0;
          margin: 0;
          box-sizing: border-box;
          overflow-y: auto;
          vertical-align: middle;
        }

        .ai-textarea::placeholder {
          color: #94a3b8;
        }

        .ai-send-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #163c66, #2563a8);
          border: none;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .ai-send-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #20538c, #1d4ed8);
          transform: translateY(-1px);
        }

        .ai-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
