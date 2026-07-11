"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";


import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat, toLonLat, transform } from "ol/proj";
import { easeOut } from "ol/easing";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Style, Circle, Fill, Stroke, Text } from "ol/style";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { DATASETS, getRootDataset, getDatasetSlug, getParentDataset, getDatasetById, getTimeScale, type TimeScale } from "../../lib/constants/datasets";
import { ECOWITT_DEVICES, type EcowittDevice } from "../../lib/constants/data-sources";
import { useS3DatasetLayers } from "./useS3DatasetLayers";
import type { ManualStation } from "../../lib/admin-api";
import { listWaterQualitySamples, getWaterQualitySample, getBackendAdminUrl, listS3Files, type WaterQualitySampleDto } from "../../lib/admin-api";
import { MapPin, Activity, Image, Calendar, X, Play, Pause, SkipForward, SkipBack, Layers, Clock, Map as MapIcon, Download } from "lucide-react";
import { TemporalTimelineControl } from "./temporal-timeline-control";
import { useLanduseYearlyStats } from "./useLanduseYearlyStats";

// Register UTM 48N projection
proj4.defs("EPSG:32648", "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs");
register(proj4);

// ---- Ecowitt Popup: shared types & helpers ----
interface EcowittPopupSensorData {
  time: string;
  tempf?: number;
  humidity?: number;
  wind_speed?: number;
  wind_gust?: number;
  rain_daily?: number;
  pressure_rel?: number;
  solar_radiation?: number;
  uv?: number;
}

type EcowittPopupSensorKey = keyof Omit<EcowittPopupSensorData, "time">;

const ECOWITT_POPUP_SENSORS: { key: EcowittPopupSensorKey; label: string; unit: string; color: string }[] = [
  { key: "tempf", label: "Temperature", unit: "°F", color: "#ff6b6b" },
  { key: "humidity", label: "Humidity", unit: "%", color: "#4ecdc4" },
  { key: "wind_speed", label: "Wind Speed", unit: "mph", color: "#45b7d1" },
  { key: "rain_daily", label: "Daily Rain", unit: "in", color: "#6c5ce7" },
  { key: "pressure_rel", label: "Pressure", unit: "inHg", color: "#ffd93d" },
  { key: "solar_radiation", label: "Solar Rad.", unit: "W/m²", color: "#ff8a5c" },
  { key: "uv", label: "UV Index", unit: "", color: "#ea8685" },
];

function parseEcowittPopupData(ecowittData: Record<string, unknown>): EcowittPopupSensorData[] {
  const times = Array.isArray(ecowittData?.times) ? (ecowittData.times as string[]) : [];
  const lists = ecowittData?.list as Record<string, { list?: Record<string, unknown[]> }> | undefined;
  const getVal = (group: string, key: string, idx: number): number | undefined => {
    const arr = lists?.[group]?.list?.[key];
    return Array.isArray(arr) ? Number(arr[idx]) : undefined;
  };
  return times.map((time, idx) => ({
    time,
    tempf: getVal("tempf", "tempf", idx),
    humidity: getVal("humidity", "humidity", idx),
    wind_speed: getVal("wind_speed", "windspeedmph", idx),
    wind_gust: getVal("wind_speed", "windgustmph", idx),
    rain_daily: getVal("rain", "dailyrainin", idx),
    pressure_rel: getVal("pressure", "baromrelin", idx),
    solar_radiation: getVal("so_uv", "solarradiation", idx),
    uv: getVal("so_uv", "uv", idx),
  }));
}

// ---------------------------------------------------------------------------
// Flatten DATASETS (from datasets.ts) into a list of addable map layers.
// Parent categories with children → each child becomes one layer entry.
// Parent categories without children → the parent itself becomes a layer entry.
// ---------------------------------------------------------------------------
type PlayerLayer = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  added: boolean;
  visible: boolean;
  type?: string;
  opacity: number;
  proxyUrl?: string;
};

const ALL_AVAILABLE_LAYERS: PlayerLayer[] = DATASETS.flatMap((root) => {
  function collectLeafLayers(item: typeof root): PlayerLayer[] {
    if (item.children && item.children.length > 0) {
      return item.children.flatMap((c) => collectLeafLayers(c));
    }
    return [{
      id: item.id,
      name: item.name,
      categoryId: root.id,
      categoryName: root.name,
      added: false,
      visible: false,
      opacity: 0.7,
    }];
  }
  return collectLeafLayers(root);
});

type WorldFile = {
  a: number;
  d: number;
  b: number;
  e: number;
  c: number;
  f: number;
};

function parseWorldFile(text: string): WorldFile | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 6) {
    return null;
  }

  const values = lines.slice(0, 6).map((line) => Number.parseFloat(line));
  if (values.some((value) => Number.isNaN(value))) {
    return null;
  }

  return {
    a: values[0],
    d: values[1],
    b: values[2],
    e: values[3],
    c: values[4],
    f: values[5],
  };
}

function buildWorldFileExtent(worldFile: WorldFile, pixelExtent: [number, number, number, number]) {
  if (worldFile.b !== 0 || worldFile.d !== 0) {
    return null;
  }

  const width = pixelExtent[2] - pixelExtent[0];
  const height = pixelExtent[3] - pixelExtent[1];
  if (!(width > 0 && height > 0)) {
    return null;
  }

  const minX = worldFile.c - worldFile.a / 2;
  const maxY = worldFile.f - worldFile.e / 2;
  const maxX = minX + worldFile.a * width;
  const minY = maxY + worldFile.e * height;

  return [minX, minY, maxX, maxY] as [number, number, number, number];
}

function buildWorldFileCandidates(rasterUrl: string) {
  // Proxy URLs won't have a .tif extension; skip world file lookup
  if (rasterUrl.startsWith("/api/")) {
    return [];
  }
  const absolute = rasterUrl.startsWith("http")
    ? new URL(rasterUrl)
    : new URL(rasterUrl, window.location.origin);
  const basePath = absolute.pathname.replace(/\.(tif|tiff)$/i, "");
  const candidates = [`${basePath}.tfw`, `${basePath}_Geotiff.tfw`];

  return candidates.map((path) => new URL(path, absolute.origin).toString());
}

async function loadWorldFile(rasterUrl: string) {
  const candidates = buildWorldFileCandidates(rasterUrl);

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      const parsed = parseWorldFile(text);
      if (parsed) {
        return parsed;
      }
    } catch {
      // Ignore and try the next candidate.
    }
  }

  return null;
}

type BaseLayerType = "osm" | "satellite" | "terrain" | "dark" | "light" | "topo" | "humanitarian" | "transport";

const baseLayers = {
  osm: {
    name: "OpenStreetMap",
    source: () => new OSM(),
  },
  satellite: {
    name: "Satellite",
    source: () => new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attributions: "Tiles © Esri",
    }),
  },
  terrain: {
    name: "Terrain",
    source: () => new XYZ({
      url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions: "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap",
    }),
  },
  topo: {
    name: "Topographic",
    source: () => new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      attributions: "Tiles © Esri",
    }),
  },
  transport: {
    name: "Transport",
    source: () => new XYZ({
      url: "https://{a-c}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=",
      attributions: "Maps © Thunderforest, Data © OpenStreetMap contributors",
      crossOrigin: "anonymous",
    }),
  },
  humanitarian: {
    name: "Humanitarian",
    source: () => new XYZ({
      url: "https://{a-c}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      attributions: "© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team",
    }),
  },
  light: {
    name: "Light",
    source: () => new XYZ({
      url: "https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      attributions: "© OpenStreetMap contributors, © CARTO",
    }),
  },
  dark: {
    name: "Dark",
    source: () => new XYZ({
      url: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      attributions: "© OpenStreetMap contributors, © CARTO",
    }),
  },
};

type TimelineUnitMode = "auto" | "hour4" | "day" | "month" | "year";
type TimelineResolvedMode = "hour4" | "day" | "month" | "year";

type TimelineUnit = {
  label: string;
  value: string;
  isMajor: boolean;
};

type MapStageProps = {
  startDateTime: string;
  endDateTime: string;
  appliedDatasets?: Array<{ id: string; type: string }>;
  onRemoveDataset?: (id: string, type: string) => void;
  onAddDataset?: (id: string, type: string) => void;
  hasExplicitRange?: boolean;
  onStartDateTimeChange?: (val: string) => void;
  onEndDateTimeChange?: (val: string) => void;
  waterQualityStations?: ManualStation[];
  isMobile?: boolean;
  hoveredDatasetId?: string | null;
};

function parseDateTimeLocal(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short" }).format(date);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { month: "short", year: "numeric" }).format(date);
}

function formatHourLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    hour12: false,
  }).format(date);
}

function resolveTimelineMode(startDate: Date, endDate: Date, preferredMode: TimelineUnitMode) {
  if (preferredMode !== "auto") {
    return preferredMode;
  }

  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));

  if (diffDays < 30) {
    return "hour4";
  }

  if (diffDays < 180) {
    return "day";
  }

  return "month";
}

// Fixed observation hours matching S3 data (00:00, 05:00, 10:00, 15:00, 20:00)
const OBS_HOURS = [0, 5, 10, 15, 20];

