"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
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

const BASE_DATE = new Date(1990, 0, 1);

function getInputValueString(def: TimelineRowDef): string {
  if (def.scale === "year") return String(def.value);
  if (def.scale === "day") {
    const d = daysToDate(def.value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const h = ((def.value % 24) + 24) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

function tryParseInputValue(scale: string, input: string, def: TimelineRowDef): number | null {
  if (scale === "year") {
    const year = parseInt(input, 10);
    return isNaN(year) ? null : year;
  }
  if (scale === "day") {
    const d = new Date(input + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    return dateToDays(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  if (scale === "hour") {
    const parts = input.split(":").map(Number);
    if (parts.length < 1 || isNaN(parts[0]) || parts[0] < 0 || parts[0] > 23) return null;
    const baseDay = Math.floor(def.value / 24);
    return baseDay * 24 + parts[0];
  }
  return null;
}

function dateToDays(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day);
  return Math.round((d.getTime() - BASE_DATE.getTime()) / 86400000);
}

function daysToDate(days: number): Date {
  return new Date(BASE_DATE.getTime() + days * 86400000);
}

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

function buildDayDef(dateStr: string, yearValue: number): TimelineRowDef {
  const parts = dateStr ? dateStr.split("-").map(Number) : [1, 1];
  const month = parts[0] || 1;
  const day = parts[1] || 1;
  const absDay = dateToDays(yearValue, month, day);

  // Pre-generate major ticks: start of every month from 1990 to 2026
  const major: number[] = [];
  for (let y = 1990; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      major.push(dateToDays(y, m, 1));
    }
  }

  // Pre-generate medium ticks: 10th and 20th of every month
  const medium: number[] = [];
  for (let y = 1990; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      medium.push(dateToDays(y, m, 10));
      medium.push(dateToDays(y, m, 20));
    }
  }

  return {
    scale: "day",
    label: "Day",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>D</span>,
    value: absDay,
    fullMin: dateToDays(1990, 1, 1),
    fullMax: dateToDays(2026, 12, 31),
    majorTicks: major,
    mediumTicks: medium,
    minorTicks: [],
    formatTick: (v) => {
      const d = daysToDate(v);
      const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${String(d.getDate()).padStart(2, "0")} ${mNames[d.getMonth()]} ${d.getFullYear()}`;
    },
    formatSelected: (v) => {
      const d = daysToDate(v);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    },
    defaultWindow: 30,
    minWindow: 5,
  };
}

function buildHourDef(hourStr: string, dateStr: string, yearValue: number): TimelineRowDef {
  const hour = parseInt(hourStr || "0", 10);
  const parts = dateStr ? dateStr.split("-").map(Number) : [1, 1];
  const month = parts[0] || 1;
  const day = parts[1] || 1;
  const absHour = dateToDays(yearValue, month, day) * 24 + hour;

  const startDay = dateToDays(1990, 1, 1);
  const endDay = dateToDays(2026, 12, 31);

  // Major ticks: start of every day (hour % 24 === 0)
  const major: number[] = [];
  for (let d = startDay; d <= endDay; d++) {
    major.push(d * 24);
  }

  // Medium ticks: every 6 hours
  const medium: number[] = [];
  for (let d = startDay; d <= endDay; d++) {
    medium.push(d * 24 + 6);
    medium.push(d * 24 + 12);
    medium.push(d * 24 + 18);
  }

  return {
    scale: "hour",
    label: "Hour",
    icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>H</span>,
    value: absHour,
    fullMin: startDay * 24,
    fullMax: endDay * 24 + 23,
    majorTicks: major,
    mediumTicks: medium,
    minorTicks: [],
    formatTick: (v) => {
      const h = ((v % 24) + 24) % 24;
      const d = daysToDate(Math.floor(v / 24));
      return `${String(h).padStart(2, "0")}:00 ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    },
    formatSelected: (v) => {
      const h = ((v % 24) + 24) % 24;
      const d = daysToDate(Math.floor(v / 24));
      return `${String(h).padStart(2, "0")}:00 ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    },
    defaultWindow: 12,
    minWindow: 3,
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
  const dayDef = buildDayDef(dayValue, yearValue);
  const hourDef = buildHourDef(hourValue, dayValue, yearValue);

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
                  const d = daysToDate(v);
                  if (d.getFullYear() !== yearValue) {
                    onYearChange(d.getFullYear());
                  }
                  onDayChange(d.getMonth() + 1, d.getDate());
                } else if (def.scale === "hour") {
                  const d = daysToDate(Math.floor(v / 24));
                  const h = ((v % 24) + 24) % 24;
                  if (d.getFullYear() !== yearValue) {
                    onYearChange(d.getFullYear());
                  }
                  const curDayStr = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  if (curDayStr !== dayValue) {
                    onDayChange(d.getMonth() + 1, d.getDate());
                  }
                  onHourChange(h);
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
  const viewRef = useRef({ start: 0, end: 0 });
  const selectedBubbleRef = useRef<HTMLDivElement>(null);
  const hoverBubbleRef = useRef<HTMLDivElement>(null);

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
  const [localInputValue, setLocalInputValue] = useState(() => getInputValueString(def));
  const localInputValueRef = useRef(localInputValue);
  const isEditingRef = useRef(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState("");
  const [pickerTime, setPickerTime] = useState("");
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
      const trackWidth = rect.width - 60;
      const trackLeft = rect.left + 30;
      const clickXPercent = ((e.clientX - trackLeft) / trackWidth) * 100;

      if (Math.abs(clickXPercent - selX) < 15) {
        setDraggingHandle(true);
      } else {
        setPanning(true);
        panAnchor.current = { x: e.clientX, start: viewRef.current.start };
      }
    },
    [isActive, def, valueToScreen]
  );

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const defRef = useRef(def);
  useEffect(() => {
    defRef.current = def;
  }, [def]);

  const lastValueRef = useRef(def.value);
  useEffect(() => {
    const center = def.value;
    const start = viewRef.current.start;
    const end = viewRef.current.end;

    if (center !== lastValueRef.current) {
      lastValueRef.current = center;

      if (center < start || center > end) {
        const half = def.defaultWindow / 2;
        let newStart = center - half;
        let newEnd = center + half;
        if (newStart < def.fullMin) {
          newEnd += def.fullMin - newStart;
          newStart = def.fullMin;
        }
        if (newEnd > def.fullMax) {
          newStart -= newEnd - def.fullMax;
          newEnd = def.fullMax;
        }
        if (newStart < def.fullMin) newStart = def.fullMin;

        viewRef.current = { start: Math.floor(newStart), end: Math.ceil(newEnd) };
        setViewState({ start: Math.floor(newStart), end: Math.ceil(newEnd) });
      }
    }
  }, [def.value, def.defaultWindow, def.fullMin, def.fullMax]);

  useEffect(() => {
    if (!isEditingRef.current) {
      const s = getInputValueString(def);
      localInputValueRef.current = s;
      setLocalInputValue(s);
    }
  }, [def]);

  const handleTimeBoxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    const val = e.target.value;
    localInputValueRef.current = val;
    setLocalInputValue(val);
  }, []);

  const commitTimeBoxValue = useCallback(() => {
    isEditingRef.current = false;
    const currentVal = localInputValueRef.current;
    const parsed = tryParseInputValue(def.scale, currentVal, def);
    if (parsed !== null && parsed >= def.fullMin && parsed <= def.fullMax) {
      onChange(parsed);
    } else {
      const s = getInputValueString(def);
      localInputValueRef.current = s;
      setLocalInputValue(s);
    }
  }, [def, onChange]);

  const handleTimeBoxKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  const openTimePicker = useCallback(() => {
    const baseValue = def.scale === "hour" ? Math.floor(def.value / 24) : def.value;
    const d = daysToDate(baseValue);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setPickerDate(`${y}-${m}-${dd}`);
    if (def.scale === "hour") {
      const h = String(((def.value % 24) + 24) % 24).padStart(2, "0");
      setPickerTime(`${h}:00`);
    }
    setShowTimePicker(true);
  }, [def]);

  const applyTimePicker = useCallback(() => {
    if (!pickerDate) return;
    if (def.scale === "day") {
      const d = new Date(pickerDate + "T00:00:00");
      if (isNaN(d.getTime())) return;
      const days = dateToDays(d.getFullYear(), d.getMonth() + 1, d.getDate());
      onChange(Math.max(def.fullMin, Math.min(def.fullMax, days)));
    } else if (def.scale === "hour") {
      const d = new Date(pickerDate + "T00:00:00");
      if (isNaN(d.getTime())) return;
      const h = parseInt(pickerTime?.split(":")[0] || "0", 10);
      const baseHours = dateToDays(d.getFullYear(), d.getMonth() + 1, d.getDate()) * 24;
      const totalHours = baseHours + Math.max(0, Math.min(23, h));
      onChange(Math.max(def.fullMin, Math.min(def.fullMax, totalHours)));
    }
    setShowTimePicker(false);
  }, [def, pickerDate, pickerTime, onChange]);

  const pointerXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!draggingHandle && !panning) return;

    const onMove = (e: PointerEvent) => {
      if (panning && panAnchor.current) {
        const dx = e.clientX - panAnchor.current.x;
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const trackWidth = rect.width - 60;
        const r = viewRef.current.end - viewRef.current.start;
        const shift = -(dx / trackWidth) * r;
        let newStart = panAnchor.current.start + shift;
        if (newStart < defRef.current.fullMin) newStart = defRef.current.fullMin;
        if (newStart + r > defRef.current.fullMax) newStart = defRef.current.fullMax - r;

        viewRef.current = { start: newStart, end: newStart + r };
        setViewState({
          start: Math.floor(newStart),
          end: Math.ceil(newStart + r),
        });
      }

      if (draggingHandle) {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const trackWidth = rect.width - 60;
        const trackLeft = rect.left + 30;
        const ratio = Math.max(0, Math.min(1, (e.clientX - trackLeft) / trackWidth));
        const val = viewRef.current.start + ratio * (viewRef.current.end - viewRef.current.start);
        const snapped = Math.round(val);
        const visibleMin = Math.floor(viewRef.current.start);
        const visibleMax = Math.ceil(viewRef.current.end);
        const clampedVal = Math.max(visibleMin, Math.min(visibleMax, snapped));
        onChangeRef.current(Math.max(defRef.current.fullMin, Math.min(defRef.current.fullMax, clampedVal)));
        
        const hoverSnapped = Math.max(defRef.current.fullMin, Math.min(defRef.current.fullMax, Math.round(val)));
        setHoverValue(hoverSnapped);
        setHoverX(ratio * 100);

        pointerXRef.current = e.clientX;
      }
    };

    const onUp = () => {
      setDraggingHandle(false);
      setPanning(false);
      panAnchor.current = null;
      pointerXRef.current = null;
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
    };
  }, [draggingHandle, panning]);

  // Autoscroll when dragging handle near edges
  useEffect(() => {
    if (!draggingHandle) return;

    let active = true;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!active) return;
      requestAnimationFrame(loop);

      if (pointerXRef.current === null) return;

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const trackWidth = rect.width - 60;
      const trackLeft = rect.left + 30;

      const ratio = (pointerXRef.current - trackLeft) / trackWidth;

      let scrollSpeed = 0; // units per millisecond
      if (ratio < 0.05) {
        scrollSpeed = -0.05 * (defRef.current.scale === "hour" ? 5 : 2);
      } else if (ratio > 0.95) {
        scrollSpeed = 0.05 * (defRef.current.scale === "hour" ? 5 : 2);
      }

      if (scrollSpeed !== 0) {
        const delta = now - lastTime;
        const shift = scrollSpeed * delta;

        const r = viewRef.current.end - viewRef.current.start;
        let newStart = viewRef.current.start + shift;
        if (newStart < defRef.current.fullMin) newStart = defRef.current.fullMin;
        if (newStart + r > defRef.current.fullMax) newStart = defRef.current.fullMax - r;

        if (newStart !== viewRef.current.start) {
          viewRef.current = { start: newStart, end: newStart + r };
          setViewState({ start: Math.floor(newStart), end: Math.ceil(newStart + r) });

          const clampedRatio = Math.max(0, Math.min(1, ratio));
          const val = newStart + clampedRatio * r;
          const snapped = Math.round(val);
          const clampedVal = Math.max(defRef.current.fullMin, Math.min(defRef.current.fullMax, snapped));
          onChangeRef.current(clampedVal);
        }
      }

      lastTime = now;
    };

    requestAnimationFrame(loop);
    return () => {
      active = false;
    };
  }, [draggingHandle]);

  // Support 2-finger trackpad horizontal scrolling
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !isActive) return;

    const onWheel = (e: WheelEvent) => {
      const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (dx === 0) return;

      e.preventDefault();

      const rect = track.getBoundingClientRect();
      const trackWidth = rect.width - 60;
      const trackLeft = rect.left + 30;
      const r = viewRef.current.end - viewRef.current.start;
      const sensitivity = 0.8;
      const shift = (dx / trackWidth) * r * sensitivity;

      let newStart = viewRef.current.start + shift;
      if (newStart < defRef.current.fullMin) newStart = defRef.current.fullMin;
      if (newStart + r > defRef.current.fullMax) newStart = defRef.current.fullMax - r;

      if (newStart !== viewRef.current.start) {
        viewRef.current = { start: newStart, end: newStart + r };
        setViewState({
          start: Math.floor(newStart),
          end: Math.ceil(newStart + r),
        });
      }

      const mouseRatio = Math.max(0, Math.min(1, (e.clientX - trackLeft) / trackWidth));
      const mouseVal = newStart + mouseRatio * r;
      const mouseSnapped = Math.max(defRef.current.fullMin, Math.min(defRef.current.fullMax, Math.round(mouseVal)));
      setHoverValue(mouseSnapped);
      setHoverX(mouseRatio * 100);
    };

    track.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      track.removeEventListener("wheel", onWheel);
    };
  }, [isActive]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const trackWidth = rect.width - 60;
      const trackLeft = rect.left + 30;
      const ratio = Math.max(0, Math.min(1, (e.clientX - trackLeft) / trackWidth));
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
      const trackWidth = rect.width - 60;
      const trackLeft = rect.left + 30;
      const ratio = Math.max(0, Math.min(1, (e.clientX - trackLeft) / trackWidth));
      const val = viewRef.current.start + ratio * (viewRef.current.end - viewRef.current.start);
      const snapped = Math.max(def.fullMin, Math.min(def.fullMax, Math.round(val)));
      onChange(snapped);
    },
    [isActive, def, onChange]
  );

  const isInView = useCallback((v: number) => {
    const pad = (viewRef.current.end - viewRef.current.start) * 0.5;
    return v >= viewRef.current.start - pad && v <= viewRef.current.end + pad;
  }, []);

  const visibleTicks = useMemo(() => {
    const start = Math.floor(viewState.start);
    const end = Math.ceil(viewState.end);
    
    const majorList: number[] = [];
    const mediumList: number[] = [];
    const minorList: number[] = [];

    const majorSet = new Set(def.majorTicks);
    const mediumSet = new Set(def.mediumTicks);

    if (def.scale === "hour") {
      for (let v = start; v <= end; v++) {
        const h = ((v % 24) + 24) % 24;
        if (h === 0) {
          majorList.push(v);
        } else if (h % 6 === 0) {
          mediumList.push(v);
        } else {
          minorList.push(v);
        }
      }
    } else if (def.scale === "day") {
      for (let v = start; v <= end; v++) {
        if (majorSet.has(v)) {
          majorList.push(v);
        } else if (mediumSet.has(v)) {
          mediumList.push(v);
        } else {
          minorList.push(v);
        }
      }
    } else {
      for (let v = start; v <= end; v++) {
        if (majorSet.has(v)) {
          majorList.push(v);
        } else {
          minorList.push(v);
        }
      }
    }

    return {
      major: majorList,
      medium: mediumList,
      minor: minorList,
    };
  }, [viewState, def]);

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

      {isActive && def.scale === "year" && (
        <div className="ttc-time-box">
          <input
            type="number"
            value={localInputValue}
            min={def.fullMin}
            max={def.fullMax}
            onChange={handleTimeBoxChange}
            onBlur={commitTimeBoxValue}
            onKeyDown={handleTimeBoxKeyDown}
            aria-label="Year value"
          />
        </div>
      )}

      {isActive && (def.scale === "day" || def.scale === "hour") && (
        <div className="ttc-time-box" onClick={openTimePicker}>
          <span className="ttc-time-box-label">{getInputValueString(def)}</span>
        </div>
      )}

      {showTimePicker && (
        <>
          <div className="ttc-picker-backdrop" onClick={() => setShowTimePicker(false)} />
          <div className={`ttc-picker-panel ${isMobile ? "ttc-picker-panel--mobile" : ""}`}>
            <div className="ttc-picker-header">
              <div className="ttc-picker-title">Select {def.label}</div>
              <button className="ttc-picker-close" onClick={() => setShowTimePicker(false)} type="button">×</button>
            </div>
            <div className="ttc-picker-body">
              <div className="ttc-picker-field">
                <label className="ttc-picker-label">Date</label>
                <input className="ttc-picker-input" type="date" value={pickerDate} onChange={e => setPickerDate(e.target.value)} />
              </div>
              {def.scale === "hour" && (
                <div className="ttc-picker-field">
                  <label className="ttc-picker-label">Time</label>
                  <input className="ttc-picker-input" type="time" value={pickerTime} onChange={e => setPickerTime(e.target.value)} />
                </div>
              )}
            </div>
            <div className="ttc-picker-footer">
              <button className="ttc-picker-btn ttc-picker-btn-cancel" onClick={() => setShowTimePicker(false)} type="button">Cancel</button>
              <button className="ttc-picker-btn ttc-picker-btn-apply" onClick={applyTimePicker} type="button">Apply</button>
            </div>
          </div>
        </>
      )}

      <div className="ttc-ruler-wrap">
        <div
          ref={trackRef}
          style={{ position: "relative", padding: "0 30px", width: "100%", boxSizing: "border-box" }}
        >
          {isActive && selectedX >= -2 && selectedX <= 102 && (
            <div
              ref={selectedBubbleRef}
              style={{ position: "absolute", top: 0, left: `calc(30px + ${selectedX} * (100% - 60px) / 100)`, width: 0, height: 0, overflow: "visible", zIndex: 10, transition: panning ? "none" : "opacity 0.2s" }}
            >
              <div className="ttc-selected-bubble">
                {def.formatSelected(def.value)}
              </div>
            </div>
          )}

          {hoverValue !== null && isActive && hoverX >= -2 && hoverX <= 102 && (
            <div
              ref={hoverBubbleRef}
              style={{ position: "absolute", top: 0, left: `calc(30px + ${hoverX} * (100% - 60px) / 100)`, width: 0, height: 0, overflow: "visible", zIndex: 11, transition: panning ? "none" : "opacity 0.2s" }}
            >
              <div className="ttc-hover-bubble">
                {def.formatSelected(hoverValue)}
              </div>
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
              className="ttc-ruler-svg"
              viewBox={`0 0 1000 ${isActive ? 48 : 12}`}
              preserveAspectRatio="none"
            >
              {/* Major ticks */}
              {visibleTicks.major.map((v) => {
                const mX = valueToScreen(v) * 10;
                if (mX < 0 || mX > 1000) return null;
                return (
                  <line
                    key={`maj-${v}`}
                    x1={mX}
                    y1={BASELINE - HALF_MAJOR}
                    x2={mX}
                    y2={BASELINE + HALF_MAJOR}
                    stroke={Math.abs(v - def.value) < 0.1 ? "#2563eb" : isActive ? "#64748b" : "#94a3b8"}
                    strokeWidth={isActive ? 2 : 0.8}
                    shapeRendering="crispEdges"
                  />
                );
              })}
              {/* Medium ticks */}
              {visibleTicks.medium.map((v) => {
                const mX = valueToScreen(v) * 10;
                if (mX < 0 || mX > 1000) return null;
                return (
                  <line
                    key={`med-${v}`}
                    x1={mX}
                    y1={BASELINE - HALF_MID}
                    x2={mX}
                    y2={BASELINE + HALF_MID}
                    stroke={isActive ? "#94a3b8" : "#cbd5e1"}
                    strokeWidth={isActive ? 1.2 : 0.6}
                    shapeRendering="crispEdges"
                  />
                );
              })}
              {/* Minor ticks */}
              {visibleTicks.minor.map((v) => {
                const mX = valueToScreen(v) * 10;
                if (mX < 0 || mX > 1000) return null;
                return (
                  <line
                    key={`min-${v}`}
                    x1={mX}
                    y1={BASELINE - HALF_MINOR}
                    x2={mX}
                    y2={BASELINE + HALF_MINOR}
                    stroke={isActive ? "#cbd5e1" : "#e2e8f0"}
                    strokeWidth={isActive ? 0.8 : 0.4}
                    shapeRendering="crispEdges"
                  />
                );
              })}
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
              {isActive && selectedX >= -2 && selectedX <= 102 && (
                <g>
                  {/* Selection pillar (full height highlight) */}
                  <line
                    x1={selectedX * 10}
                    y1={0}
                    x2={selectedX * 10}
                    y2={48}
                    stroke="#2563eb"
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
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    shapeRendering="crispEdges"
                  />
                  {/* Thermometer bulb */}
                  <circle cx={selectedX * 10} cy={BASELINE} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                </g>
              )}
            </svg>
            {isActive && visibleTicks.major.map((v, idx, arr) => {
              const pct = valueToScreen(v);
              if (pct < 3 || pct > 97) return null;
              if (idx > 0 && pct - valueToScreen(arr[idx - 1]) < 6) return null;
              return (
                <div key={`tlb-${v}`} className="ttc-tick-label" style={{ left: `${pct}%` }}>
                  {def.formatTick(v)}
                </div>
              );
            })}
            {isActive && (
              <>
                <div className="ttc-range-label ttc-range-label--left">{def.formatSelected(viewState.start)}</div>
                <div className="ttc-range-label ttc-range-label--right">{def.formatSelected(viewState.end)}</div>
              </>
            )}
          </div>

        </div>
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
