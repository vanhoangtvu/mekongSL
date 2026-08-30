'use client';

import React from 'react';
import { Bot, User, MapPin, AlertTriangle } from 'lucide-react';
import type { AIMessage } from '../types/ai-types';
import { SuitabilityCard } from './SuitabilityCard';
import { EvidencePanel } from './EvidencePanel';
import { ExecutionStepsPanel } from './ExecutionStepsPanel';

interface ChatMessageProps {
  message: AIMessage;
  onShowOnMap?: () => void;
}

export function ChatMessage({ message, onShowOnMap }: ChatMessageProps) {
  const { role, content, response } = message;
  const isUser = role === 'user';

  return (
    <div className={`ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="msg-avatar msg-avatar-ai">
          <Bot size={18} />
        </div>
      )}

      <div className="msg-content-wrap">
        {/* Bubble */}
        <div className={`ai-bubble ${isUser ? 'ai-bubble-user' : 'ai-bubble-assistant'}`}>
          {!isUser && response?.executionSteps && (
            <ExecutionStepsPanel steps={response.executionSteps} />
          )}
          <MarkdownText text={content} />
        </div>

        {/* Rich cards — chỉ cho assistant với response đầy đủ */}
        {!isUser && response?.success && (
          <div className="msg-cards">

            {/* Intent badge */}
            {response.intent && response.intent.type !== 'GENERAL_QUESTION' && (
              <div className="msg-intent-badge">
                <span className="intent-icon">{getIntentIcon(response.intent.type)}</span>
                <span>{response.intent.summary || response.intent.type}</span>
              </div>
            )}

            {/* Suitability Card */}
            {response.suitability && (
              <SuitabilityCard result={response.suitability} />
            )}

            {/* Risk badge */}
            {response.risk && response.risk.hasData && (
              <div className={`msg-risk-badge risk-${response.risk.riskLevel.toLowerCase()}`}>
                <span>{getRiskIcon(response.risk.riskLevel)}</span>
                <span>
                  <strong>Rủi ro: {response.risk.totalRiskScore.toFixed(0)}/100</strong>
                  <em>{response.risk.riskClassification}</em>
                </span>
              </div>
            )}

            {/* Evidence */}
            {response.evidence && response.evidence.length > 0 && (
              <EvidencePanel evidence={response.evidence} />
            )}

            {/* Validation warnings */}
            {response.validation && response.validation.warningCount > 0 && (
              <div className="msg-warnings">
                {response.validation.warnings.map((w, i) => (
                  <div key={i} className="msg-warning-item">
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Show on map button */}
            {onShowOnMap && (
              <button className="msg-map-btn" onClick={onShowOnMap}>
                <MapPin size={14} />
                <span>Xem trên bản đồ</span>
              </button>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className={`msg-time ${isUser ? 'msg-time-right' : ''}`}>
          {formatTime(message.timestamp)}
          {!isUser && response?.metadata && (
            <span className="msg-meta">
              · {Number(response.metadata.processingTimeMs ?? 0) / 1000}s
              · {Number(response.metadata.dataPointsFound ?? 0)} bản ghi
            </span>
          )}
        </div>
      </div>

      {isUser && (
        <div className="msg-avatar msg-avatar-user">
          <User size={18} />
        </div>
      )}

      <style>{`
        .msg-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; align-self: flex-start; margin-top: 4px;
        }
        .msg-avatar-ai { background: #ffffff; border: 1px solid #e4e4e7; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .msg-avatar-user { background: #e4e4e7; color: #52525b; }

        .msg-content-wrap { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; flex: 1; }

        .msg-cards { display: flex; flex-direction: column; gap: 0.5rem; }

        .msg-intent-badge {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.3rem 0.75rem; border-radius: 999px;
          background: #eff6ff; border: 1px solid #bfdbfe;
          color: #1d4ed8; font-size: 0.72rem; font-weight: 600;
        }

        .msg-risk-badge {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.6rem 0.85rem; border-radius: 10px; font-size: 0.8rem;
        }
        .msg-risk-badge strong { display: block; font-size: 0.85rem; }
        .msg-risk-badge em { display: block; opacity: 0.85; font-style: normal; font-size: 0.72rem; }
        .risk-very_low { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
        .risk-low { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
        .risk-medium { background: #fffbeb; border: 1px solid #fde68a; color: #b45309; }
        .risk-high { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
        .risk-critical { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; }

        .msg-warnings { display: flex; flex-direction: column; gap: 0.3rem; }
        .msg-warning-item {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.4rem 0.75rem; border-radius: 8px;
          background: #fffbeb; border: 1px solid #fde68a;
          color: #b45309; font-size: 0.75rem; font-weight: 500;
        }

        .msg-map-btn {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.5rem 1rem; border-radius: 10px;
          background: linear-gradient(135deg, #163c66, #2563a8);
          border: none;
          color: #ffffff; font-size: 0.8rem; font-weight: 600; cursor: pointer;
          transition: all 0.2s; align-self: flex-start;
          box-shadow: 0 2px 6px rgba(37,99,168,0.25);
        }
        .msg-map-btn:hover { background: linear-gradient(135deg, #20538c, #1d4ed8); transform: translateY(-1px); }

        .msg-time { font-size: 0.68rem; color: #64748b; padding: 0 0.25rem; font-weight: 500; }
        .msg-time-right { text-align: right; }
        .msg-meta { color: #64748b; }

        /* Markdown Styling */
        .ai-bubble p { margin-bottom: 0.5rem; }
        .ai-bubble p:last-child { margin-bottom: 0; }
        .ai-bubble ul { list-style-type: disc; margin-left: 1.5rem; margin-bottom: 0.5rem; }
        .ai-bubble ol { list-style-type: decimal; margin-left: 1.5rem; margin-bottom: 0.5rem; }
        .ai-bubble li { margin-bottom: 0.2rem; }
        .ai-bubble strong { font-weight: 600; color: #1e293b; }
        
        .ai-bubble table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.75rem;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .ai-bubble th, .ai-bubble td {
          border: 1px solid #e2e8f0;
          padding: 0.6rem 0.75rem;
          text-align: left;
        }
        .ai-bubble th {
          background: #f8fafc;
          font-weight: 600;
          color: #334155;
          border-bottom: 2px solid #cbd5e1;
        }
        .ai-bubble tr:nth-child(even) { background: #f8fafc; }
      `}</style>
    </div>
  );
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Simple markdown-like text renderer replaced by ReactMarkdown */
function MarkdownText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function getIntentIcon(type: string): string {
  const map: Record<string, string> = {
    SITE_SUITABILITY_ANALYSIS: '🎯',
    QUERY_SALINITY: '🧂',
    QUERY_WATER_QUALITY: '💧',
    QUERY_WEATHER: '🌤',
    FLOOD_RISK_ANALYSIS: '🌊',
    QUERY_MONITORING_DATA: '📡',
    TEMPORAL_ANALYSIS: '📈',
  };
  return map[type] ?? '🔍';
}

function getRiskIcon(level: string): string {
  const map: Record<string, string> = {
    VERY_LOW: '✅', LOW: '✅', MEDIUM: '⚠️', HIGH: '❗', CRITICAL: '🚨',
  };
  return map[level] ?? '⚠️';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
