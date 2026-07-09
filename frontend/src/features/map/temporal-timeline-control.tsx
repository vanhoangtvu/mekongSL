"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { Play, Pause, ChevronDown, Clock, Plus, Minus } from "lucide-react";
import type { TimeScale } from "../../lib/constants/datasets";

type TimelineRow = {
  scale: TimeScale;
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  majorTicks: number[];
  mediumTicks: number[];
  minorTicks: number[];
  formatTick: (v: number) => string;
  formatSelected: (v: number) => string;
};

function buildYearRow(yearValue: number): TimelineRow {
  const major = [1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026];
  const medium: number[] = [];
  for (let y = 1994; y <= 2026; y++) if (!major.includes(y)) medium.push(y);
  return {
    scale: "year",
    label: "Year",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>Y</span>,
    value: yearValue,
    min: 1994,
    max: 2026,
    majorTicks: major,
    mediumTicks: [],
    minorTicks: medium,
    formatTick: (v) => `${v}`,
    formatSelected: (v) => `${v}`,
  };
}

function buildDayRow(dateStr: string): TimelineRow {
  const parts = dateStr ? dateStr.split("-").map(Number) : [1, 1];
  const month = parts[0] || 1;
  const day = parts[1] || 1;
  const dayOfYear = Math.floor((new Date(2024, month - 1, day).getTime() - new Date(2024, 0, 0).getTime()) / 86400000);
  const major: number[] = [];
  for (let m = 1; m <= 12; m++) major.push(Math.floor((new Date(2024, m - 1, 1).getTime() - new Date(2024, 0, 0).getTime()) / 86400000));
  const medium: number[] = [];
  for (let d = 1; d <= 365; d += 7) medium.push(d);
  const minor: number[] = [];
  for (let d = 1; d <= 365; d++) if (!medium.includes(d) && !major.includes(d)) minor.push(d);

  return {
    scale: "day",
    label: "Day",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>D</span>,
    value: dayOfYear,
    min: 1,
    max: 365,
    majorTicks: major,
    mediumTicks: medium,
    minorTicks: minor,
    formatTick: (v) => {
      const d = new Date(2024, 0, v);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    },
    formatSelected: (v) => {
      const d = new Date(2024, 0, v);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    },
  };
}

function buildHourRow(hourStr: string): TimelineRow {
  const hour = parseInt(hourStr || "0", 10);
  const major = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const medium: number[] = [];
  for (let h = 0; h <= 24; h++) if (!major.includes(h)) medium.push(h);
  const minor: number[] = [];
  for (let h = 0; h < 24; h++) { minor.push(h + 0.5); }
  return {
    scale: "hour",
    label: "Hour",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>H</span>,
    value: hour,
    min: 0,
    max: 24,
    majorTicks: major,
    mediumTicks: medium,
    minorTicks: minor,
    formatTick: (v) => `${String(Math.floor(v)).padStart(2, "0")}:${v === Math.floor(v) ? "00" : "30"}`,
    formatSelected: (v) => `${String(Math.floor(v)).padStart(2, "0")}:00`,
  };
}

interface TemporalTimelineControlProps {
  activeScale: TimeScale;
  yearValue: number;
  dayValue: string;
  hourValue: string;
  applicableScales: TimeScale[];
  onYearChange: (year: number) => void;
  onDayChange: (month: number, day: number) => void;
  onHourChange: (hour: number) => void;
  onScaleChange: (scale: TimeScale) => void;
  onPlayPause: () => void;
  onTimeLapse: () => void;
  isPlaying: boolean;
  isMobile?: boolean;
}

