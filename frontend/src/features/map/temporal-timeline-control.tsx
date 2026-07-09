"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
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
  const [collapsed, setCollapsed] = useState(false);
  const yearDef = buildYearDef(yearValue);
  const dayDef = buildDayDef(dayValue);
  const hourDef = buildHourDef(hourValue);

  const defs: TimelineRowDef[] = [yearDef, dayDef, hourDef];
  const scaleIndex = defs.findIndex((r) => r.scale === activeScale);

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
          <button
            className="ttc-action-btn"
            onClick={() => setCollapsed(!collapsed)}
            type="button"
            title={collapsed ? "Expand all rows" : "Collapse to active row"}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

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
}: {
  def: TimelineRowDef;
  isActive: boolean;
  isApplicable: boolean;
  onActivate: () => void;
  onChange: (value: number) => void;
  isMobile?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
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
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const panAnchor = useRef<{ x: number; start: number } | null>(null);
  const opacity = isActive ? 1 : isApplicable ? 0.5 : 0.3;

  const valueToScreen = useCallback(
    (v: number) => {
      const range = viewState.end - viewState.start;
      if (range <= 0) return 0;
      return ((v - viewState.start) / range) * 100;
    },
    [viewState]
  );

  const screenToViewValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return def.value;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return viewRef.current.start + ratio * (viewRef.current.end - viewRef.current.start);
    },
    [def]
  );

  const clampValue = (v: number) =>
    Math.max(def.fullMin, Math.min(def.fullMax, Math.round(v)));

  const snapHour = (v: number) => Math.round(v);

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive) return;
      e.preventDefault();
      const val = screenToViewValue(e.clientX);
      const selX = valueToScreen(def.value);
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickXPercent = ((e.clientX - rect.left) / rect.width) * 100;

      if (Math.abs(clickXPercent - selX) < 4) {
        setDraggingHandle(true);
        const snapped = def.scale === "hour" ? snapHour(val) : clampValue(val);
        onChange(snapped);
      } else {
        setPanning(true);
        panAnchor.current = { x: e.clientX, start: viewRef.current.start };
      }
    },
    [isActive, def, valueToScreen, screenToViewValue, onChange]
  );

  useEffect(() => {
    if (!draggingHandle && !panning) return;
    const onMove = (e: PointerEvent) => {
      if (draggingHandle) {
        const val = screenToViewValue(e.clientX);
        const snapped = def.scale === "hour" ? snapHour(val) : clampValue(val);
        onChange(snapped);
      }
      if (panning && panAnchor.current) {
        const dx = e.clientX - panAnchor.current.x;
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const range = viewRef.current.end - viewRef.current.start;
        const shift = -(dx / rect.width) * range;
        let newStart = panAnchor.current.start + shift;
        if (newStart < def.fullMin) newStart = def.fullMin;
        if (newStart + range > def.fullMax) newStart = def.fullMax - range;
        setViewState((prev) => {
          const r = prev.end - prev.start;
          let s = newStart;
          if (s < def.fullMin) s = def.fullMin;
          if (s + r > def.fullMax) s = def.fullMax - r;
          return { start: Math.floor(s), end: Math.floor(s + r) };
        });
      }
    };
    const onUp = () => {
      setDraggingHandle(false);
      setPanning(false);
      panAnchor.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingHandle, panning, def, screenToViewValue, onChange]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;
      const val = screenToViewValue(e.clientX);
      const snapped = def.scale === "hour" ? snapHour(val) : clampValue(val);
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverValue(snapped);
      setHoverX(ratio * 100);
    },
    [def, screenToViewValue, clampValue]
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive) return;
      const val = screenToViewValue(e.clientX);
      const snapped = def.scale === "hour" ? snapHour(val) : clampValue(val);
      onChange(snapped);
    },
    [isActive, def, screenToViewValue, onChange]
  );

  const zoomView = useCallback(
    (factor: number) => {
      setViewState((prev) => {
        const range = prev.end - prev.start;
        const newRange = Math.max(def.minWindow, range * factor);
        const center = (prev.start + prev.end) / 2;
        let start = center - newRange / 2;
        let end = center + newRange / 2;
        if (start < def.fullMin) {
          end += def.fullMin - start;
          start = def.fullMin;
        }
        if (end > def.fullMax) {
          start -= end - def.fullMax;
          end = def.fullMax;
        }
        if (start < def.fullMin) start = def.fullMin;
        if (end - def.fullMin < def.minWindow) end = def.fullMin + def.minWindow;
        return { start: Math.floor(start), end: Math.ceil(end) };
      });
    },
    [def]
  );

  const selectedX = valueToScreen(def.value);
  const canPanLeft = viewState.start > def.fullMin;
  const canPanRight = viewState.end < def.fullMax;

  const isInView = (v: number) => v >= viewState.start && v <= viewState.end;

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
            className="ttc-ruler-svg"
            viewBox={`0 0 1000 ${isActive ? 32 : 12}`}
            preserveAspectRatio="none"
          >
            {/* Major ticks */}
            {def.majorTicks.map((v) =>
              isInView(v) ? (
                <g key={`maj-${v}`}>
                  <line
                    x1={valueToScreen(v) * 10}
                    y1={isActive ? 32 - majorH : 12 - majorH}
                    x2={valueToScreen(v) * 10}
                    y2={12}
                    stroke={Math.abs(v - def.value) < 0.1 ? "#2f65b0" : isActive ? "#64748b" : "#94a3b8"}
                    strokeWidth={isActive ? 1.2 : 0.8}
                    shapeRendering="crispEdges"
                  />
                  {isActive && (
                    <text
                      x={valueToScreen(v) * 10}
                      y={8}
                      textAnchor="middle"
                      fontSize="7"
                      fill="#475569"
                      fontFamily="system-ui"
                    >
                      {def.formatTick(v)}
                    </text>
                  )}
                </g>
              ) : null
            )}
            {/* Medium ticks */}
            {def.mediumTicks.map((v) =>
              isInView(v) ? (
                <line
                  key={`med-${v}`}
                  x1={valueToScreen(v) * 10}
                  y1={isActive ? 32 - midH : 12 - midH}
                  x2={valueToScreen(v) * 10}
                  y2={12}
                  stroke={isActive ? "#94a3b8" : "#cbd5e1"}
                  strokeWidth={0.6}
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
                  y1={isActive ? 32 - minorH : 12 - minorH}
                  x2={valueToScreen(v) * 10}
                  y2={12}
                  stroke={isActive ? "#cbd5e1" : "#e2e8f0"}
                  strokeWidth={0.4}
                  shapeRendering="crispEdges"
                />
              ) : null
            )}
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

        {isActive && (
          <div className="ttc-range-hint">
            <span>{def.formatTick(viewState.start)}</span>
            <div className="ttc-zoom-btns">
              <button
                className="ttc-zoom-btn"
                onClick={() => zoomView(2)}
                type="button"
                title="Zoom in"
              >
                <ZoomIn size={11} />
              </button>
              <button
                className="ttc-zoom-btn"
                onClick={() => zoomView(0.5)}
                type="button"
                title="Zoom out"
              >
                <ZoomOut size={11} />
              </button>
            </div>
            <span>{def.formatTick(viewState.end)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
