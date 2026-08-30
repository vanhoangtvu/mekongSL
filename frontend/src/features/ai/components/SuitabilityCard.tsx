'use client';

import React, { useState } from 'react';
import type { SuitabilityResult } from '../types/ai-types';

interface SuitabilityCardProps {
  result: SuitabilityResult;
}

export function SuitabilityCard({ result }: SuitabilityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const score = result.totalScore;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 30;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="suit-card">
      {/* Score circle */}
      <div className="suit-header">
        <div className="suit-circle-wrap">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="30" fill="none"
              stroke={color} strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="suit-score-label" style={{ color }}>
            <strong>{score.toFixed(0)}</strong>
            <span>/100</span>
          </div>
        </div>
        <div className="suit-summary">
          <div className="suit-title">Suitability Score</div>
          <div className="suit-class" style={{ color }}>{result.classification}</div>
          <div className="suit-activity">🌾 {result.activity || 'Chung'}</div>
          {!result.hasEnoughData && (
            <div className="suit-warn">⚠️ Thiếu dữ liệu ({Math.round(result.totalWeightUsed * 100)}% weight)</div>
          )}
        </div>
        <button className="suit-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Detail rows */}
      {expanded && result.criterionScores && result.criterionScores.length > 0 && (
        <div className="suit-details">
          {result.criterionScores.map((cs) => {
            const c = cs.score >= 80 ? '#10b981' : cs.score >= 60 ? '#3b82f6' : cs.score >= 40 ? '#f59e0b' : '#ef4444';
            return (
              <div key={cs.criterion} className="suit-row">
                <span className="suit-row-name">{CRITERION_LABELS[cs.criterion] || cs.criterion}</span>
                <div className="suit-row-bar-wrap">
                  <div className="suit-row-bar" style={{ width: `${cs.score}%`, background: c }} />
                </div>
                <span className="suit-row-score" style={{ color: c }}>{cs.score.toFixed(0)}</span>
                <span className="suit-row-raw">({cs.rawValue.toFixed(1)}{getUnit(cs.criterion)})</span>
              </div>
            );
          })}
          {result.missingData && result.missingData.length > 0 && (
            <div className="suit-missing">
              Thiếu dữ liệu: {result.missingData.join(', ')}
            </div>
          )}
        </div>
      )}

      <style>{`
        .suit-card {
          background: #ffffff; border: 1px solid #e2e8f0;
          border-radius: 14px; padding: 1rem; overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .suit-header { display: flex; align-items: center; gap: 1rem; }
        .suit-circle-wrap { position: relative; flex-shrink: 0; }
        .suit-score-label {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .suit-score-label strong { font-size: 1.25rem; font-weight: 800; line-height: 1; }
        .suit-score-label span { font-size: 0.6rem; opacity: 0.7; }
        .suit-summary { flex: 1; min-width: 0; }
        .suit-title { font-size: 0.72rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .suit-class { font-size: 0.9rem; font-weight: 700; margin: 0.1rem 0; }
        .suit-activity { font-size: 0.75rem; color: #334155; font-weight: 500; }
        .suit-warn { font-size: 0.72rem; color: #d97706; margin-top: 0.25rem; font-weight: 600; }
        .suit-toggle {
          background: #f1f5f9; border: 1px solid #cbd5e1;
          border-radius: 8px; padding: 0.35rem 0.6rem; color: #475569;
          cursor: pointer; font-size: 0.75rem; flex-shrink: 0;
          transition: all 0.2s;
        }
        .suit-toggle:hover { background: #e2e8f0; color: #0f172a; }
        .suit-details {
          margin-top: 0.85rem; padding-top: 0.85rem;
          border-top: 1px solid #e2e8f0;
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .suit-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; }
        .suit-row-name { min-width: 95px; flex-shrink: 0; color: #1e293b; font-weight: 600; }
        .suit-row-bar-wrap { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .suit-row-bar { height: 100%; border-radius: 3px; transition: width 0.8s ease; }
        .suit-row-score { width: 28px; text-align: right; font-weight: 700; }
        .suit-row-raw { color: #64748b; font-size: 0.7rem; }
        .suit-missing { font-size: 0.72rem; color: #d97706; font-style: italic; margin-top: 0.25rem; }
      `}</style>
    </div>
  );
}

const CRITERION_LABELS: Record<string, string> = {
  salinity: 'Độ mặn', ph: 'pH', water_quality: 'Chất lượng nước',
  landuse: 'Sử dụng đất', water_access: 'Nguồn nước', flood_risk: 'Lũ lụt',
  do: 'Oxy hòa tan', temperature: 'Nhiệt độ',
};

function getUnit(criterion: string): string {
  const map: Record<string, string> = {
    salinity: '‰', ph: '', do: 'mg/L', temperature: '°C',
  };
  return map[criterion] ?? '';
}