function buildTimelineUnits(startDate: Date, endDate: Date, mode: TimelineResolvedMode) {
  if (mode === "year") {
    const units: TimelineUnit[] = [];
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      units.push({
        label: String(y),
        value: `${y}-01-01T00:00`,
        isMajor: true,
      });
    }
    return { mode, units };
  }

  if (mode === "hour4") {
    const units: TimelineUnit[] = [];
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    while (cur <= endDate) {
      for (const h of OBS_HOURS) {
        const t = new Date(cur);
        t.setHours(h, 0, 0, 0);
        if (t > endDate) break;
        const hh = String(h).padStart(2, "0");
        const yyyy = t.getFullYear();
        const mm = String(t.getMonth() + 1).padStart(2, "0");
        const dd = String(t.getDate()).padStart(2, "0");
        units.push({
          label: `${t.getDate()}/${t.getMonth() + 1} ${hh}:00`,
          value: `${yyyy}-${mm}-${dd}T${hh}:00`,
          isMajor: h === 0,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
    return { mode, units };
  }

  if (mode === "day") {
    const units: TimelineUnit[] = [];
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    while (cur <= endDate) {
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, "0");
      const dd = String(cur.getDate()).padStart(2, "0");
      const dayOfWeek = cur.getDay();
      const isMonday = dayOfWeek === 1;
      units.push({
        label: `${dd}/${mm}${isMonday ? ` (T${yyyy})` : ""}`,
        value: `${yyyy}-${mm}-${dd}T00:00`,
        isMajor: isMonday,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return { mode, units };
  }

  const units: TimelineUnit[] = [];
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const limit = 72; // Increase limit to accommodate half-month ticks

  for (let index = 0; index < limit; index += 1) {
    if (current > endDate) {
      break;
    }

    const isFirstDay = current.getDate() === 1;
    const cy = current.getFullYear();
    const cm = String(current.getMonth() + 1).padStart(2, "0");
    const cd = String(current.getDate()).padStart(2, "0");
    units.push({
      label: formatMonthLabel(current),
      value: `${cy}-${cm}-${cd}T00:00`,
      isMajor: isFirstDay,
    });

    // Add a middle-of-the-month tick
    if (isFirstDay) {
      current = new Date(current.getFullYear(), current.getMonth(), 15);
    } else {
      current = addMonths(new Date(current.getFullYear(), current.getMonth(), 1), 1);
    }
  }

  return { mode, units };
}

function translateLegendLabel(label: string): string {
  if (!label) return "";
  return label
    .replace(/Độ mặn/g, "Salinity")
    .replace(/Độ sâu ngập/g, "Flooding Depth")
    .replace(/Độ sâu/g, "Depth");
}

function isLanduseLayer(key: string): boolean {
  return key.startsWith("landuse-classification/");
}

function normalizeLanduseKey(key: string): string {
  let id = key.split("__")[0];
  id = id.replace(/-(raster|vector)$/, "");
  return id;
}

// ---------------------------------------------------------------------------
// SensorChart — interactive sparkline with hover crosshair
// ---------------------------------------------------------------------------
function SensorChart({
  data,
  sensor,
  hoveredIdx,
  onHover,
  chartH,
}: {
  data: EcowittPopupSensorData[];
  sensor: (typeof ECOWITT_POPUP_SENSORS)[number];
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  chartH?: number;
}) {
  const H = chartH ?? 56;
  const W = 240;
  const PAD = 2;

  const entries = data
    .map((d, i) => ({ i, v: d[sensor.key] }))
    .filter((x): x is { i: number; v: number } => x.v !== undefined && !Number.isNaN(Number(x.v)));

  if (entries.length < 2) return null;

  const max = Math.max(...entries.map((e) => e.v));
  const min = Math.min(...entries.map((e) => e.v));
  const range = max - min || 1;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  const pts = entries.map((e) => ({
    x: PAD + (e.i / (data.length - 1)) * plotW,
    y: PAD + plotH - ((e.v - min) / range) * plotH,
    i: e.i,
    v: e.v,
  }));

  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = `M${PAD},${H} ${lineD.slice(1)} L${W - PAD},${H} Z`;

  // Closest data-point for the current hover index
  const activeIdx = hoveredIdx !== null ? Math.min(hoveredIdx, data.length - 1) : null;
  const activePt = activeIdx !== null ? pts.find((p) => p.i === activeIdx) ?? null : null;
  const activeData = activeIdx !== null ? data[activeIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      {/* Tooltip bar — always rendered to prevent layout shift */}
      <div
        style={{
          fontSize: "0.58rem",
          fontWeight: "700",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginBottom: "1px",
          lineHeight: 1.2,
          visibility: activeIdx !== null ? "visible" : "hidden",
          color: activeIdx !== null ? sensor.color : "transparent",
        }}
      >
        {activeData?.time ?? ""}
        <span style={{ color: "#94a3b8", fontWeight: "400", margin: "0 2px" }}>|</span>
        {activePt ? activePt.v.toFixed(2) : ""}
        {sensor.unit}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: H, display: "block" }}
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(ratio * (data.length - 1));
          onHover(Math.max(0, Math.min(idx, data.length - 1)));
        }}
        onMouseLeave={() => onHover(null)}
      >
        {/* Horizontal grid */}
        <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1={PAD} y1={PAD + plotH * 0.5} x2={W - PAD} y2={PAD + plotH * 0.5} stroke="#e2e8f0" strokeWidth="0.6" />
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e2e8f0" strokeWidth="0.6" />

        {/* Area fill */}
        <path d={areaD} fill={sensor.color} fillOpacity="0.10" />

        {/* Line */}
        <path
          d={lineD}
          fill="none"
          stroke={sensor.color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair */}
        {activePt && (
          <line
            x1={activePt.x}
            y1={PAD}
            x2={activePt.x}
            y2={H - PAD}
            stroke="#94a3b8"
            strokeWidth="0.7"
            strokeDasharray="2,2"
          />
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EcowittStationPopup — interactive popup card with hover-enabled charts
// ---------------------------------------------------------------------------
function EcowittStationPopup({
  device,
  data,
  loading,
  error,
  dateStr,
  onDateChange,
  onClose,
  isMobile,
}: {
  device: { id: string; name: string; lat?: number; lng?: number };
  data: EcowittPopupSensorData[];
  loading: boolean;
  error: string;
  dateStr: string;
  onDateChange: (d: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const popupW = "420px";

  const getLatest = (key: EcowittPopupSensorKey): string => {
    const v = latestData?.[key];
    return v !== undefined && !Number.isNaN(Number(v)) ? Number(v).toFixed(2) : "--";
  };

  return (
    <div
      style={{
        position: "absolute",
        top: isMobile ? "auto" : "110px",
        bottom: isMobile ? "12px" : undefined,
        right: isMobile ? "12px" : "12px",
        left: isMobile ? "12px" : undefined,
        width: isMobile ? "auto" : popupW,
        maxWidth: isMobile ? "min(calc(100vw - 24px), 480px)" : "calc(100vw - 24px)",
        maxHeight: isMobile ? "62vh" : "82vh",
        background: isMobile ? "rgba(255,255,255,0.92)" : "#fff",
        backdropFilter: isMobile ? "blur(16px)" : undefined,
        WebkitBackdropFilter: isMobile ? "blur(16px)" : undefined,
        borderRadius: isMobile ? "16px" : "14px",
        boxShadow: isMobile ? "0 4px 24px rgba(0,0,0,0.15)" : "0 6px 32px rgba(0,0,0,0.18)",
        zIndex: isMobile ? 701 : 500,
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Drag Handle (Mobile) ── */}
      {isMobile && <div className="bottom-sheet-handle" />}

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: isMobile ? "10px 14px" : "14px 16px",
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(135deg, rgba(13,110,253,0.05) 0%, #ffffff 100%)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? "0.7rem" : "0.65rem", color: '#64748b', fontWeight: '600' }}>
              Weather Station · {device.id}
            </div>
            <div style={{ fontSize: isMobile ? "0.9rem" : "0.9rem", fontWeight: "700", color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={device.name}>
              {device.name}
            </div>
            {device.lat != null && (
              <div style={{ fontSize: isMobile ? "0.65rem" : "0.63rem", color: '#94a3b8', marginTop: "1px" }}>
                {device.lat.toFixed(4)}°N, {device.lng?.toFixed(4)}°E
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569',
            width: isMobile ? "36px" : "28px", height: isMobile ? "36px" : "28px", borderRadius: "50%",
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* ── Date picker row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => onDateChange(e.target.value)}
          style={{
            flex: 1,
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: isMobile ? "8px 10px" : "3px 6px",
            fontSize: isMobile ? "0.85rem" : "0.75rem",
            minHeight: isMobile ? "40px" : undefined,
            color: "#334155",
            background: "#f8fafc",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        {loading && (
          <div
            style={{
              width: "14px",
              height: "14px",
              border: "2px solid #e2e8f0",
              borderTopColor: "#0d6efd",
              borderRadius: "50%",
              animation: "spin 0.6s linear infinite",
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* ── Body ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Loading */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              color: "#64748b",
              fontSize: "0.82rem",
            }}
          >
            Loading data...
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            style={{
              margin: "10px",
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              padding: "9px 11px",
              color: "#b91c1c",
              fontSize: "0.78rem",
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* ═══ ALL SENSORS ═══ */}
        {!loading && !error && (
          <div style={{ padding: "10px" }}>
            {latestData ? (
              <>
                {/* Latest values table */}
                <div
                  style={{
                    fontSize: isMobile ? "0.72rem" : "0.6rem",
                    fontWeight: "700",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: "6px",
                  }}
                >
                  Latest Readings
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
                    gap: "5px",
                    marginBottom: "12px",
                  }}
                >
                  {ECOWITT_POPUP_SENSORS.map((sensor) => {
                    const display = getLatest(sensor.key);
                    return (
                      <div
                        key={sensor.key}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "8px",
                          background: `${sensor.color}0e`,
                          borderLeft: `2.5px solid ${sensor.color}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: isMobile ? "0.72rem" : "0.59rem",
                            color: "#64748b",
                            fontWeight: "600",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {sensor.label}
                        </div>
                        <div
                          style={{
                            fontSize: isMobile ? "1.1rem" : "0.95rem",
                            fontWeight: "800",
                            color: sensor.color,
                            marginTop: "1px",
                          }}
                        >
                          {display}
                          <span
                            style={{
                              fontSize: "0.6rem",
                              fontWeight: "400",
                              color: "#94a3b8",
                              marginLeft: "2px",
                            }}
                          >
                            {sensor.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Charts for all sensors */}
                {data.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: isMobile ? "0.72rem" : "0.6rem",
                        fontWeight: "700",
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        marginBottom: "8px",
                      }}
                    >
                      {"Today's Chart"}
                    </div>
                    {ECOWITT_POPUP_SENSORS.map((sensor) => (
                      <div key={sensor.key} style={{ marginBottom: "10px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            marginBottom: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: isMobile ? "0.8rem" : "0.67rem",
                              color: "#475569",
                              fontWeight: "600",
                            }}
                          >
                            {sensor.label}
                            {sensor.unit && (
                              <span
                                style={{
                                  color: "#94a3b8",
                                  fontWeight: "400",
                                  marginLeft: "2px",
                                }}
                              >
                                ({sensor.unit})
                              </span>
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: isMobile ? "0.85rem" : "0.7rem",
                              color: sensor.color,
                              fontWeight: "700",
                            }}
                          >
                            {getLatest(sensor.key)}
                          </span>
                        </div>
                        <div
                          style={{
                            background: "#f8fafc",
                            borderRadius: "5px",
                            overflow: "hidden",
                            padding: "2px 2px 0",
                          }}
                        >
                          <SensorChart
                            data={data}
                            sensor={sensor}
                            hoveredIdx={hoveredIdx}
                            onHover={setHoveredIdx}
                            chartH={isMobile ? 72 : 56}
                          />
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0",
                  color: "#94a3b8",
                  fontSize: "0.8rem",
                }}
              >
                No data available today
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const MapStage = React.memo(function MapStage({ startDateTime, endDateTime, appliedDatasets, onRemoveDataset, onAddDataset, onStartDateTimeChange, onEndDateTimeChange, waterQualityStations, isMobile }: MapStageProps) {
  // console.log("[MapStage] render", { datasets: appliedDatasets, single: (appliedDatasets?.length ?? 0) === 1 });
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const ecowittLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const ecowittSourceRef = useRef<VectorSource | null>(null);
  const wqLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wqSourceRef = useRef<VectorSource | null>(null);
  const wqStationsRef = useRef<ManualStation[]>([]);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const previousMapViewStateRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  const inspectLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const inspectSourceRef = useRef<VectorSource | null>(null);
  const [pixelValue, setPixelValue] = useState<number | null>(null);
  const [pixelValues, setPixelValues] = useState<Record<string, number>>({});
  const [mouseCoords, setMouseCoords] = useState<[number, number] | null>(null);
  const [inspectorExpandedKey, setInspectorExpandedKey] = useState<string | null>(null);
  const flashCoordsRef = useRef<[number, number] | null>(null);
  const [flashCoords, setFlashCoords] = useState<[number, number] | null>(null);
  const pendingStationRef = useRef<{ type: 'wq'; id: number; st: ManualStation } | { type: 'ecowitt'; id: string } | null>(null);
  const skipZoomRef = useRef(false);
  const overlayVisibilityRef = useRef<Record<string, boolean> | null>(null);
  const pointermoveThrottleRef = useRef<number>(0);
  const pointermoveRafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const [activeLuId, setActiveLuId] = useState<string | null>(null);
  const luYearly = useLanduseYearlyStats(activeLuId);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);

  const [landuseStats, setLanduseStats] = useState<Record<string, { areaHa: number; percentage: number; classPixels?: number } | null>>({});
  const landuseStatsFetching = useRef<Set<string>>(new Set());

  const hideOverlays = useCallback(() => {
    if (overlayVisibilityRef.current) return; // already saved
    const layers = layerRefs.current;
    if (!layers) return;
    const saved: Record<string, boolean> = {};
    for (const [key, layer] of Object.entries(layers)) {
      saved[key] = layer.getVisible();
      layer.setVisible(false);
    }
    overlayVisibilityRef.current = saved;
  }, []);

  const restoreOverlays = useCallback(() => {
    const saved = overlayVisibilityRef.current;
    if (!saved) return;
    const layers = layerRefs.current;
    if (!layers) return;
    for (const [key, visible] of Object.entries(saved)) {
      const layer = layers[key];
      if (layer) layer.setVisible(visible);
    }
    overlayVisibilityRef.current = null;
  }, []);

  const [timelineUnitMode, setTimelineUnitMode] = useState<TimelineUnitMode>("auto");

  const startDate = useMemo(() => parseDateTimeLocal(startDateTime), [startDateTime]);
  const endDate = useMemo(() => parseDateTimeLocal(endDateTime), [endDateTime]);

  const timelineData = useMemo(() => {
    if (!startDate || !endDate) {
      return { mode: "day" as TimelineResolvedMode, units: [] as TimelineUnit[] };
    }

    const normalizedStart = startDate <= endDate ? startDate : endDate;
    const normalizedEnd = startDate <= endDate ? endDate : startDate;

    const hasYearOnly = (appliedDatasets ?? []).some(d => {
      const root = getRootDataset(d.id);
      return root?.id === "landsat" || root?.id === "baseline" || root?.id === "flooding";
    });

    if (hasYearOnly) {
      const currentYear = new Date().getFullYear();
      let startYear = 2014; // Default for Landsat
      if ((appliedDatasets ?? []).some(d => getRootDataset(d.id)?.id === "flooding")) {
        startYear = 1990;
      }
      const lsStart = new Date(startYear, 0, 1);
      const lsEnd = new Date(currentYear, 11, 31);
      return buildTimelineUnits(lsStart, lsEnd, "year");
    }

    const resolvedMode = resolveTimelineMode(normalizedStart, normalizedEnd, timelineUnitMode);

    return buildTimelineUnits(normalizedStart, normalizedEnd, resolvedMode);
  }, [startDate, endDate, timelineUnitMode, appliedDatasets]);

  const timelineUnits = timelineData.units;

  const [timelineIndex, setTimelineIndex] = useState(() => {
    if (timelineUnits.length === 0) return 0;
    const today = new Date();
    const todayMs = today.getTime();
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < timelineUnits.length; i++) {
      const diff = Math.abs(new Date(timelineUnits[i].value).getTime() - todayMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  });

  const rawTimelineDate = useMemo(() => {
    const unit = timelineUnits[timelineIndex];
    return unit?.value ? unit.value.slice(0, 10) : undefined;
  }, [timelineIndex, timelineUnits]);

  // Active time slot HH-MM matching S3 folder structure
  const rawTimeSlot = useMemo(() => {
    const unit = timelineUnits[timelineIndex];
    if (!unit?.value) return "00-00";
    // value is local "YYYY-MM-DDTHH:MM" — extract HH:MM directly, no timezone conversion
    const timePart = unit.value.slice(11, 16); // "HH:MM"
    return timePart.replace(":", "-");
  }, [timelineIndex, timelineUnits]);

  // Next date in timeline for prefetching
  const prefetchDate = useMemo(() => {
    // Find next index with a different date
    for (let i = timelineIndex + 1; i < timelineUnits.length; i++) {
      const d = timelineUnits[i].value.slice(0, 10);
      if (d !== rawTimelineDate) return d;
    }
    return undefined;
  }, [timelineIndex, timelineUnits, rawTimelineDate]);

  // All unique dates in timeline range for bulk prefetch
  const allTimelineDates = useMemo(() =>
    [...new Set(timelineUnits.map(u => u.value.slice(0, 10)))],
  [timelineUnits]);

  const [timelineDate, setTimelineDate] = useState(rawTimelineDate);
  const [timeSlot, setTimeSlot] = useState(rawTimeSlot);
  useEffect(() => {
    setTimelineDate(rawTimelineDate);
    setTimeSlot(rawTimeSlot);
  }, [rawTimelineDate, rawTimeSlot]);

  const isTimelinePlayingRef = useRef(false);

  // Playback feature state
  const [showPlaybackPicker, setShowPlaybackPicker] = useState(false);
  const [pbStartDate, setPbStartDate] = useState("");
  const [pbEndDate, setPbEndDate] = useState("");
  const [pbError, setPbError] = useState("");
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  useEffect(() => { isTimelinePlayingRef.current = isTimelinePlaying; }, [isTimelinePlaying]);
  const [pbLoading, setPbLoading] = useState(false);
  const [pbProgressText, setPbProgressText] = useState("");
  const [playbackQueue, setPlaybackQueue] = useState<{ label: string; layers: Record<string, import("./useS3DatasetLayers").RenderedLayer> }[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  const onActualSlot = (actualDate: string, actualSlot: string) => {
    // Don't snap timeline during playback — timelapse hook already shows correct frame
    if (isTimelinePlayingRef.current) return;
    const targetValue = `${actualDate}T${actualSlot.replace("-", ":")}`;
    const idx = timelineUnits.findIndex(u => u.value === targetValue);
    if (idx >= 0) setTimelineIndex(idx);
  };

  // Only Hydrology datasets support timeline/timelapse (hydro-salinity, hydro-temp, hydro-ph)
  // Water Quality and Weather are static/separate and shouldn't block the timeline UI
  const HYDROLOGY_IDS = new Set(["hydro-salinity", "hydro-temp", "hydro-ph"]);
  const IGNORE_TIMELAPSE_BLOCKERS = new Set(["wq-surface", "wq-ground", "weather"]);
  
  const hasAppliedDatasets = (appliedDatasets?.length ?? 0) > 0;
  const timelapseSupported = !hasAppliedDatasets || (appliedDatasets ?? []).every(d => 
    HYDROLOGY_IDS.has(d.id) || IGNORE_TIMELAPSE_BLOCKERS.has(d.id)
  );

  // ── Temporal Timeline Control state ──
  // activeScale follows the top-most layer (last in appliedDatasets).
  // Manual override by clicking a row is allowed, but adding/removing
  // datasets resets the override.
  const [scaleOverride, setScaleOverride] = useState<TimeScale | null>(null);

  const activeTemporalScale = useMemo<TimeScale>(() => {
    if (scaleOverride) return scaleOverride;
    if (!appliedDatasets?.length) return "hour";
    const top = appliedDatasets[appliedDatasets.length - 1];
    return getTimeScale(top.id);
  }, [appliedDatasets, scaleOverride]);

  useEffect(() => {
    setScaleOverride(null);
  }, [appliedDatasets]);

  const handleTemporalScaleChange = useCallback((scale: TimeScale) => {
    setScaleOverride(scale);
  }, []);

  const temporalYearValue = useMemo(() => {
    const d = timelineDate ? new Date(timelineDate + "T00:00:00") : new Date();
    return d.getFullYear();
  }, [timelineDate]);

  const temporalDayValue = useMemo(() => {
    if (!timelineDate) return "01-01";
    const parts = timelineDate.split("-");
    return `${parts[1] || "01"}-${parts[2] || "01"}`;
  }, [timelineDate]);

  const temporalHourValue = useMemo(() => {
    if (!timeSlot) return "0";
    return `${parseInt(timeSlot.split("-")[0] || "0", 10)}`;
  }, [timeSlot]);

  const temporalApplicableScales = useMemo<TimeScale[]>(() => {
    if (!appliedDatasets?.length) return ["year", "day", "hour"];
    const scales = new Set<TimeScale>();
    for (const d of appliedDatasets) scales.add(getTimeScale(d.id));
    return Array.from(scales);
  }, [appliedDatasets]);

  const handleTemporalYearChange = useCallback((year: number) => {
    const newDate = `${year}-${temporalDayValue.replace("-", "-")}`;
    setTimelineDate(newDate);
    setTimeSlot(`${temporalHourValue.padStart(2, "0")}-00`);
  }, [temporalDayValue, temporalHourValue]);

  const handleTemporalDayChange = useCallback((month: number, day: number) => {
    const newDate = `${temporalYearValue}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setTimelineDate(newDate);
    setTimeSlot(`${temporalHourValue.padStart(2, "0")}-00`);
  }, [temporalYearValue, temporalHourValue]);

  const handleTemporalHourChange = useCallback((hour: number) => {
    setTimeSlot(`${String(hour).padStart(2, "0")}-00`);
  }, []);

  const handleTemporalTimeLapse = useCallback(() => {
    setPbStartDate("");
    setPbEndDate("");
    setPbError("");
    setShowPlaybackPicker(true);
  }, []);

  const s3Result = useS3DatasetLayers(
    appliedDatasets, mapRef,
    timelineDate, timeSlot,
    prefetchDate, allTimelineDates,
    onActualSlot,
    isTimelinePlaying && playbackQueue.length > 0 ? playbackQueue[playbackIndex].layers : undefined
  );

  const { renderedLayers, layerRefs: s3LayerRefs, layersCacheRef, sourceCacheRef } = s3Result;

  const effectiveRenderedLayers = useMemo(() => {
    if (isTimelinePlaying && playbackQueue.length > 0) {
      return playbackQueue[playbackIndex].layers;
    }
    return renderedLayers;
  }, [isTimelinePlaying, playbackQueue, playbackIndex, renderedLayers]);

  // Keep a ref so the pointermove closure (created once) can read current renderedLayers
  const renderedLayersRef = useRef(effectiveRenderedLayers);
  useEffect(() => { renderedLayersRef.current = effectiveRenderedLayers; }, [effectiveRenderedLayers]);

  useEffect(() => {
    const lKeys = Object.keys(pixelValues).filter(isLanduseLayer);
    console.log("[map:luEffect] pixelValues landuse keys:", lKeys);
    if (!lKeys.length) return;
    let id = lKeys[0].split("__")[0];
    id = id.replace(/-(raster|vector)$/, "");
    console.log("[map:luEffect] setting activeLuId:", id);
    setActiveLuId(function(prev) { return prev === id ? prev : id; });

    for (const key of lKeys) {
      const normKey = normalizeLanduseKey(key);
      const cacheKey = `${normKey}__${temporalYearValue}`;
      if (landuseStatsFetching.current.has(cacheKey)) continue;
      if (landuseStats.hasOwnProperty(cacheKey)) continue;
      landuseStatsFetching.current.add(cacheKey);
      fetch(`/api/gis/landuse-yearly-stats?key=${encodeURIComponent(normKey)}`)
        .then(r => r.json())
        .then((data: Array<{ year: number; areaHa: number; percentage?: number; classPixels?: number }>) => {
          const cur = data.find(s => s.year === temporalYearValue) || data[data.length - 1];
          if (cur) {
            setLanduseStats(prev => ({
              ...prev,
              [cacheKey]: { areaHa: cur.areaHa, percentage: cur.percentage ?? 0, classPixels: cur.classPixels },
            }));
          }
        })
        .catch(() => {})
        .finally(() => { landuseStatsFetching.current.delete(cacheKey); });
    }
  }, [pixelValues, temporalYearValue]);

  useEffect(() => {
    if (!appliedDatasets?.length) { setActiveLuId(null); return; }
    const hasLu = appliedDatasets.some(d => isLanduseLayer(d.id));
    if (!hasLu) setActiveLuId(null);
  }, [appliedDatasets]);

  // Merge layerRefs for inspector and other tools
  const layerRefs = useMemo(() => {
    return s3LayerRefs; // useS3LayerRenderer is already called inside useS3DatasetLayers
  }, [s3LayerRefs]);

  // Store playback frames for controlling auto-advance range
  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>("light");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showUnitMenu, setShowUnitMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [tooltipPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [playerLayers, setPlayerLayers] = useState<PlayerLayer[]>(() =>
    ALL_AVAILABLE_LAYERS.map((l) => ({ ...l }))
  );
  const [pendingLayerId, setPendingLayerId] = useState<string | null>(null);
  const playerControlRef = useRef<HTMLDivElement>(null);

  // Click outside / Escape to close layer dropdown
  useEffect(() => {
    if (!showPlayerDropdown) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (playerControlRef.current && !playerControlRef.current.contains(event.target as Node)) {
        setShowPlayerDropdown(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowPlayerDropdown(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showPlayerDropdown]);

  // Sync playerLayers from appliedDatasets: selected ones on top (reversed order = last=first), unselected below
  useEffect(() => {
    const selectedLookup = new Set((appliedDatasets ?? []).map((ds) => ds.id));
    const selected: PlayerLayer[] = [];
    const seenKeys = new Set<string>();
    const unselected: PlayerLayer[] = [];
    // First build selected in reverse click order (last clicked = top)
    const reversed = [...(appliedDatasets ?? [])].reverse();
    for (const ds of reversed) {
      const layerKey = `${ds.id}-${ds.type}`;
      if (seenKeys.has(layerKey)) continue; // deduplicate
      seenKeys.add(layerKey);
      const child = ALL_AVAILABLE_LAYERS.find((l) => l.id === ds.id);
      if (child) {
        selected.push({ ...child, added: true, visible: true, type: ds.type });
      } else {
        const cat = DATASETS.find((c) => c.id === ds.id || c.children?.some((ch) => ch.id === ds.id));
        const item = cat?.children?.find((ch) => ch.id === ds.id) || cat;
        selected.push({
          id: ds.id,
          name: item?.name || ds.id,
          categoryId: cat?.id || ds.id,
          categoryName: cat?.name || ds.id,
          added: true,
          visible: true,
          type: ds.type,
          opacity: 0.7,
        });
      }
    }
    // Then append unselected in original ALL_AVAILABLE_LAYERS order
    for (const al of ALL_AVAILABLE_LAYERS) {
      if (!selectedLookup.has(al.id)) {
        unselected.push({ ...al, added: false, visible: false, type: undefined });
      }
    }
    setPlayerLayers([...selected, ...unselected]);
    setPendingLayerId(null);
  }, [appliedDatasets]);

  useEffect(() => {
    const rendered = renderedLayersRef.current;
    setPlayerLayers(prev =>
      prev.map(pl => {
        if (!pl.added) return pl;
        const prefix = pl.type ? `${pl.id}-${pl.type}` : pl.id;
        const matchingKey = Object.keys(rendered).find(k => k === prefix || k.startsWith(prefix + "__"));
        const info = matchingKey ? rendered[matchingKey] : undefined;
        return { ...pl, proxyUrl: info?.proxyUrl };
      })
    );
  }, [renderedLayers]);

  // Sync map layer z-order, visibility and opacity with playerLayers
  useEffect(() => {
    const layers = layerRefs.current;
    const renderedIds = new Set(Object.keys(renderedLayers));
    playerLayers.forEach((pl, idx) => {
      const prefix = pl.type ? `${pl.id}-${pl.type}` : pl.id;
      const matchingKeys = Object.keys(layers).filter(k => k === prefix || k.startsWith(prefix + "__"));
      for (const key of matchingKeys) {
        if (!renderedIds.has(key)) continue;
        const olLayer = layers[key];
        if (olLayer) {
          olLayer.setVisible(pl.visible);
          olLayer.setOpacity(pl.opacity ?? 0.7);
          olLayer.setZIndex(100 + (playerLayers.length - idx));
        }
      }
    });
  }, [playerLayers, renderedLayers]);

  const handleOpenPlayback = () => {
    setPbStartDate("");
    setPbEndDate("");
    setPbError("");
    setShowPlaybackPicker(true);
  };

  useEffect(() => {
    if (!isTimelinePlaying || playbackQueue.length === 0) return;
    const interval = setInterval(() => {
      setPlaybackIndex(prev => {
        if (prev >= playbackQueue.length - 1) {
          setIsTimelinePlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isTimelinePlaying, playbackQueue.length]);

  const handleStartPlayback = async () => {
    if (!pbStartDate || !pbEndDate) {
      setPbError("Please select both start and end date.");
      return;
    }
    const start = new Date(pbStartDate);
    const end = new Date(pbEndDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || diffDays > 7) {
      setPbError("Please select a range between 0 and 7 days.");
      return;
    }

    setShowPlaybackPicker(false);
    setPbLoading(true);
    setPbError("");

    try {
      const activeDs = (appliedDatasets ?? []).filter(d => d.type === "raster");
      if (activeDs.length === 0) throw new Error("No active raster datasets selected.");

      // Build all dates in range
      const dates: string[] = [];
      const cur = new Date(pbStartDate);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }

      // frameMap: dateSlot → { dsKey → RenderedLayer }
      type RLayer = import("./useS3DatasetLayers").RenderedLayer;
      const frameMap: Record<string, Record<string, RLayer>> = {};

      const dateOf = (k: string) => {
        const mm = k.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        return mm ? `${mm[1]}/${mm[2]}/${mm[3]}` : "";
      };

      // Group dates by month for bulk listing
      const monthGroups: Record<string, string[]> = {};
      for (const d of dates) {
        const mk = d.slice(0, 7); // "YYYY-MM"
        if (!monthGroups[mk]) monthGroups[mk] = [];
        monthGroups[mk].push(d);
      }

      for (const ds of activeDs) {
        const dsKey = `${ds.id}-${ds.type}`;
        const parent = getParentDataset(ds.id);
        const dsInfo = getDatasetById(ds.id);
        const root = getRootDataset(ds.id);
        const catName = dsInfo?.name || ds.id;

        let datasetSlug: string, categorySlug: string;
        if (root && root.id !== ds.id) {
          datasetSlug = getDatasetSlug(root.id) || root.id;
          const rel = ds.id.startsWith(root.id + "/") ? ds.id.slice(root.id.length + 1) : ds.id;
          categorySlug = getDatasetSlug(ds.id) || rel;
        } else if (parent) {
          datasetSlug = getDatasetSlug(parent.id) || parent.id;
          const rel = ds.id.startsWith(parent.id + "/") ? ds.id.slice(parent.id.length + 1) : ds.id;
          categorySlug = getDatasetSlug(ds.id) || rel;
        } else {
          datasetSlug = getDatasetSlug(ds.id) || ds.id;
          categorySlug = "default";
        }

        const basePrefix = `gis-data/${datasetSlug}/${categorySlug}/`;

        for (const [ym, ymDates] of Object.entries(monthGroups)) {
          const [y, m] = ym.split("-");
          const monthPrefix = `${basePrefix}${y}/${m}/`;
          setPbProgressText(`Fetching ${catName} ${ym}…`);

          let result;
          try { result = await listS3Files(monthPrefix); } catch { continue; }
          if (result._error) continue;

          const tifs = result.files.filter(f => f.key?.match(/\.tiff?$/i));
          const allDatesSet = new Set(ymDates);

          for (const tif of tifs) {
            const dPath = dateOf(tif.key!);
            if (!dPath) continue;
            const dateKey = dPath.replace(/\//g, "-");
            if (!allDatesSet.has(dateKey)) continue;
            const sm = tif.key!.match(/\/(\d{2}-\d{2})\//);
            const slot = sm ? sm[1] : "00-00";
            const frameKey = `${dateKey}__${slot}`;
            if (!frameMap[frameKey]) frameMap[frameKey] = {};
            const layerKey = `${dsKey}__${dateKey}__${slot}`;
            frameMap[frameKey][layerKey] = {
              name: parent ? `${parent.name} - ${catName} (${slot})` : `${catName} (${slot})`,
              proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`,
              type: "raster",
              bbox: [594885, 1052655, 688485, 1117455],
              nodata: -9999,
            };
            // Also populate layersCacheRef for timeline use
            layersCacheRef.current[dateKey] = layersCacheRef.current[dateKey] ?? {};
            layersCacheRef.current[dateKey][layerKey] = frameMap[frameKey][layerKey];
          }
        }
      }

      // Build ordered queue from OBS_HOURS order
      const queue: { label: string; layers: Record<string, RLayer> }[] = [];
      for (const date of dates) {
        for (const h of OBS_HOURS) {
          const slot = `${String(h).padStart(2, "0")}-00`;
          const frameKey = `${date}__${slot}`;
          const layers = frameMap[frameKey];
          if (layers && Object.keys(layers).length > 0) {
            const hh = String(h).padStart(2, "0");
            const [, mm, dd] = date.split("-");
            queue.push({ label: `${Number(dd)}/${Number(mm)} ${hh}:00`, layers });
          }
        }
      }

      if (queue.length === 0) throw new Error("No data found in S3 for the selected range.");

      // Preload GeoTIFF sources
      setPbProgressText(`Preloading ${queue.length} frames…`);
      let loaded = 0;
      for (const item of queue) {
        await Promise.all(Object.entries(item.layers).map(async ([frameKey, info]) => {
          if (sourceCacheRef.current.get(frameKey)?.ready) return;
          try {
            const url = info.proxyUrl.startsWith("http") ? info.proxyUrl : `${window.location.origin}${info.proxyUrl}`;
            const GeoTIFF = (await import("ol/source/GeoTIFF")).default;
            const source = new GeoTIFF({ sources: [{ url, nodata: (info as { nodata?: number }).nodata ?? -9999 }], convertToRGB: false, normalize: false, interpolate: false, projection: "EPSG:32648" });
            await source.getView();
            sourceCacheRef.current.set(frameKey, { source, ready: true });
          } catch { /* skip bad frame */ }
        }));
        loaded++;
        setPbProgressText(`Loading pixels (${loaded}/${queue.length})…`);
      }

      setPlaybackQueue(queue);
      setPlaybackIndex(0);
      setIsTimelinePlaying(true);
    } catch (err: unknown) {
      setPbError(err instanceof Error ? err.message : "Failed to start playback.");
    } finally {
      setPbLoading(false);
    }
  };

  const confirmAddLayer = (key: string, layerType: "raster" | "vector") => {
    setPlayerLayers(prev => prev.map(l => getLayerKey(l) === key ? { ...l, added: true, visible: true, type: layerType } : l));
    setPendingLayerId(null);
    const id = key.replace(/-(?:raster|vector)$/, "");
    onAddDataset?.(id, layerType);
  };

  const removeLayer = (key: string) => {
    setPlayerLayers(prev => prev.map(l => getLayerKey(l) === key ? { ...l, added: false, visible: false, type: undefined } : l));
    setPendingLayerId(prev => prev === key ? null : prev);
    const [id, type] = key.split(/-(?=[^-]*$)/);
    onRemoveDataset?.(id, type ?? "raster");
  };

  // Local toggle — hide/show on map, layer stays in dropdown
  const toggleLayerVisibility = (key: string) => {
    setPlayerLayers(prev => prev.map(l => getLayerKey(l) === key ? { ...l, visible: !l.visible } : l));
    setPendingLayerId(prev => prev === key ? null : prev);
  };

  // Drag-and-drop reordering
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);

  // Ecowitt station popup state
  const [popupDeviceId, setPopupDeviceId] = useState<string | null>(null);
  const [popupData, setPopupData] = useState<EcowittPopupSensorData[]>([]);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState("");
  const [popupDate, setPopupDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const popupDeviceIdRef = useRef(popupDeviceId);
  popupDeviceIdRef.current = popupDeviceId;
  const [selectedWqStation, setSelectedWqStation] = useState<ManualStation | null>(null);
  const [wqStationSamples, setWqStationSamples] = useState<WaterQualitySampleDto[]>([]);
  const [wqStationSampleDate, setWqStationSampleDate] = useState<string>('');
  const [wqStationSample, setWqStationSample] = useState<WaterQualitySampleDto | null>(null);
  const [wqStationImages, setWqStationImages] = useState<string[]>([]);
  const [wqSamplesLoading, setWqSamplesLoading] = useState(false);
  const [wqImagePreviewUrl, setWqImagePreviewUrl] = useState<string | null>(null);
  const [activeWqImageIdx, setActiveWqImageIdx] = useState<number>(0);
  const [ecowittDevices, setEcowittDevices] = useState<EcowittDevice[]>([...ECOWITT_DEVICES] as EcowittDevice[]);

  const getLayerKey = (l: {id: string, type?: string}) => l.type ? `${l.id}-${l.type}` : l.id;

  const reorderLayers = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setPlayerLayers(prev => {
      const from = prev.findIndex(l => getLayerKey(l) === fromKey);
      const to   = prev.findIndex(l => getLayerKey(l) === toKey);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };


  const timelineUnitOptions: Array<{ value: TimelineUnitMode; label: string }> = [
    { value: "auto", label: "Auto" },
    { value: "hour4", label: "4h" },
    { value: "day", label: "Day" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
  ];

  useEffect(() => {
    if (timelineUnits.length === 0) return;
    // Don't reset timeline position during playback
    if (isTimelinePlaying) return;
    const today = new Date();
    const todayMs = today.getTime();
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < timelineUnits.length; i++) {
      const diff = Math.abs(new Date(timelineUnits[i].value).getTime() - todayMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    setTimelineIndex(bestIdx);
  }, [startDateTime, endDateTime, appliedDatasets, isTimelinePlaying]);

  useEffect(() => {
    if (timelineUnits.length === 0) {
      return;
    }

    setTimelineIndex((currentIndex) => Math.min(currentIndex, timelineUnits.length - 1));
  }, [timelineUnits.length]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const baseLayer = new TileLayer({
      source: baseLayers[activeBaseLayer].source(),
    });
    baseLayerRef.current = baseLayer;

    const map = new Map({
      target: mapContainerRef.current,
      layers: [baseLayer],
      view: new View({
        center: fromLonLat([106.34, 9.75]),
        zoom: 10,
      }),
      controls: [], // Remove default controls
    });

    mapRef.current = map;

    // Ecowitt station markers layer
    const ecowittSource = new VectorSource();
    ecowittSourceRef.current = ecowittSource;
    const ecowittLayer = new VectorLayer({
      source: ecowittSource,
      style: (feature) => {
        const selectedId = popupDeviceIdRef.current;
        if (selectedId && feature?.getId() === selectedId) {
          const now = Date.now();
          const pulse = Math.sin(now / 150) * 0.2 + 0.8;
          return [
            new Style({
              image: new Circle({
                radius: 12,
                fill: new Fill({ color: `rgba(0, 120, 40, ${pulse * 0.18})` }),
              }),
            }),
            new Style({
              image: new Circle({
                radius: 8,
                fill: new Fill({ color: `rgba(0, 130, 45, ${pulse})` }),
                stroke: new Stroke({ color: '#fff', width: 2 }),
              }),
            }),
          ];
        }
        return new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: '#dc3545' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        });
      },
      zIndex: 200,
    });
    ecowittLayer.setVisible(false);
    map.addLayer(ecowittLayer);
    ecowittLayerRef.current = ecowittLayer;

    // Manual station markers layer (Water Quality)
    const wqSource = new VectorSource();
    wqSourceRef.current = wqSource;
    const wqLayer = new VectorLayer({
      source: wqSource,
      style: (feature) => {
        const stationType = feature.get("stationType") as string | undefined;
        const isSelected = feature.get("selected") as boolean | undefined;
        const color = stationType === 'groundwater' ? '#0d6efd' : '#198754';
        if (isSelected) {
          const now = Date.now();
          const pulse = Math.sin(now / 150) * 0.2 + 0.8;
          return [
            new Style({
              image: new Circle({
                radius: 12,
                fill: new Fill({ color: `${color}33` }),
              }),
            }),
            new Style({
              image: new Circle({
                radius: 8,
                fill: new Fill({ color: color + Math.round(pulse * 255).toString(16).padStart(2, '0') }),
                stroke: new Stroke({ color: '#fff', width: 2 }),
              }),
            }),
          ];
        }
        return new Style({
          image: new Circle({
            radius: 7,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        });
      },
      zIndex: 190,
    });
    wqLayer.setVisible(false);
    map.addLayer(wqLayer);
    wqLayerRef.current = wqLayer;

    // Mobile inspection + flash pin layer
    const inspectSource = new VectorSource();
    inspectSourceRef.current = inspectSource;
    const inspectLayer = new VectorLayer({
      source: inspectSource,
      style: (feature) => {
        const pulse = feature?.get('pulse') as number | undefined;
        if (pulse !== undefined) {
          return [
            new Style({
              image: new Circle({
                radius: 10 + pulse * 20,
                fill: new Fill({ color: `rgba(8, 145, 178, ${0.05 + pulse * 0.15})` }),
                stroke: new Stroke({ color: `rgba(8, 145, 178, ${0.3 + pulse * 0.7})`, width: 2 + pulse * 2 }),
              }),
            }),
            new Style({
              image: new Circle({
                radius: 5 + pulse * 12,
                fill: new Fill({ color: `rgba(8, 145, 178, ${0.1 + pulse * 0.5})` }),
                stroke: new Stroke({ color: '#0891b2', width: 2 }),
              }),
            }),
            new Style({
              image: new Circle({
                radius: 4,
                fill: new Fill({ color: '#0891b2' }),
                stroke: new Stroke({ color: '#fff', width: 1.5 }),
              }),
            }),
          ];
        }
        return [
          new Style({
            image: new Circle({
              radius: 18,
              fill: new Fill({ color: 'rgba(8, 145, 178, 0.15)' }),
              stroke: new Stroke({ color: '#0891b2', width: 2.5 }),
            }),
          }),
          new Style({
            image: new Circle({
              radius: 5,
              fill: new Fill({ color: '#0891b2' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }),
        ];
      },
      zIndex: 500,
    });
    inspectLayer.setVisible(false);
    map.addLayer(inspectLayer);
    inspectLayerRef.current = inspectLayer;

    // Click handler: WQ station popup, Ecowitt popup, and mobile pixel inspection
    map.on("click", (evt) => {
      let handled = false;
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f as Feature | undefined);
      if (feature) {
        const wqId = feature.get("wqStationId") as number | undefined;
        if (wqId) {
          if (isMobileRef.current) {
            // Mobile: if same station already selected, close it
            if (selectedWqStation?.id === wqId) {
              setSelectedWqStation(null);
            } else {
              // Clear pixel inspector before flash
              setMouseCoords(null);
              setPixelValues({});
              // Hide overlays so map is clear
              hideOverlays();
              // Flash then open popup
              const st = wqStationsRef.current?.find(s => s.id === wqId);
              if (st && st.x != null && st.y != null) {
                const isWgs84 = Math.abs(st.x) <= 180 && Math.abs(st.y) <= 90;
                const coords = isWgs84
                  ? fromLonLat([st.x, st.y])
                  : transform([st.x, st.y], 'EPSG:32648', 'EPSG:3857');
                pendingStationRef.current = { type: 'wq', id: wqId, st };
                setFlashCoords(coords as [number, number]);
              }
            }
          } else {
            if (selectedWqStation?.id !== wqId) setPopupDeviceId(null);
            setSelectedWqStation((prev) => {
              if (prev?.id === wqId) return null;
              const st = wqStationsRef.current?.find(s => s.id === wqId);
              return st || null;
            });
          }
          handled = true;
        }
        // Ecowitt marker: open popup on click (mobile) / hover (desktop)
        const devId = feature.get("deviceId") as string | undefined;
        if (devId) {
          if (isMobileRef.current) {
            // Mobile: if same station already selected, close it
            if (popupDeviceId === devId) {
              setPopupDeviceId(null);
            } else {
              // Clear pixel inspector before flash
              setMouseCoords(null);
              setPixelValues({});
              // Hide overlays so map is clear
              hideOverlays();
              // Flash then open popup
              const device = ecowittDevices.find(d => d.id === devId);
              if (device && device.lat != null && device.lng != null) {
                const coords = fromLonLat([device.lng, device.lat]);
                pendingStationRef.current = { type: 'ecowitt', id: devId };
                setFlashCoords(coords as [number, number]);
              }
            }
          } else {
            if (popupDeviceId !== devId) setSelectedWqStation(null);
            setPopupDeviceId((prev) => (prev === devId ? null : devId));
          }
          handled = true;
        }
      }
      if (!handled) {
        setPopupDeviceId(null);
        setSelectedWqStation(null);
      }

      // Mobile: tap to inspect pixel values (skip if tapping a station)
      if (isMobileRef.current && !handled) {
        setMouseCoords(evt.coordinate as [number, number]);
        const layers = layerRefs.current;
        const collected: Record<string, number> = {};
        let firstValue: number | null = null;
        if (layers && typeof layers === 'object') {
          const visibleLayers = Object.entries(layers)
            .filter(([, layer]) => layer.getVisible())
            .sort((a, b) => (b[1].getZIndex?.() ?? 0) - (a[1].getZIndex?.() ?? 0));
          for (const [key, layer] of visibleLayers) {
            try {
              if (!('getData' in layer)) continue;
              if (!renderedLayersRef.current[key]) continue;
              const buf = (layer as import("ol/layer/WebGLTile").default).getData(evt.pixel);
              if (buf && !(buf instanceof DataView) && buf.length > 0) {
                const val = buf[0];
                const info = renderedLayersRef.current[key];
                
                // Only collect if value is NOT background (0) or NoData
                if (val !== 0 && val !== (info as { nodata?: number }).nodata) {
                  collected[key] = val;
                  if (firstValue === null) firstValue = val;
                }
              }
            } catch { /* skip layer */ }
          }
        }
        setPixelValues(collected);
        setPixelValue(firstValue);
      }
    });

    // Force multiple size updates to ensure proper rendering
    const updateSizes = [0, 100, 300, 500];
    updateSizes.forEach((delay) => {
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.updateSize();
        }
      }, delay);
    });

    map.on("pointermove", (evt) => {
      const coordinate = evt.coordinate;

      // Desktop: real-time pixel inspection on hover
      if (!isMobileRef.current) {
        const hoveredFeature = map.forEachFeatureAtPixel(evt.pixel, (f) => f as Feature | undefined);
        const hoveredDeviceId = hoveredFeature?.get("deviceId") as string | undefined;
        if (hoveredDeviceId) {
          map.getTargetElement().style.cursor = "pointer";
        } else {
          map.getTargetElement().style.cursor = "";
        }

        const now = performance.now();
        if (now - pointermoveThrottleRef.current < 80) {
          if (pointermoveRafRef.current) cancelAnimationFrame(pointermoveRafRef.current);
          pointermoveRafRef.current = requestAnimationFrame(() => {
            pointermoveRafRef.current = null;
            if (!mapRef.current) return;
            pointermoveThrottleRef.current = performance.now();
            const layers = layerRefs.current;
            const collected: Record<string, number> = {};
            let firstValue: number | null = null;
            if (layers && typeof layers === 'object') {
              const visibleLayers = Object.entries(layers)
                .filter(([, layer]) => layer.getVisible())
                .sort((a, b) => (b[1].getZIndex?.() ?? 0) - (a[1].getZIndex?.() ?? 0));
              for (const [key, layer] of visibleLayers) {
                try {
                  if (!('getData' in layer)) continue;
                  if (!renderedLayersRef.current[key]) continue;
                  const buf = (layer as import("ol/layer/WebGLTile").default).getData(evt.pixel);
                  if (buf && !(buf instanceof DataView) && buf.length > 0) {
                    const val = buf[0];
                    const info = renderedLayersRef.current[key];
                    if (val !== 0 && val !== (info as { nodata?: number }).nodata) {
                      collected[key] = val;
                      if (firstValue === null) firstValue = val;
                    }
                  }
                } catch { /* skip layer */ }
              }
            }
            setPixelValues(collected);
            setPixelValue(firstValue);
          });
          setMouseCoords(coordinate as [number, number]);
          return;
        }
        pointermoveThrottleRef.current = now;
        setMouseCoords(coordinate as [number, number]);

        const layers = layerRefs.current;
        const collected: Record<string, number> = {};
        let firstValue: number | null = null;
        if (layers && typeof layers === 'object') {
          const visibleLayers = Object.entries(layers)
            .filter(([, layer]) => layer.getVisible())
            .sort((a, b) => (b[1].getZIndex?.() ?? 0) - (a[1].getZIndex?.() ?? 0));

          for (const [key, layer] of visibleLayers) {
            try {
              if (!('getData' in layer)) continue;
              // Only read from active rendered layers, not fading-out old layers
              if (!renderedLayersRef.current[key]) continue;
              const buf = (layer as import("ol/layer/WebGLTile").default).getData(evt.pixel);
              if (buf && !(buf instanceof DataView) && buf.length > 0) {
                const val = buf[0];
                const info = renderedLayersRef.current[key];
                
                // Only collect if value is NOT background (0) or NoData
                if (val !== 0 && val !== (info as { nodata?: number }).nodata) {
                  collected[key] = val;
                  if (firstValue === null) firstValue = val;
                }
              }
            } catch { /* skip layer */ }
          }
        }
        setPixelValues(collected);
        setPixelValue(firstValue);
      }
    });

    const mapViewport = map.getViewport();
    mapViewport.addEventListener("pointerleave", () => {
      if (!isMobileRef.current) {
        setMouseCoords(null);
        setPixelValues({});
        setPixelValue(null);
        mapViewport.style.cursor = "";
      }
    });

    return () => {
      if (pointermoveRafRef.current) {
        cancelAnimationFrame(pointermoveRafRef.current);
        pointermoveRafRef.current = null;
      }
      const layers = layerRefs.current;
      if (layers && typeof layers === 'object') {
        for (const layer of Object.values(layers)) {
          layer.getSource()?.dispose?.();
        }
      }
      layerRefs.current = {};
      ecowittLayerRef.current = null;
      inspectLayerRef.current = null;
      baseLayerRef.current = null;
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Toggle ecowitt station markers visibility based on applied datasets
  useEffect(() => {
    if (ecowittLayerRef.current) {
      const hasEcowitt = (appliedDatasets ?? []).some(ds => ds.id.startsWith("weather"));
      ecowittLayerRef.current.setVisible(hasEcowitt);
    }
    if (wqLayerRef.current) {
      const hasWq = (appliedDatasets ?? []).some(ds => ds.id === "wq-surface" || ds.id === "wq-ground");
      wqLayerRef.current.setVisible(hasWq);
    }
  }, [appliedDatasets]);

  // Fetch device info (coordinates, name) từ Ecowitt API
  // Re-fetch khi mở popup hoặc tab quay lại để đảm bảo luôn có device list mới nhất
  useEffect(() => {
    let active = true;
    fetch('/api/ecowitt/devices')
      .then((r) => r.json())
      .then((res) => {
        if (!active) return;
        if (res.devices && Array.isArray(res.devices) && res.devices.length > 0) {
          setEcowittDevices(res.devices);
        } else {
          setEcowittDevices([...ECOWITT_DEVICES] as EcowittDevice[]);
        }
      })
      .catch(() => {
        if (active) setEcowittDevices([...ECOWITT_DEVICES] as EcowittDevice[]);
      });
    return () => { active = false; };
  }, []);

  // Sync selection flags on map features and run pulse animation loop for selected marker
  useEffect(() => {
    const ecowittSource = ecowittSourceRef.current;
    const wqSource = wqSourceRef.current;
    
    // Update selected property on features
    if (ecowittSource) {
      ecowittSource.getFeatures().forEach(f => {
        f.set("selected", f.getId() === popupDeviceId);
      });
      ecowittSource.changed();
    }
    if (wqSource) {
      wqSource.getFeatures().forEach(f => {
        f.set("selected", f.getId() === selectedWqStation?.id);
      });
      wqSource.changed();
    }

    if (!popupDeviceId && !selectedWqStation) return;

    let animId: number;
    const tick = () => {
      if (ecowittSource && popupDeviceId) ecowittSource.changed();
      if (wqSource && selectedWqStation) wqSource.changed();
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [popupDeviceId, selectedWqStation]);

  // Mobile inspection pin: show at tapped position when inspector is active
  useEffect(() => {
    const source = inspectSourceRef.current;
    const layer = inspectLayerRef.current;
    if (!source || !layer) return;

    const showPin = isMobile && mouseCoords !== null && Object.keys(pixelValues).length > 0 && !flashCoords;

    if (showPin) {
      source.clear();
      const feature = new Feature({
        geometry: new Point(mouseCoords),
      });
      source.addFeature(feature);
      layer.setVisible(true);
    } else {
      source.clear();
      layer.setVisible(false);
    }
  }, [isMobile, mouseCoords, pixelValues, flashCoords]);

  // Save/Restore Map View State when selecting/deselecting stations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const view = map.getView();
    if (!view) return;

    const hasSelection = !!popupDeviceId || !!selectedWqStation;

    if (hasSelection) {
      if (!previousMapViewStateRef.current) {
        const center = view.getCenter();
        const zoom = view.getZoom();
        if (center && zoom !== undefined) {
          previousMapViewStateRef.current = {
            center: [center[0], center[1]],
            zoom: zoom
          };
        }
      }
    } else {
      restoreOverlays();
      if (previousMapViewStateRef.current) {
        const saved = previousMapViewStateRef.current;
        previousMapViewStateRef.current = null; // Clear first to prevent loop
        view.cancelAnimations();
        view.animate({
          center: saved.center,
          zoom: saved.zoom,
          duration: 800,
          easing: easeOut,
        });
      }
    }
  }, [popupDeviceId, selectedWqStation]);

  // Zoom and pan map to selected manual station, with offset to avoid popup coverage
  useEffect(() => {
    if (skipZoomRef.current) {
      skipZoomRef.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map || !selectedWqStation) return;
    const view = map.getView();
    if (!view) return;

    const st = selectedWqStation;
    if (st.x != null && st.y != null) {
      const isWgs84 = Math.abs(st.x) <= 180 && Math.abs(st.y) <= 90;
      const coords = isWgs84
        ? fromLonLat([st.x, st.y])
        : transform([st.x, st.y], 'EPSG:32648', 'EPSG:3857');

      const targetResolution = (view.getResolutionForZoom ? view.getResolutionForZoom(12.5) : view.getResolution()) || 26;
      const hasImages = st.stationType === 'surface_water';

      if (isMobile) {
        // Mobile: marker must be visible above the bottom popup (60vh popup + 12px gap)
        // Shift map UP to show marker in top 35% of screen
        const offsetPixels = -Math.round(window.innerHeight * 0.3);
        const offsetY = offsetPixels * targetResolution;
        view.cancelAnimations();
        view.animate({
          center: [coords[0], coords[1] - offsetY],
          zoom: 11,
          duration: 800,
          easing: easeOut,
        });
      } else {
        // Desktop: shift map to the East so marker is left of the popup
        const offsetPixels = hasImages ? 350 : 220;
        const offsetX = offsetPixels * targetResolution;
        view.cancelAnimations();
        view.animate({
          center: [coords[0] + offsetX, coords[1]],
          zoom: 12.5,
          duration: 800,
          easing: easeOut,
        });
      }
    }
  }, [selectedWqStation, isMobile]);

  // Zoom and pan map to selected Ecowitt station, with a slight offset to avoid popup coverage
  useEffect(() => {
    if (skipZoomRef.current) {
      skipZoomRef.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map || !popupDeviceId) return;
    const view = map.getView();
    if (!view) return;

    const device = ecowittDevices.find(d => d.id === popupDeviceId);
    if (device && device.lat != null && device.lng != null) {
      const coords = fromLonLat([device.lng, device.lat]);
      // Calculate target resolution at zoom 12.5 to get correct pixel offset
      const targetResolution = (view.getResolutionForZoom ? view.getResolutionForZoom(12.5) : view.getResolution()) || 26;
      // Ecowitt popup is narrower, shift map center East by ~140px
      const offsetX = 140 * targetResolution;
      const offsetCoords = [coords[0] + offsetX, coords[1]];

      view.cancelAnimations();
      view.animate({
        center: offsetCoords,
        zoom: 12.5,
        duration: 800,
        easing: easeOut,
      });
    }
  }, [popupDeviceId, ecowittDevices]);

  // Flash animation when tapping a station on mobile
  useEffect(() => {
    if (!flashCoords) return;

    const map = mapRef.current;
    const view = map?.getView();
    const source = inspectSourceRef.current;
    const layer = inspectLayerRef.current;
    if (!map || !view || !source || !layer) {
      setFlashCoords(null);
      return;
    }

    // Save current view state before zooming (so restoring works)
    if (!previousMapViewStateRef.current) {
      const currCenter = view.getCenter();
      const currZoom = view.getZoom();
      if (currCenter && currZoom !== undefined) {
        previousMapViewStateRef.current = {
          center: [currCenter[0], currCenter[1]],
          zoom: currZoom,
        };
      }
    }

    // Zoom to station (no offset, center on station)
    view.cancelAnimations();
    view.animate({
      center: flashCoords,
      zoom: 12.5,
      duration: 700,
      easing: easeOut,
    });

    // Show flash pin
    source.clear();
    const flashFeature = new Feature({
      geometry: new Point(flashCoords),
    });
    flashFeature.set('pulse', 0);
    source.addFeature(flashFeature);
    layer.setVisible(true);

    // Flash 2 smooth pulses using requestAnimationFrame
    const startTime = Date.now();
    const duration = 1400;
    let animId: number;

    function tick() {
      const elapsed = Date.now() - startTime;

      if (elapsed >= duration) {
        source!.clear();
        layer!.setVisible(false);

        const pending = pendingStationRef.current;
        pendingStationRef.current = null;
        if (pending) {
          skipZoomRef.current = true;
          if (pending.type === 'wq') {
            setSelectedWqStation(pending.st);
          } else {
            setPopupDeviceId(pending.id);
          }
        }
        setFlashCoords(null);
        return;
      }

      const t = elapsed / duration;
      const pulse = Math.abs(Math.sin(t * Math.PI * 2));
      flashFeature.set('pulse', pulse);
      source!.changed();
      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      source!.clear();
      layer!.setVisible(false);
      pendingStationRef.current = null;
    };
  }, [flashCoords]);

  // Update marker features when ecowittDevices changes
  useEffect(() => {
    const source = ecowittSourceRef.current;
    if (!source) return;
    source.clear();
    ecowittDevices.forEach((device) => {
      if (device.lat != null && device.lng != null) {
        const feature = new Feature({
          geometry: new Point(fromLonLat([device.lng, device.lat])),
          deviceId: device.id,
          name: device.name,
        });
        feature.setId(device.id);
        source.addFeature(feature);
      }
    });
  }, [ecowittDevices]);

  // Update manual station markers when waterQualityStations changes
  useEffect(() => {
    const source = wqSourceRef.current;
    if (!source) return;
    wqStationsRef.current = waterQualityStations ?? [];
    source.clear();
    (waterQualityStations ?? []).forEach((st) => {
      if (st.x != null && st.y != null) {
        const isWgs84 = Math.abs(st.x) <= 180 && Math.abs(st.y) <= 90;
        const sourceProj = isWgs84 ? 'EPSG:4326' : 'EPSG:32648';
        const coords = isWgs84
          ? fromLonLat([st.x, st.y])
          : transform([st.x, st.y], 'EPSG:32648', 'EPSG:3857');
        const feature = new Feature({
          geometry: new Point(coords),
          wqStationId: st.id,
          stationType: st.stationType,
          name: st.location,
          stationId: st.stationId,
        });
        feature.setId(st.id);
        source.addFeature(feature);
      }
    });
  }, [waterQualityStations]);

  // Fetch WQ samples + images when a manual station is selected
  useEffect(() => {
    if (!selectedWqStation || !selectedWqStation.id) {
      setWqStationSamples([]);
      setWqStationSampleDate('');
      setWqStationSample(null);
      setWqStationImages([]);
      setActiveWqImageIdx(0);
      return;
    }
    setActiveWqImageIdx(0);
    const st = selectedWqStation;
    const stId = st.id!;
    setWqSamplesLoading(true);

    // Fetch samples
    listWaterQualitySamples(stId).then(samples => {
      const sorted = (samples || []).sort((a, b) => b.sampleDate.localeCompare(a.sampleDate));
      setWqStationSamples(sorted);
      if (sorted.length > 0) {
        setWqStationSampleDate(sorted[0].sampleDate);
        getWaterQualitySample(sorted[0].id).then(detail => {
          setWqStationSample(detail);
        }).catch(e => {
          console.warn("[WQ] Failed to load sample detail:", e);
          setWqStationSample(null);
        });
      } else {
        setWqStationSampleDate('');
        setWqStationSample(null);
      }
      setWqSamplesLoading(false);
    }).catch(e => {
      console.warn("[WQ] Failed to load samples list:", e);
      setWqStationSamples([]);
      setWqStationSampleDate('');
      setWqStationSample(null);
      setWqSamplesLoading(false);
    });

    // Load images
    if (st.stationType === 'surface_water' && st.imageCode) {
      console.log("[WQ] Loading images for station:", st.id, st.imageCode);
      const keys = st.imageCode.split(',').map(k => k.trim()).filter(Boolean);
      console.log("[WQ] Image keys:", keys);
      Promise.all(keys.map(async (key) => {
        try {
          const url = getBackendAdminUrl(`/s3/download?key=${encodeURIComponent(key)}`);
          console.log("[WQ] Fetching image:", url);
          const res = await fetch(url);
          console.log("[WQ] Image response:", res.status, res.ok);
          if (res.ok) {
            const blob = await res.blob();
            const objUrl = URL.createObjectURL(blob);
            console.log("[WQ] Image loaded, blob size:", blob.size);
            return objUrl;
          } else {
            console.warn("[WQ] Image fetch not OK:", res.status, res.statusText);
          }
        } catch (e) {
          console.warn("[WQ] Failed to load image:", key, e);
        }
        return '';
      })).then(urls => {
        console.log("[WQ] All images loaded:", urls.filter(Boolean).length);
        setWqStationImages(urls.filter(Boolean));
      });
    } else {
      console.log("[WQ] No images to load. stationType:", st.stationType, "imageCode:", st.imageCode);
      setWqStationImages([]);
    }
  }, [selectedWqStation]);

  // Fetch sample detail when date changes
  useEffect(() => {
    if (!selectedWqStation || !wqStationSampleDate) return;
    const sample = wqStationSamples.find(s => s.sampleDate === wqStationSampleDate);
    if (sample) {
      if (sample.parameters) {
        setWqStationSample(sample);
      } else {
        getWaterQualitySample(sample.id).then(detail => {
          setWqStationSample(detail);
        }).catch(() => setWqStationSample(null));
      }
    }
  }, [wqStationSampleDate, wqStationSamples, selectedWqStation]);

  // Fetch dữ liệu Ecowitt khi mở popup trạm
  useEffect(() => {
    if (!popupDeviceId) {
      setPopupData([]);
      setPopupError("");
      return;
    }

    let isActive = true;
    setPopupLoading(true);
    setPopupError("");
    setPopupData([]);

    const sdate = `${popupDate} 00:00`;
    const edate = `${popupDate} 23:59`;
    const params = new URLSearchParams({
      action: "get_data",
      deviceId: popupDeviceId,
      sdate,
      edate,
    });
    fetch(`/api/ecowitt/proxy?${params}`)
      .then((res) => res.json() as Promise<{ data?: Record<string, unknown>; error?: string }>)
      .then((result) => {
        if (!isActive) return;
        if (!result.data?.times) throw new Error("No data from Ecowitt");
        const parsed = parseEcowittPopupData(result.data);
        const valid = parsed.filter((d) =>
          Object.entries(d).some(([k, v]) => k !== "time" && v !== undefined && !Number.isNaN(Number(v)) && Number(v) !== 0)
        );
        setPopupData(valid);
      })
      .catch((err: unknown) => {
        if (isActive) setPopupError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (isActive) setPopupLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [popupDeviceId, popupDate]);

  // Update map size on window resize
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleResize = () => {
      map.updateSize();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        map.updateSize();
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const currentBaseLayer = baseLayerRef.current;

    if (!map || !currentBaseLayer) {
      return;
    }

    const newBaseLayer = new TileLayer({
      source: baseLayers[activeBaseLayer].source(),
    });

    map.removeLayer(currentBaseLayer);
    map.getLayers().insertAt(0, newBaseLayer);
    baseLayerRef.current = newBaseLayer;
  }, [activeBaseLayer]);

  return (
    <>
    <section className="geo-map">
      <div className="geo-map-canvas">
        <div 
          ref={mapContainerRef} 
          className="geo-map-viewport" 
          aria-label="OpenLayers Map" 
          onMouseLeave={() => {
            if (!isMobile) {
              setMouseCoords(null);
              setPixelValue(null);
            }
          }}
        />

        {/* Preload Loading Overlay */}
        {pbLoading && (
          <div className="geo-map-preload-overlay">
            <div className="geo-map-preload-box">
              <div className="geo-map-preload-spinner" />
              <span className="geo-map-preload-text">
                Preparing time-lapse data…
              </span>
              <span className="geo-map-preload-sub">
                {pbProgressText || "Downloading frames for smooth playback. Please wait."}
              </span>
            </div>
          </div>
        )}

        {/* Top Floating Controls Wrapper */}
        <div className={`map-top-controls-wrapper ${isMobile ? 'map-top-controls-wrapper--mobile' : ''}`}>
          {/* Layers Button & Dropdown */}
          <div className="map-player-control" ref={playerControlRef}>
            <button
              className="map-add-layer-btn"
              onClick={() => { setShowPlayerDropdown(!showPlayerDropdown); setPendingLayerId(null); }}
              type="button"
              title="Manage layers"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
              <span>Layers</span>
            </button>

            {showPlayerDropdown && (
              <div className={`map-player-dropdown ${isMobile ? 'map-player-dropdown--mobile' : ''}`}>
                {isMobile && (
                  <div className="map-player-dropdown-handle" />
                )}
                <div className="map-player-dropdown-header">
                  <div className="map-player-dropdown-title">My Layers</div>
                  {isMobile && (
                    <button
                      className="map-player-dropdown-close"
                      type="button"
                      onClick={() => setShowPlayerDropdown(false)}
                      title="Close"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
                <div className="map-player-list">
                  {playerLayers.filter(l => l.added).length === 0 && (
                    <div className="map-player-empty">No layers added yet. Add layers from the sidebar or data panel.</div>
                  )}
                  {playerLayers.filter(l => l.added).map((layer) => {
                    const layerKey = getLayerKey(layer);
                    return (
                      <div
                        key={layerKey}
                        className={`map-player-item ${dragLayerId === layerKey ? "is-dragging" : ""} ${!layer.visible ? "is-inactive" : ""}`}
                        draggable={!isMobile}
                        onDragStart={() => !isMobile && setDragLayerId(layerKey)}
                        onDragEnd={() => !isMobile && setDragLayerId(null)}
                        onDragOver={(e) => { if (!isMobile) e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!isMobile && dragLayerId) reorderLayers(dragLayerId, layerKey);
                        }}
                      >
                        {/* Drag handle (desktop) / reorder buttons (mobile) */}
                        {!isMobile && (
                          <span className="map-player-drag-handle" title="Drag to reorder">
                            <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
                              <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
                              <circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/>
                              <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
                              <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
                            </svg>
                          </span>
                        )}
                        {isMobile && (
                          <span className="map-player-reorder">
                            <button className="map-player-reorder-btn" type="button" onClick={(e) => { e.stopPropagation(); const idx = playerLayers.findIndex(l => getLayerKey(l) === layerKey); if (idx > 0) reorderLayers(layerKey, getLayerKey(playerLayers[idx - 1])); }} tabIndex={-1}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button className="map-player-reorder-btn" type="button" onClick={(e) => { e.stopPropagation(); const idx = playerLayers.findIndex(l => getLayerKey(l) === layerKey); if (idx < playerLayers.length - 1) reorderLayers(layerKey, getLayerKey(playerLayers[idx + 1])); }} tabIndex={-1}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                          </span>
                        )}
                        {/* Category badge */}
                        <span className={`map-player-item-type map-player-item-type--${layer.categoryId}`}>
                          {layer.categoryId === "hydrology" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-5.33 4.55-8 8.48-8 11.8C4 17.78 7.58 22 12 22s8-4.22 8-8.2C20 10.48 17.33 6.55 12 2z"/></svg>
                          )}
                          {layer.categoryId === "weather" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>
                          )}
                          {layer.categoryId === "flooding" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                          )}
                          {layer.categoryId === "baseline" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>
                          )}
                          {layer.categoryId === "ecology" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21h1.3c2.12-4.2 4.87-8 11.88-10V8zm3-5c-3.86 0-7.15 2.33-8.72 5.71L13 10c1.33-2.73 4.05-4.62 7.22-4.96V3c0-.55-.45-1-1-1z"/></svg>
                          )}
                          {layer.categoryId === "landsat" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3C2 3 1 4 1 5v14c0 1.1.9 2 2 2h18c1 0 2-1 2-2V5c0-1-1-2-2-2zm0 16H3V5h18v14zM5 15l3.5-4.5 2.5 3.01L14.5 9l4.5 6H5z"/></svg>
                          )}
                          {layer.categoryId === "admin" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z"/></svg>
                          )}
                          {layer.categoryId === "water-quality" && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
                          )}
                          <span>{isMobile && layer.categoryName === "Landsat Imagery" ? "Landsat" : layer.categoryName}</span>
                        </span>

                        {/* Layer name */}
                        <span className="map-player-item-name">{layer.name}</span>

                        {/* Opacity slider — only when added */}
                        {layer.added && (
                          <input
                            className="map-player-opacity-slider"
                            type="range"
                            min={0} max={1} step={0.05}
                            value={layer.opacity ?? 0.7}
                            title={`Opacity: ${Math.round((layer.opacity ?? 0.7) * 100)}%`}
                            draggable={false}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setPlayerLayers(prev => prev.map(l => getLayerKey(l) === layerKey ? { ...l, opacity: val } : l));
                            }}
                          />
                        )}

                        {/* Layer type badge */}
                        {layer.type && (
                          <span className="map-player-item-type-badge">{isMobile ? layer.type === "raster" ? "R" : layer.type === "vector" ? "V" : layer.type : layer.type}</span>
                        )}

                        {/* Downloads + Visibility + Remove */}
                        <div className="map-player-item-actions">
                          {layer.proxyUrl && (() => {
                            const dlKey = (() => { try { return new URL(layer.proxyUrl!, window.location.origin).searchParams.get('key'); } catch { return null; } })();
                            return (<>
                              <button className="map-player-item-dl" title="Download TIFF" type="button"
                                onClick={(e) => { e.stopPropagation();
                                  if (dlKey) { const a = document.createElement('a'); a.href = `/api/s3/download?key=${encodeURIComponent(dlKey)}`; a.download = dlKey.split('/').pop() || 'download.tif'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                                }}>
                                <Download size={13} />
                              </button>
                              <button className="map-player-item-dl" title="Copy S3 key" type="button"
                                onClick={(e) => { e.stopPropagation(); if (dlKey) { try { navigator.clipboard?.writeText(dlKey); } catch { const ta = document.createElement('textarea'); ta.value = dlKey; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } } }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                              </button>
                            </>);
                          })()}
                          <button
                            className={`map-player-item-tick ${layer.visible ? "is-visible" : ""}`}
                            title={layer.visible ? "Hide layer" : "Show layer"}
                            type="button"
                            onClick={() => toggleLayerVisibility(layerKey)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </button>
                          <button
                            className="map-player-item-remove"
                            title="Remove layer"
                            type="button"
                            onClick={() => removeLayer(layerKey)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary of added layers */}
                {playerLayers.some(l => l.added) && (
                  <div className="map-player-summary">
                    <span>{playerLayers.filter(l => l.added).length} layers added</span>
                    <button
                      className="map-player-summary-clear"
                      type="button"
                      onClick={() => setPlayerLayers(prev => prev.map(l => ({ ...l, added: false, visible: false, type: undefined })))}
                    >Clear all</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top Control Bar — Temporal Timeline */}
          <div className="map-top-bar">
            {!isTimelinePlaying && (
              <TemporalTimelineControl
                activeScale={activeTemporalScale}
                yearValue={temporalYearValue}
                dayValue={temporalDayValue}
                hourValue={temporalHourValue}
                applicableScales={temporalApplicableScales}
                onYearChange={handleTemporalYearChange}
                onDayChange={handleTemporalDayChange}
                onHourChange={handleTemporalHourChange}
                onScaleChange={handleTemporalScaleChange}
                onTimeLapse={handleTemporalTimeLapse}
                isMobile={isMobile}
              />
            )}
          </div>

          {/* Base Layer Switcher */}
          <div className="map-layer-switcher">
            <button
              className="map-layer-toggle"
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              type="button"
              title="Change base layer"
            >
              <MapIcon size={18} />
            </button>

            {showLayerMenu && (
              <div className="map-layer-menu">
                <div className="map-layer-switcher-title">Base Layers</div>
                {(Object.keys(baseLayers) as BaseLayerType[]).map((layerKey) => (
                  <label key={layerKey} className="map-layer-item">
                    <input
                      type="radio"
                      name="baseLayer"
                      checked={activeBaseLayer === layerKey}
                      onChange={() => {
                        setActiveBaseLayer(layerKey);
                        setShowLayerMenu(false);
                      }}
                    />
                    <span>{baseLayers[layerKey].name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>



        {/* Ultra-Compact Video-style Time-Lapse Player */}
        {(isTimelinePlaying || playbackQueue.length > 0) && (
          <div className="map-video-mini-player">
            <button
              className="map-video-btn"
              onClick={() => setPlaybackIndex(p => Math.max(0, p - 1))}
              type="button"
              title="Previous"
            >
              <SkipBack size={16} fill="currentColor" />
            </button>
            
            <button
              className={`map-video-btn ${isTimelinePlaying ? 'is-active' : ''}`}
              onClick={() => {
                if (!isTimelinePlaying && playbackIndex >= playbackQueue.length - 1) {
                  setPlaybackIndex(0);
                  setIsTimelinePlaying(true);
                } else {
                  setIsTimelinePlaying(!isTimelinePlaying);
                }
              }}
              type="button"
              title={pbLoading ? 'Loading...' : isTimelinePlaying ? 'Pause' : playbackIndex >= playbackQueue.length - 1 ? 'Replay' : 'Play'}
              disabled={pbLoading}
            >
              {isTimelinePlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                playbackIndex >= playbackQueue.length - 1 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                  </svg>
                ) : (
                  <Play size={18} fill="currentColor" />
                )
              )}
            </button>

            <button
              className="map-video-btn"
              onClick={() => setPlaybackIndex(p => Math.min(playbackQueue.length - 1, p + 1))}
              type="button"
              title="Next"
            >
              <SkipForward size={16} fill="currentColor" />
            </button>

            <div className="map-video-date-wrap">
              <span className="map-video-date">
                {playbackQueue[playbackIndex]?.label || 'Loading...'}
              </span>
            </div>

            {/* Seeker Bar in middle */}
            <div 
              className="map-video-seeker-container"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                const newIdx = Math.floor(percent * playbackQueue.length);
                setPlaybackIndex(Math.min(playbackQueue.length - 1, Math.max(0, newIdx)));
              }}
            >
              <div className="map-video-seeker-bg" />
              <div 
                className="map-video-seeker-fill"
                style={{ width: `${((playbackIndex + 1) / playbackQueue.length) * 100}%` }}
              />
              <div 
                className="map-video-seeker-handle"
                style={{ left: `${((playbackIndex + 1) / playbackQueue.length) * 100}%` }}
              />
            </div>
            
            <div className="map-video-mini-right">
              <span className="map-video-counter">
                {playbackIndex + 1}/{playbackQueue.length}
              </span>
              
              {pbLoading ? (
                <div className="map-video-spinner" />
              ) : (
                <button 
                  className="map-video-close"
                  onClick={() => {
                    setPlaybackQueue([]);
                    setPlaybackIndex(0);
                    setIsTimelinePlaying(false);
                  }}
                  title="Exit"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image Lightbox */}
        {wqImagePreviewUrl && (
          <div onClick={() => setWqImagePreviewUrl(null)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', zIndex: 100001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out'
            }}>
            <img src={wqImagePreviewUrl} alt="Preview"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '95vw', maxHeight: '95vh', borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }} />
            <button onClick={() => setWqImagePreviewUrl(null)}
              style={{
                position: 'absolute', top: '20px', right: '20px',
                background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                fontSize: '1.5rem', cursor: 'pointer', padding: '8px 14px', borderRadius: '8px'
              }}>✕</button>
          </div>
        )}

        {(Object.keys(pixelValues).length > 0 && mouseCoords !== null) && (
          <div className={`geo-map-inspector ${isMobile ? 'geo-map-inspector--mobile' : ''}`}>
            {/* Header */}
            <div 
              className="geo-map-inspector-header"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 16px' }}
              onClick={() => setIsInspectorCollapsed(!isInspectorCollapsed)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="geo-map-inspector-indicator" />
                <span style={{ fontWeight: '700', fontSize: '0.92rem', color: '#0f172a', textTransform: 'none', letterSpacing: 'normal' }}>Map Inspector</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '2px' }}
                  aria-label={isInspectorCollapsed ? "Expand inspector" : "Collapse inspector"}
                >
                  <span style={{ fontSize: '0.72rem' }}>{isInspectorCollapsed ? "▼" : "▲"}</span>
                </button>
                {isMobile && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPixelValues({}); setMouseCoords(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '2px' }}
                    aria-label="Close inspector"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            {!isInspectorCollapsed && (
              <div className="geo-map-inspector-body">
                {/* UTM row */}
                <div className="geo-map-inspector-row" style={{ paddingBottom: '4px' }}>
                  <span className="geo-map-inspector-label" style={{ fontWeight: 600, fontSize: '0.78rem' }}>UTM (48N)</span>
                  <span className="geo-map-inspector-val" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', gap: '2px' }}>
                    {mouseCoords ? (() => {
                      const lonLat = toLonLat(mouseCoords);
                      const utm = transform(lonLat, 'EPSG:4326', 'EPSG:32648');
                      return (
                        <>
                          <span>{Math.round(utm[0]).toLocaleString()} m E</span>
                          <span>{Math.round(utm[1]).toLocaleString()} m N</span>
                        </>
                      );
                    })() : (
                      <>
                        <span>— m E</span>
                        <span>— m N</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }} />

                {(() => {
                  // Merge actual and virtual hovered entries
                  const inspectorEntries = [...Object.entries(pixelValues)];

                  return inspectorEntries.map(([key, val]) => {
                    let layerInfo = renderedLayers[key] || renderedLayersRef.current[key];
                    let displayName = "";
                    if (layerInfo) {
                      displayName = layerInfo.name;
                    } else {
                      const ds = getDatasetById(key);
                      if (ds) {
                        displayName = `${ds.name} (${temporalYearValue})`;
                      } else {
                        return null;
                      }
                    }
                    if (isLanduseLayer(key) && displayName.includes(" - ")) {
                      displayName = displayName.substring(displayName.indexOf(" - ") + 3);
                    }
                    const label = translateLegendLabel(displayName);
                    const unitMatch = label.match(/\(([^)]+)\)/);
                    const HYDRO_UNITS: Record<string, string> = {
                      "hydro-salinity": "ppt",
                      "hydro-temp": "cm",
                      "hydro-ph": "",
                    };
                    const hydroPrefix = Object.keys(HYDRO_UNITS).find(p => key.startsWith(p));
                    const unit = hydroPrefix ? HYDRO_UNITS[hydroPrefix] : (unitMatch ? unitMatch[1] : "");
                    const isExpanded = inspectorExpandedKey === key;
                    const s3Key = (layerInfo && (layerInfo.type === "raster" || layerInfo.type === "vector")) ? layerInfo.proxyUrl : "";
                    const dateMatch = s3Key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
                    const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;
                    
                    const isLu = isLanduseLayer(key);
                    const normKey = normalizeLanduseKey(key);
                    const cacheKey = `${normKey}__${temporalYearValue}`;
                    const luStats = isLu ? landuseStats[cacheKey] : undefined;
                    const statsLoading = isLu && luStats === undefined && landuseStatsFetching.current.has(cacheKey);

                    return (
                      <div key={key} className="geo-map-inspector-layer">
                        {isLu ? (
                          <>
                            {/* Layer name toggle */}
                            <button
                              className="geo-map-inspector-layer-btn"
                              type="button"
                              onClick={() => setInspectorExpandedKey(isExpanded ? null : key)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px 0',
                                textAlign: 'left'
                              }}
                            >
                              <span style={{
                                fontSize: '0.88rem',
                                fontWeight: '700',
                                color: '#0f172a',
                                lineHeight: '1.35',
                                flex: 1,
                                paddingRight: '8px'
                              }}>
                                {displayName}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                            </button>

                            {/* Stats */}
                            {statsLoading && !luStats && (
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', animation: 'geo-map-spin 0.8s linear infinite' }} />
                                <span>Computing stats...</span>
                              </div>
                            )}

                            {luStats && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', fontSize: '0.82rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: '#64748b', fontWeight: 500 }}>Area (ha)</span>
                                  <span style={{ fontWeight: '700', color: '#0f172a' }}>
                                    ~{luStats.areaHa.toLocaleString(undefined, { maximumFractionDigits: 0 })} ha
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: '#64748b', fontWeight: 500 }}>Landuse (%)</span>
                                  <span style={{ fontWeight: '700', color: '#0f172a' }}>
                                    {luStats.percentage.toFixed(1)}%
                                  </span>
                              </div>
                            </div>
                            )}

                            {luYearly && luYearly.length > 1 && (
                              <div className="geo-map-inspector-chart-container" style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Area by Year</div>
                                {(() => {
                                  const vals = luYearly.map(d => d.areaHa);
                                  const rawMax = Math.max(...vals, 1);
                                  const niceCeil = (() => {
                                    if (rawMax <= 0) return 1;
                                    const exp = Math.floor(Math.log10(rawMax));
                                    const base = Math.pow(10, exp);
                                    const norm = rawMax / base;
                                    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
                                    return nice * base;
                                  })();
                                  const cur = temporalYearValue;
                                  const years = luYearly.map(d => d.year);
                                  const latestYear = years[years.length - 1];
                                  const valFmt = (v: number) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v >= 100 ? v.toFixed(0) : v.toFixed(1);
                                  const linePts = luYearly.map((d, i) => {
                                    const bh = Math.max(4, 2 + (d.areaHa / niceCeil) * 56);
                                    const x = ((i + 0.5) / luYearly.length * 100).toFixed(1);
                                    const y = (84 - bh).toFixed(0);
                                    return `${x} ${y}`;
                                  }).join(' ');
                                  return (
                                    <div style={{ padding: '0 2px' }}>
                                      <div style={{ position: 'relative', height: 84 }}>
                                        <svg viewBox="0 0 100 84" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                          <polyline points={linePts} fill="none" stroke="#64748b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
                                        </svg>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 84 }}>
                                        {luYearly.map(d => {
                                          const h = Math.max(4, 2 + (d.areaHa / niceCeil) * 56);
                                          const isCur = Number(d.year) === Number(cur)
                                            || (years.every(y => Number(y) !== Number(cur)) && Number(d.year) === Number(latestYear));
                                          return (
                                            <div key={d.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.year}: ${d.areaHa.toLocaleString()} ha` + (isCur ? ' (current)' : '')}>
                                              <span style={{ fontSize: '0.55rem', fontWeight: 700, color: isCur ? '#d97706' : '#1e40af' }}>{valFmt(d.areaHa)}</span>
                                              <div style={{ width: '100%', maxWidth: 28, height: h, borderRadius: '4px 4px 0 0', background: isCur ? '#f59e0b' : '#3b82f6', border: isCur ? '1px solid #d97706' : '1px solid #2563eb' }} />
                                            </div>
                                          );
                                        })}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 3, paddingTop: 3 }}>
                                        {luYearly.map(d => {
                                          const isCur = Number(d.year) === Number(cur)
                                            || (years.every(y => Number(y) !== Number(cur)) && Number(d.year) === Number(latestYear));
                                          return (
                                            <span key={d.year} style={{ flex: 1, textAlign: 'center', fontSize: '0.58rem', color: isCur ? '#d97706' : '#64748b', fontWeight: isCur ? 700 : 500 }}>{d.year}</span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {activeLuId && !luYearly && (
                              <div style={{ marginTop: 8, padding: "6px 0", fontSize: "0.75rem", color: "#94a3b8", textAlign: "center" }}>
                                Loading yearly data...
                              </div>
                            )}

                            {activeLuId && luYearly && luYearly.length <= 1 && (
                              <div style={{ marginTop: 8, padding: "4px 0", fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" }}>
                                {luYearly.length === 0 ? "No computed data" : "Only 1 year of data"}
                              </div>
                            )}
                          </>
                        ) : (
                          // Non-landuse simple layer
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                            <span className="geo-map-inspector-layer-name" style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>{displayName}</span>
                            <span className="geo-map-inspector-val value-highlight" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>
                              {val.toFixed(2)}{unit ? ` ${unit}` : ""}
                            </span>
                          </div>
                        )}

                        {/* Extra detail metadata if expanded */}
                        {isExpanded && (
                          <div className="geo-map-inspector-detail" style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', marginTop: '6px', fontSize: '0.72rem', color: '#475569', gap: '4px' }}>
                            {dateStr && <div><span className="geo-map-inspector-label" style={{ fontWeight: 600 }}>Date:</span> {dateStr}</div>}
                            {luStats && (
                              <>
                                <div><span className="geo-map-inspector-label" style={{ fontWeight: 600 }}>Area:</span> {luStats.areaHa.toLocaleString(undefined, { maximumFractionDigits: 0 })} ha</div>
                                <div><span className="geo-map-inspector-label" style={{ fontWeight: 600 }}>Coverage:</span> {luStats.percentage.toFixed(1)}%</div>
                              </>
                            )}
                            <div><span className="geo-map-inspector-label" style={{ fontWeight: 600 }}>Layer key:</span> {key}</div>
                            {layerInfo && <div><span className="geo-map-inspector-label" style={{ fontWeight: 600 }}>Type:</span> {layerInfo.type}</div>}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>

        {/* ---- Ecowitt Station Popup ---- */}
        {popupDeviceId && (() => {
          const device = ecowittDevices.find((d) => d.id === popupDeviceId);
          if (!device) return null;
          return (
            <EcowittStationPopup
              device={device}
              data={popupData}
              loading={popupLoading}
              error={popupError}
              dateStr={popupDate}
              onDateChange={setPopupDate}
              onClose={() => setPopupDeviceId(null)}
              isMobile={isMobile}
            />
          );
        })()}

        {/* ---- Water Quality Station Popup ---- */}
        {selectedWqStation && (
          <div className={`map-station-popup ${isMobile ? 'map-station-popup--mobile' : ''}`} onClick={(e) => e.stopPropagation()} style={{
            position: isMobile ? 'fixed' : 'absolute',
            top: isMobile ? 'auto' : '110px',
            right: isMobile ? '12px' : '12px',
            bottom: isMobile ? '12px' : 'auto',
            left: isMobile ? '12px' : 'auto',
            width: isMobile ? 'auto' : (selectedWqStation.stationType === 'surface_water' ? '720px' : '420px'), 
            background: isMobile ? 'rgba(255,255,255,0.92)' : '#ffffff', 
            borderRadius: '16px',
            boxShadow: isMobile ? '0 4px 24px rgba(0,0,0,0.15)' : '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)', 
            zIndex: isMobile ? 10000 : 1000,
            border: '1px solid #e2e8f0',
            backdropFilter: isMobile ? 'blur(16px)' : undefined,
            WebkitBackdropFilter: isMobile ? 'blur(16px)' : undefined,
          }}>
            {/* Header */}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '14px 16px', 
              borderBottom: '1px solid #e2e8f0',
              background: `linear-gradient(135deg, ${selectedWqStation.stationType === 'groundwater' ? 'rgba(13, 110, 253, 0.05)' : 'rgba(25, 135, 84, 0.05)'} 0%, #ffffff 100%)`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <MapPin size={18} color={selectedWqStation.stationType === 'groundwater' ? '#0d6efd' : '#198754'} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={selectedWqStation.location || ''}>
                    {selectedWqStation.location || 'Manual Station'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
                    ID: {selectedWqStation.stationId || '—'}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedWqStation(null)}
                style={{ 
                  background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569', 
                  width: isMobile ? '36px' : '28px', height: isMobile ? '36px' : '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
              >
                <X size={isMobile ? 18 : 14} />
              </button>
            </div>

            {/* Body */}
            {selectedWqStation.stationType === 'surface_water' ? (
              <div className={`map-station-popup-body-wrap ${isMobile ? 'map-station-popup-body-wrap--mobile' : ''}`}>
                {/* LEFT: Large Image Display */}
                <div className="map-station-popup-left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', marginBottom: '2px' }}>
                    <Image size={14} color="#10b981" />
                    <strong style={{ fontSize: '0.82rem' }}>Field Photos</strong>
                  </div>
                  
                  {wqStationImages.length > 0 ? (
                    isMobile ? (
                      <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }} className="custom-scrollbar">
                        {wqStationImages.map((url, idx) => (
                          <img key={idx} src={url} alt={`Field photo ${idx + 1}`} onClick={() => setWqImagePreviewUrl(url)}
                            style={{ width: '100px', height: '72px', borderRadius: '8px', border: '1px solid #cbd5e1', objectFit: 'cover', cursor: 'zoom-in', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'block', flexShrink: 0 }} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '430px', overflowY: 'auto' }} className="custom-scrollbar">
                        {wqStationImages.map((url, idx) => (
                          <img key={idx} src={url} alt={`Field photo ${idx + 1}`} onClick={() => setWqImagePreviewUrl(url)}
                            style={{ width: '100%', height: '200px', borderRadius: '10px', border: '1px solid #cbd5e1', objectFit: 'cover', cursor: 'zoom-in', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'block' }} />
                        ))}
                      </div>
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '200px', borderRadius: '10px', border: '1px dashed #cbd5e1', background: '#f8fafc', color: '#94a3b8', fontSize: '0.8rem' }}>
                      <Image size={24} />
                      No field photos available
                    </div>
                  )}
                </div>

                {/* RIGHT: Station Details + Parameters */}
                <div className="map-station-popup-right">
                  <div style={{ fontSize: '0.8rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: '500' }}>Water type:</span>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(25, 135, 84, 0.1)', color: '#198754' }}>Surface Water</span>
                    </div>
                    {selectedWqStation.hydroChar && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ color: '#64748b', fontWeight: '500', flexShrink: 0 }}>Hydro characteristics:</span>
                        <span style={{ fontWeight: '600', color: '#0f172a', textAlign: 'right' }}>{selectedWqStation.hydroChar}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: '500' }}>Coordinates (X, Y):</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#0f172a' }}>{selectedWqStation.x?.toFixed(4)}, {selectedWqStation.y?.toFixed(4)}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                        <Activity size={14} color="var(--accent)" />
                    <strong style={{ fontSize: '0.82rem' }}>Monitoring Data</strong>
                      </div>
{wqSamplesLoading && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Loading...</span>}
                    </div>

                    {wqStationSamples.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                          <label style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={13} /> Sample date:</label>
                          <select value={wqStationSampleDate} onChange={e => setWqStationSampleDate(e.target.value)}
                            style={{ flex: 1, padding: '5px 8px', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', color: '#0f172a', cursor: 'pointer', fontWeight: '600' }}>
                            {wqStationSamples.map(s => (<option key={s.id} value={s.sampleDate}>{s.sampleDate}</option>))}
                          </select>
                        </div>

                        {wqStationSample && wqStationSample.parameters && wqStationSample.parameters.length > 0 ? (
                          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                                  {['Parameter', 'Unit', 'Value', 'Standard'].map(h => (<th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>{h}</th>))}
                                </tr>
                              </thead>
                              <tbody>
                                {wqStationSample.parameters.map((p, idx) => (
                                  <tr key={idx} style={{ borderBottom: idx === wqStationSample.parameters!.length - 1 ? 'none' : '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfdfe' }}>
                                    <td style={{ padding: '6px 10px', fontWeight: '600', color: '#0f172a' }}>{p.parameterName}</td>
                                    <td style={{ padding: '6px 10px', color: '#475569' }}>{p.unit || '—'}</td>
                                    <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono",monospace', color: '#0f172a', fontWeight: '600' }}>{p.valueRaw || '—'}</td>
                                    <td style={{ padding: '6px 10px', color: '#64748b', fontSize: '0.72rem' }}>{p.referenceStandard || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : wqSamplesLoading ? null : (
                          <p style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', margin: '4px 0' }}>Could not load data details.</p>
                        )}
                      </>
                    ) : (
                      !wqSamplesLoading && (<p style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', margin: '4px 0' }}>No monitoring data for this station.</p>)
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.8rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Water type:</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(13, 110, 253, 0.1)', color: '#0d6efd' }}>Groundwater</span>
                  </div>
                  {selectedWqStation.hydroChar && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ color: '#64748b', fontWeight: '500', flexShrink: 0 }}>Hydro characteristics:</span>
                      <span style={{ fontWeight: '600', color: '#0f172a', textAlign: 'right' }}>{selectedWqStation.hydroChar}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: '500' }}>Coordinates (X, Y):</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#0f172a' }}>{selectedWqStation.x?.toFixed(4)}, {selectedWqStation.y?.toFixed(4)}</span>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                      <Activity size={14} color="var(--accent)" />
                      <strong style={{ fontSize: '0.82rem' }}>Monitoring Data</strong>
                    </div>
                    {wqSamplesLoading && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Loading...</span>}
                  </div>
                  {wqStationSamples.length > 0 ? (
                    <>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                        <label style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={13} /> Sample date:</label>
                        <select value={wqStationSampleDate} onChange={e => setWqStationSampleDate(e.target.value)}
                          style={{ flex: 1, padding: '5px 8px', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', color: '#0f172a', cursor: 'pointer', fontWeight: '600' }}>
                          {wqStationSamples.map(s => (<option key={s.id} value={s.sampleDate}>{s.sampleDate}</option>))}
                        </select>
                      </div>
                      {wqStationSample && wqStationSample.parameters && wqStationSample.parameters.length > 0 ? (
                        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead><tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                              {['Parameter', 'Unit', 'Value', 'Standard'].map(h => (<th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>{h}</th>))}
                            </tr></thead>
                            <tbody>
                              {wqStationSample.parameters.map((p, idx) => (
                                <tr key={idx} style={{ borderBottom: idx === wqStationSample.parameters!.length - 1 ? 'none' : '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfdfe' }}>
                                  <td style={{ padding: '6px 10px', fontWeight: '600', color: '#0f172a' }}>{p.parameterName}</td>
                                  <td style={{ padding: '6px 10px', color: '#475569' }}>{p.unit || '—'}</td>
                                  <td style={{ padding: '6px 10px', fontFamily: '"JetBrains Mono",monospace', color: '#0f172a', fontWeight: '600' }}>{p.valueRaw || '—'}</td>
                                  <td style={{ padding: '6px 10px', color: '#64748b', fontSize: '0.72rem' }}>{p.referenceStandard || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : wqSamplesLoading ? null : (<p style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', margin: '4px 0' }}>Could not load data details.</p>)}
                    </>
                  ) : (!wqSamplesLoading && <p style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', margin: '4px 0' }}>No monitoring data for this station.</p>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- Mobile Popup Backdrop ---- */}
        {isMobile && (popupDeviceId || selectedWqStation || showPlayerDropdown) && (
          <div className="popup-backdrop" onClick={() => { setPopupDeviceId(null); setSelectedWqStation(null); setShowPlayerDropdown(false); }} />
        )}
    </section>

    {/* ---- Time-Lapse Picker (root level, outside geo-map) ---- */}
    {showPlaybackPicker && (
      <>
        <div className="pb-picker-backdrop" onClick={() => setShowPlaybackPicker(false)} />
        <div className={`pb-picker-panel ${isMobile ? 'pb-picker-panel--mobile' : ''}`}>
          <div className="pb-picker-header">
            <div className="pb-picker-title">
              <Clock size={16} />
              Set Time-Lapse Period
            </div>
            <button className="pb-picker-close" onClick={() => setShowPlaybackPicker(false)} type="button">×</button>
          </div>

          <div className="pb-picker-body">
            <div className="pb-field">
              <label className="pb-label">Start Date</label>
              <input 
                className="pb-input" 
                type="date" 
                value={pbStartDate} 
                onChange={e => { 
                  const newStart = e.target.value;
                  setPbStartDate(newStart); 
                  setPbError("");
                  // Auto-set end date to +7 days
                  if (newStart) {
                    const d = new Date(newStart);
                    d.setDate(d.getDate() + 7);
                    setPbEndDate(d.toISOString().slice(0, 10));
                  }
                }} 
              />
            </div>
            <div className="pb-field">
              <label className="pb-label">End Date (Max 7 days from start)</label>
              <input className="pb-input" type="date" value={pbEndDate} onChange={e => { setPbEndDate(e.target.value); setPbError(""); }} />
            </div>
            {pbError && <div className="pb-error">{pbError}</div>}
          </div>

          <div className="pb-picker-footer">
            <button className="pb-btn-cancel" onClick={() => setShowPlaybackPicker(false)} type="button">Cancel</button>
            <button className="pb-btn-play" onClick={handleStartPlayback} type="button">
              <Play size={14} fill="currentColor" />
              Play
            </button>
          </div>
        </div>
      </>
    )}
  </>
);
}, (prevProps, nextProps) => {
  // Custom comparison - chỉ re-render khi props thực sự thay đổi
  const datasetsEqual: boolean = 
    prevProps.appliedDatasets?.length === nextProps.appliedDatasets?.length &&
    (prevProps.appliedDatasets?.every((d, i) => 
      d.id === nextProps.appliedDatasets?.[i]?.id && 
      d.type === nextProps.appliedDatasets?.[i]?.type
    ) ?? false);
  
  const wqEqual: boolean = 
    prevProps.waterQualityStations?.length === nextProps.waterQualityStations?.length &&
    (prevProps.waterQualityStations?.every((s, i) => 
      s.id === nextProps.waterQualityStations?.[i]?.id
    ) ?? false);
  
  return (
    prevProps.startDateTime === nextProps.startDateTime &&
    prevProps.endDateTime === nextProps.endDateTime &&
    datasetsEqual &&
    wqEqual &&
    prevProps.isMobile === nextProps.isMobile &&
    prevProps.onRemoveDataset === nextProps.onRemoveDataset &&
    prevProps.onAddDataset === nextProps.onAddDataset &&
    prevProps.onStartDateTimeChange === nextProps.onStartDateTimeChange &&
    prevProps.onEndDateTimeChange === nextProps.onEndDateTimeChange &&
    prevProps.hoveredDatasetId === nextProps.hoveredDatasetId
  );
});
