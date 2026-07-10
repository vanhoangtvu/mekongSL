"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { TimeScale } from "../../lib/constants/datasets";

type TimelineRowDef = {
  scale: TimeScale;
  label: string;
  icon: React.ReactNode;
  value: number;
  fullMin: number;
  fullMax: number;
  majorTicks: number[];
  mediumTicks: number[];
  minorTicks: number[];
  formatTick: (v: number) => string;
  formatSelected: (v: number) => string;
  defaultWindow: number;
  minWindow: number;
};

function buildYearDef(yearValue: number): TimelineRowDef {
  const major = [1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026];
  const minor: number[] = [];
  for (let y = 1994; y <= 2026; y++) if (!major.includes(y)) minor.push(y);
  return {
    scale: "year",
    label: "Year",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>Y</span>,
    value: yearValue,
    fullMin: 1994,
    fullMax: 2026,
    majorTicks: major,
    mediumTicks: [],
    minorTicks: minor,
    formatTick: (v) => `${v}`,
    formatSelected: (v) => `${v}`,
    defaultWindow: 12,
    minWindow: 4,
  };
}

function buildDayDef(dateStr: string): TimelineRowDef {
  const parts = dateStr ? dateStr.split("-").map(Number) : [1, 1];
  const month = parts[0] || 1;
  const day = parts[1] || 1;
  const dayOfYear = Math.floor(
    (new Date(2024, month - 1, day).getTime() - new Date(2024, 0, 0).getTime()) / 86400000
  );
  const major: number[] = [];
  for (let m = 0; m < 12; m++)
    major.push(
      Math.floor(
        (new Date(2024, m, 1).getTime() - new Date(2024, 0, 0).getTime()) / 86400000
      ) + 1
    );
  const medium: number[] = [];
  for (let d = 7; d <= 365; d += 7) medium.push(d);
  const minor: number[] = [];
  for (let d = 1; d <= 365; d++)
    if (!medium.includes(d) && !major.includes(d)) minor.push(d);

  return {
    scale: "day",
    label: "Day",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>D</span>,
    value: dayOfYear,
    fullMin: 1,
    fullMax: 365,
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
    defaultWindow: 90,
    minWindow: 14,
  };
}