export function TemporalTimelineControl({
  activeScale,
  yearValue,
  dayValue,
  hourValue,
  applicableScales,
  onYearChange,
  onDayChange,
  onHourChange,
  onScaleChange,
  onPlayPause,
  onTimeLapse,
  isPlaying,
  isMobile,
}: TemporalTimelineControlProps) {
  const yearRow = buildYearRow(yearValue);
  const dayRow = buildDayRow(dayValue);
  const hourRow = buildHourRow(hourValue);

  const rows: TimelineRow[] = [yearRow, dayRow, hourRow];
  const scaleIndex = rows.findIndex((r) => r.scale === activeScale);

  return (
    <div className="ttc-card">
      <div className="ttc-header">
        <Clock size={14} />
        <span className="ttc-header-label">Timeline</span>
        <div className="ttc-header-actions">
          <button
            className="ttc-action-btn"
            onClick={onTimeLapse}
            type="button"
            title="Time-Lapse"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
          <button
            className="ttc-action-btn"
            onClick={onPlayPause}
            type="button"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
          </button>
        </div>
      </div>

      <div className="ttc-rows">
        {rows.map((row, idx) => {
          const isActive = idx === scaleIndex;
          const isApplicable = applicableScales.includes(row.scale);
          return (
            <TimelineRuler
              key={row.scale}
              row={row}
              isActive={isActive}
              isApplicable={isApplicable}
              onActivate={() => onScaleChange(row.scale)}
              onChange={(v) => {
                if (row.scale === "year") onYearChange(v);
                else if (row.scale === "day") {
                  const d = new Date(2024, 0, v);
                  onDayChange(d.getMonth() + 1, d.getDate());
                } else if (row.scale === "hour") {
                  onHourChange(v);
                }
              }}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}

function TimelineRuler({
  row,
  isActive,
  isApplicable,
  onActivate,
  onChange,
  isMobile,
}: {
  row: TimelineRow;
  isActive: boolean;
  isApplicable: boolean;
  onActivate: () => void;
  onChange: (value: number) => void;
  isMobile?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const opacity = isActive ? 1 : isApplicable ? 0.5 : 0.3;

  const valueToX = useCallback(
    (v: number) => ((v - row.min) / (row.max - row.min)) * 100,
    [row.min, row.max]
  );

  const xToValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return row.value;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = row.min + ratio * (row.max - row.min);
      if (row.scale === "hour") return Math.round(raw);
      return Math.round(raw);
    },
    [row]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const val = row.scale === "hour"
        ? Math.round(row.min + ratio * (row.max - row.min))
        : Math.round(row.min + ratio * (row.max - row.min));
      setHoverValue(val);
      setHoverX(ratio * 100);
    },
    [row]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      const val = xToValue(e.clientX);
      onChange(val);
    },
    [isActive, xToValue, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const val = xToValue(e.clientX);
      onChange(val);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, xToValue, onChange]);

  const selectedX = valueToX(row.value);

  const trackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return;
      const val = xToValue(e.clientX);
      onChange(val);
    },
    [isActive, xToValue, onChange]
  );

  const tickH = isActive ? 28 : 8;
  const majorH = isActive ? 28 : 10;
  const midH = isActive ? 18 : 7;
  const minorH = isActive ? 10 : 5;

  return (
    <div
      className={`ttc-row ${isActive ? "ttc-row--active" : ""} ${isApplicable ? "" : "ttc-row--disabled"}`}
      style={{ opacity }}
    >
      <button
        className="ttc-row-toggle"
        onClick={onActivate}
        type="button"
        title={`Activate ${row.label} timeline`}
      >
        <span className="ttc-row-icon">{row.icon}</span>
        <span className="ttc-row-label">{row.label}</span>
        {!isActive && (
          <ChevronDown size={10} className="ttc-chevron" />
        )}
      </button>

      <div className="ttc-ruler-wrap" ref={trackRef}>
        {isActive && (
          <div className="ttc-selected-bubble" style={{ left: `${selectedX}%` }}>
            {row.formatSelected(row.value)}
          </div>
        )}

        {hoverValue !== null && isActive && (
          <div className="ttc-hover-bubble" style={{ left: `${hoverX}%` }}>
            {row.formatSelected(hoverValue)}
          </div>
        )}

        <div
          className="ttc-ruler-track"
          onClick={trackClick}
          onPointerDown={handlePointerDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverValue(null)}
        >
          <svg
            className="ttc-ruler-svg"
            viewBox={`0 0 1000 ${isActive ? 32 : 12}`}
            preserveAspectRatio="none"
          >
            {/* Major ticks */}
            {row.majorTicks.map((v) => (
              <g key={`maj-${v}`}>
                <line
                  x1={valueToX(v) * 10}
                  y1={isActive ? 32 - majorH : 12 - majorH}
                  x2={valueToX(v) * 10}
                  y2={12}
                  stroke={Math.abs(v - row.value) < 0.1 ? "#2f65b0" : isActive ? "#64748b" : "#94a3b8"}
                  strokeWidth={isActive ? 1.2 : 0.8}
                  shapeRendering="crispEdges"
                />
                {isActive && (
                  <text
                    x={valueToX(v) * 10}
                    y={8}
                    textAnchor="middle"
                    fontSize="7"
                    fill="#475569"
                    fontFamily="system-ui"
                  >
                    {row.formatTick(v)}
                  </text>
                )}
              </g>
            ))}
            {/* Medium ticks */}
            {row.mediumTicks.map((v) => (
              <line
                key={`med-${v}`}
                x1={valueToX(v) * 10}
                y1={isActive ? 32 - midH : 12 - midH}
                x2={valueToX(v) * 10}
                y2={12}
                stroke={isActive ? "#94a3b8" : "#cbd5e1"}
                strokeWidth={0.6}
                shapeRendering="crispEdges"
              />
            ))}
            {/* Minor ticks */}
            {row.minorTicks.map((v) => (
              <line
                key={`min-${v}`}
                x1={valueToX(v) * 10}
                y1={isActive ? 32 - minorH : 12 - minorH}
                x2={valueToX(v) * 10}
                y2={12}
                stroke={isActive ? "#cbd5e1" : "#e2e8f0"}
                strokeWidth={0.4}
                shapeRendering="crispEdges"
              />
            ))}
            {/* Baseline */}
            <line
              x1={0}
              y1={12}
              x2={1000}
              y2={12}
              stroke={isActive ? "#94a3b8" : "#cbd5e1"}
              strokeWidth={isActive ? 1 : 0.8}
              shapeRendering="crispEdges"
            />
            {/* Selection marker */}
            {isActive && (
              <g>
                <line
                  x1={selectedX * 10}
                  y1={32 - majorH}
                  x2={selectedX * 10}
                  y2={6}
                  stroke="#2f65b0"
                  strokeWidth={1.8}
                  shapeRendering="crispEdges"
                />
                <circle cx={selectedX * 10} cy={6} r={3} fill="#2f65b0" />
              </g>
            )}
          </svg>
        </div>

        {isActive && !isMobile && (
          <div className="ttc-range-hint">
            <span>{row.formatTick(row.min)}</span>
            <span>{row.formatTick(row.max)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
