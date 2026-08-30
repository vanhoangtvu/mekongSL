'use client';

import React, { useState } from 'react';
import type { ExecutionStep } from '../types/ai-types';
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Circle, Zap } from 'lucide-react';

interface ExecutionStepsPanelProps {
  steps?: ExecutionStep[];
}

export function ExecutionStepsPanel({ steps }: ExecutionStepsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="exec-panel">
      <button className="exec-header" onClick={() => setExpanded((v) => !v)}>
        <div className="exec-header-left">
          <Zap size={14} className="exec-pulse-icon" />
          <span className="exec-header-title">
            Đã hoàn tất {steps.length} bước phân tích
          </span>
        </div>
        {expanded ? <ChevronUp size={16} className="exec-toggle-icon" /> : <ChevronDown size={16} className="exec-toggle-icon" />}
      </button>

      {expanded && (
        <div className="exec-body">
          <div className="exec-timeline">
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1;
              return (
                <div key={idx} className="exec-step-item">
                  <div className="exec-step-icon-col">
                    {step.status === 'SUCCESS' ? (
                      <CheckCircle2 size={16} className="text-emerald-500 bg-white" />
                    ) : step.status === 'WARNING' ? (
                      <AlertCircle size={16} className="text-amber-500 bg-white" />
                    ) : (
                      <Circle size={14} className="text-gray-300 bg-white" />
                    )}
                    {!isLast && <div className="exec-step-line" />}
                  </div>
                  <div className="exec-step-content">
                    <div className="exec-step-title">{step.title}</div>
                    <div className="exec-step-detail">{step.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .exec-panel {
          margin-bottom: 1rem;
          font-family: inherit;
          max-width: 500px;
        }
        .exec-header {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.75rem;
          background: #f4f4f5;
          border: 1px solid #e4e4e7;
          border-radius: 999px;
          color: #52525b;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .exec-header:hover {
          background: #e4e4e7;
          color: #27272a;
        }
        .exec-header-left {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .exec-pulse-icon {
          color: #71717a;
        }
        .exec-toggle-icon {
          color: #a1a1aa;
        }
        .exec-body {
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: #fafafa;
          border: 1px solid #f4f4f5;
          border-radius: 12px;
        }
        .exec-timeline {
          display: flex;
          flex-direction: column;
        }
        .exec-step-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          min-height: 2.5rem;
        }
        .exec-step-icon-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 16px;
          height: 100%;
        }
        .exec-step-line {
          width: 2px;
          flex-grow: 1;
          background: #e4e4e7;
          margin-top: 4px;
          margin-bottom: 4px;
          min-height: 16px;
        }
        .text-emerald-500 { color: #10b981; }
        .text-amber-500 { color: #f59e0b; }
        .text-gray-300 { color: #d4d4d8; }
        .bg-white { background: #fafafa; }
        
        .exec-step-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-bottom: 1rem;
        }
        .exec-step-item:last-child .exec-step-content {
          padding-bottom: 0;
        }
        .exec-step-title {
          font-weight: 600;
          color: #27272a;
          font-size: 0.75rem;
          line-height: 1.2;
          margin-top: 1px;
        }
        .exec-step-detail {
          color: #71717a;
          font-size: 0.7rem;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