function buildHourDef(hourStr: string): TimelineRowDef {
  const hour = parseInt(hourStr || "0", 10);
  const major = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const medium: number[] = [];
  for (let h = 0; h <= 24; h++) if (!major.includes(h)) medium.push(h);
  const minor: number[] = [];
  for (let h = 0; h < 24; h++) minor.push(h + 0.5);
  return {
    scale: "hour",
    label: "Hour",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>H</span>,
    value: hour,
    fullMin: 0,
    fullMax: 24,
    majorTicks: major,
    mediumTicks: medium,
    minorTicks: minor,
    formatTick: (v) =>
      `${String(Math.floor(v)).padStart(2, "0")}:${v === Math.floor(v) ? "00" : "30"}`,
    formatSelected: (v) =>
      `${String(Math.floor(v)).padStart(2, "0")}:00`,
    defaultWindow: 8,
    minWindow: 2,
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
  onTimeLapse: () => void;
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
  onTimeLapse,
  isMobile,
}: TemporalTimelineControlProps) {
  const [collapsed, setCollapsed] = useState(true);
  const yearDef = buildYearDef(yearValue);
  const dayDef = buildDayDef(dayValue);
  const hourDef = buildHourDef(hourValue);

  const defs: TimelineRowDef[] = [yearDef, dayDef, hourDef];
  const scaleIndex = defs.findIndex((r) => r.scale === activeScale);

  return (
    <div className="ttc-card">
      <div className={`ttc-rows ${collapsed ? "ttc-rows--collapsed" : ""}`}>
        {defs.map((def, idx) => {
          const isActive = idx === scaleIndex;
          const isApplicable = applicableScales.includes(def.scale);
          if (collapsed && !isActive) return null;
          return (
            <TimelineRuler
              key={def.scale}
              def={def}
              isActive={isActive}
              isApplicable={isApplicable}
              onActivate={() => onScaleChange(def.scale)}
              onChange={(v) => {
                if (def.scale === "year") onYearChange(v);
                else if (def.scale === "day") {
                  const d = new Date(2024, 0, v);
                  onDayChange(d.getMonth() + 1, d.getDate());
                } else if (def.scale === "hour") {
                  onHourChange(v);
                }
              }}
              isMobile={isMobile}
              onTimeLapse={onTimeLapse}
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed(!collapsed)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TimelineRuler({
  def,
  isActive,
  isApplicable,
  onActivate,
  onChange,
  isMobile,
  onTimeLapse,
  collapsed,
  onToggleCollapse,
}: {
  def: TimelineRowDef;
  isActive: boolean;
  isApplicable: boolean;
  onActivate: () => void;
  onChange: (value: number) => void;
  isMobile?: boolean;
  onTimeLapse: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef({ start: 0, end: 0 });

  const [viewState, setViewState] = useState(() => {
    const center = def.value;
    const half = def.defaultWindow / 2;
    let start = center - half;
    let end = center + half;
    if (start < def.fullMin) {
      end += def.fullMin - start;
      start = def.fullMin;
    }
    if (end > def.fullMax) {
      start -= end - def.fullMax;
      end = def.fullMax;
    }
    if (start < def.fullMin) start = def.fullMin;
    return { start: Math.floor(start), end: Math.ceil(end) };
  });

  viewRef.current = viewState;

  const [draggingHandle, setDraggingHandle] = useState(false);
  const [panning, setPanning] = useState(false);
  const panAnchor = useRef<{ x: number; start: number } | null>(null);

  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const opacity = isActive ? 1 : isApplicable ? 0.5 : 0.3;

  const valueToScreen = useCallback((v: number) => {
    const range = viewRef.current.end - viewRef.current.start;
    if (range <= 0) return 0;
    return ((v - viewRef.current.start) / range) * 100;
  }, []);

  const selectedX = valueToScreen(def.value);
  const canPanLeft = viewRef.current.start > def.fullMin;
  const canPanRight = viewRef.current.end < def.fullMax;

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive) return;
      e.preventDefault();
      const selX = valueToScreen(def.value);
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickXPercent = ((e.clientX - rect.left) / rect.width) * 100;

      if (Math.abs(clickXPercent - selX) < 15) {
        setDraggingHandle(true);
      } else {
        setPanning(true);
        panAnchor.current = { x: e.clientX, start: viewRef.current.start };
      }
    },
    [isActive, def, valueToScreen]
  );

  useEffect(() => {
    if (!draggingHandle && !panning) return;

    const onMove = (e: PointerEvent) => {
      if (panning && panAnchor.current) {
        const dx = e.clientX - panAnchor.current.x;
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const r = viewRef.current.end - viewRef.current.start;
        const shift = -(dx / rect.width) * r;
        let newStart = panAnchor.current.start + shift;
        if (newStart < def.fullMin) newStart = def.fullMin;
        if (newStart + r > def.fullMax) newStart = def.fullMax - r;

        viewRef.current = { start: newStart, end: newStart + r };

        if (svgRef.current) {
          svgRef.current.style.transform = `translateX(${dx}px)`;
          svgRef.current.style.willChange = 'transform';
        }
      }

      if (draggingHandle) {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const val = viewRef.current.start + ratio * (viewRef.current.end - viewRef.current.start);
        const snapped = Math.round(val);
        onChange(Math.max(def.fullMin, Math.min(def.fullMax, snapped)));
      }
    };

    const onUp = () => {
      if (svgRef.current) {
        svgRef.current.style.transform = '';
        svgRef.current.style.willChange = '';
      }
      setDraggingHandle(false);
      setPanning(false);
      panAnchor.current = null;
      setViewState({
        start: Math.floor(viewRef.current.start),
        end: Math.ceil(viewRef.current.end),
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (svgRef.current) {
        svgRef.current.style.transform = '';
        svgRef.current.style.willChange = '';
      }
    };
  }, [draggingHandle, panning, def, onChange]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const val = viewRef.current.start + ratio * (viewRef.current.end - viewRef.current.start);
      const snapped = Math.max(def.fullMin, Math.min(def.fullMax, Math.round(val)));
      setHoverValue(snapped);
      setHoverX(ratio * 100);
    },
    [def]
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const val = viewRef.current.start + ratio * (viewRef.current.end - viewRef.current.start);
      const snapped = Math.max(def.fullMin, Math.min(def.fullMax, Math.round(val)));
      onChange(snapped);
    },
    [isActive, def, onChange]
  );

  const isInView = (v: number) => {
    const pad = (viewRef.current.end - viewRef.current.start) * 0.5;
    return v >= viewRef.current.start - pad && v <= viewRef.current.end + pad;
  };

  const majorH = isActive ? 40 : 10;
  const midH = isActive ? 28 : 7;
  const minorH = isActive ? 18 : 5;
  const BASELINE = isActive ? 24 : 6;
  const HALF_MAJOR = majorH / 2;
  const HALF_MID = midH / 2;
  const HALF_MINOR = minorH / 2;

  return (
    <div
      className={`ttc-row ${isActive ? "ttc-row--active" : ""} ${isApplicable ? "" : "ttc-row--disabled"}`}
      style={{ opacity }}
    >
      <button
        className="ttc-row-toggle"
        onClick={onActivate}
        type="button"
        title={`Activate ${def.label} timeline`}
      >
        <span className="ttc-row-icon">{def.icon}</span>
        <span className="ttc-row-label">{def.label}</span>
        {!isActive && <ChevronDown size={10} className="ttc-chevron" />}
      </button>

      <div className="ttc-ruler-wrap" ref={trackRef}>
        {isActive && (
          <div className="ttc-selected-bubble" style={{ left: `${selectedX}%` }}>
            {def.formatSelected(def.value)}
          </div>
        )}

        {hoverValue !== null && isActive && (
          <div className="ttc-hover-bubble" style={{ left: `${hoverX}%` }}>
            {def.formatSelected(hoverValue)}
          </div>
        )}

        <div
          className={`ttc-ruler-track ${panning ? "ttc-ruler-track--panning" : ""}`}
          onClick={handleTrackClick}
          onPointerDown={handleTrackPointerDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverValue(null)}
        >
          {isActive && canPanLeft && <div className="ttc-fade ttc-fade--left" />}
          {isActive && canPanRight && <div className="ttc-fade ttc-fade--right" />}
          {/* Pan arrows */}
          {isActive && canPanLeft && (
            <div className="ttc-pan-hint ttc-pan-hint--left">
              <ChevronLeft size={12} />
            </div>
          )}
          {isActive && canPanRight && (
            <div className="ttc-pan-hint ttc-pan-hint--right">
              <ChevronRight size={12} />
            </div>
          )}

          <svg
            ref={svgRef}
            className="ttc-ruler-svg"
            viewBox={`0 0 1000 ${isActive ? 48 : 12}`}
            preserveAspectRatio="none"
          >
            {/* Major ticks */}
            {def.majorTicks.map((v) =>
              isInView(v) ? (
                <line
                  key={`maj-${v}`}
                  x1={valueToScreen(v) * 10}
                  y1={BASELINE - HALF_MAJOR}
                  x2={valueToScreen(v) * 10}
                  y2={BASELINE + HALF_MAJOR}
                  stroke={Math.abs(v - def.value) < 0.1 ? "#2f65b0" : isActive ? "#64748b" : "#94a3b8"}
                  strokeWidth={isActive ? 2 : 0.8}
                  shapeRendering="crispEdges"
                />
              ) : null
            )}
            {/* Medium ticks */}
            {def.mediumTicks.map((v) =>
              isInView(v) ? (
                <line
                  key={`med-${v}`}
                  x1={valueToScreen(v) * 10}
                  y1={BASELINE - HALF_MID}
                  x2={valueToScreen(v) * 10}
                  y2={BASELINE + HALF_MID}
                  stroke={isActive ? "#94a3b8" : "#cbd5e1"}
                  strokeWidth={isActive ? 1.2 : 0.6}
                  shapeRendering="crispEdges"
                />
              ) : null
            )}
            {/* Minor ticks */}
            {def.minorTicks.map((v) =>
              isInView(v) ? (
                <line
                  key={`min-${v}`}
                  x1={valueToScreen(v) * 10}
                  y1={BASELINE - HALF_MINOR}
                  x2={valueToScreen(v) * 10}
                  y2={BASELINE + HALF_MINOR}
                  stroke={isActive ? "#cbd5e1" : "#e2e8f0"}
                  strokeWidth={isActive ? 0.8 : 0.4}
                  shapeRendering="crispEdges"
                />
              ) : null
            )}
            {/* Top boundary */}
            {isActive && (
              <line x1={0} y1={0} x2={1000} y2={0} stroke="#cbd5e1" strokeWidth={0.5} shapeRendering="crispEdges" />
            )}
            {/* Baseline glow (depth effect) */}
            {isActive && (
              <line
                x1={0} y1={BASELINE} x2={1000} y2={BASELINE}
                stroke="rgba(51, 65, 85, 0.08)"
                strokeWidth={8}
                shapeRendering="crispEdges"
              />
            )}
            {/* Baseline */}
            <line
              x1={0}
              y1={BASELINE}
              x2={1000}
              y2={BASELINE}
              stroke={isActive ? "#334155" : "#cbd5e1"}
              strokeWidth={isActive ? 5 : 0.8}
              shapeRendering="crispEdges"
            />
            {/* Bottom boundary */}
            {isActive && (
              <line x1={0} y1={48} x2={1000} y2={48} stroke="#cbd5e1" strokeWidth={0.5} shapeRendering="crispEdges" />
            )}
            {/* Selection marker */}
            {isActive && (
              <g>
                {/* Selection pillar (full height highlight) */}
                <line
                  x1={selectedX * 10}
                  y1={0}
                  x2={selectedX * 10}
                  y2={48}
                  stroke="#2f65b0"
                  strokeWidth={4}
                  strokeOpacity={0.18}
                  shapeRendering="crispEdges"
                />
                {/* Selection line */}
                <line
                  x1={selectedX * 10}
                  y1={0}
                  x2={selectedX * 10}
                  y2={48}
                  stroke="#2f65b0"
                  strokeWidth={2.5}
                  shapeRendering="crispEdges"
                />
                {/* Thermometer bulb */}
                <circle cx={selectedX * 10} cy={BASELINE} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
              </g>
            )}
          </svg>
        </div>

        {isActive && (
          <div className="ttc-range-hint">
            <span>{def.formatTick(viewState.start)}</span>
            <div className="ttc-range-bar">
              <div
                className="ttc-range-bar-fill"
                style={{
                  left: `${((viewState.start - def.fullMin) / (def.fullMax - def.fullMin)) * 100}%`,
                  width: `${((viewState.end - viewState.start) / (def.fullMax - def.fullMin)) * 100}%`,
                }}
              />
            </div>
            <span>{def.formatTick(viewState.end)}</span>
          </div>
        )}
      </div>

      {isActive && (
        <div className="ttc-row-actions">
          <button
            className="ttc-action-btn ttc-action-play"
            onClick={onTimeLapse}
            type="button"
            title="Time-Lapse"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
          <button
            className="ttc-action-btn"
            onClick={onToggleCollapse}
            type="button"
            title={collapsed ? "Expand all rows" : "Collapse to active row"}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
