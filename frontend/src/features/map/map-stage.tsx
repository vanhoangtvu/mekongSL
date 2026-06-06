"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat, toLonLat, transform } from "ol/proj";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Style, Circle, Fill, Stroke, Text } from "ol/style";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { DATASETS } from "../../lib/constants/datasets";
import { ECOWITT_DEVICES, type EcowittDevice } from "../../lib/constants/data-sources";
import { useS3DatasetLayers } from "./useS3DatasetLayers";
import type { ManualStation } from "../../lib/admin-api";
import { listWaterQualitySamples, getWaterQualitySample, getBackendAdminUrl, type WaterQualitySampleDto } from "../../lib/admin-api";

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
  { key: "tempf", label: "Nhiệt độ", unit: "°F", color: "#ff6b6b" },
  { key: "humidity", label: "Độ ẩm", unit: "%", color: "#4ecdc4" },
  { key: "wind_speed", label: "Tốc độ gió", unit: "mph", color: "#45b7d1" },
  { key: "rain_daily", label: "Mưa ngày", unit: "in", color: "#6c5ce7" },
  { key: "pressure_rel", label: "Áp suất", unit: "inHg", color: "#ffd93d" },
  { key: "solar_radiation", label: "Bức xạ MT", unit: "W/m²", color: "#ff8a5c" },
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
  type?: string;
  opacity: number;
};

const ALL_AVAILABLE_LAYERS: PlayerLayer[] = DATASETS.flatMap((cat) =>
  cat.children
    ? cat.children.map((child) => ({
        id: child.id,
        name: child.name,
        categoryId: cat.id,
        categoryName: cat.name,
        added: false,
        opacity: 0.7,
      }))
    : [{
        id: cat.id,
        name: cat.name,
        categoryId: cat.id,
        categoryName: cat.name,
        added: false,
        opacity: 0.7,
      }]
);

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

type TimelineUnitMode = "auto" | "hour4" | "day" | "month";
type TimelineResolvedMode = "hour4" | "day" | "month";

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

  return "month";
}

// Fixed observation hours matching S3 data (00:00, 05:00, 10:00, 15:00, 20:00)
const OBS_HOURS = [0, 5, 10, 15, 20];

function buildTimelineUnits(startDate: Date, endDate: Date, mode: TimelineResolvedMode) {
  if (mode === "hour4") {
    const units: TimelineUnit[] = [];
    let cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    while (cur <= endDate) {
      for (const h of OBS_HOURS) {
        const t = new Date(cur);
        t.setHours(h, 0, 0, 0);
        if (t > endDate) break;
        const hh = String(h).padStart(2, "0");
        units.push({
          label: `${t.getDate()}/${t.getMonth() + 1} ${hh}:00`,
          value: t.toISOString(),
          isMajor: h === 0,
        });
      }
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

    units.push({
      label: formatMonthLabel(current),
      value: current.toISOString(),
      isMajor: isFirstDay, // Only major if it's the 1st of the month
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
  expanded,
  dateStr,
  onDateChange,
  onClose,
  onExpand,
  onCollapse,
}: {
  device: { id: string; name: string; lat?: number; lng?: number };
  data: EcowittPopupSensorData[];
  loading: boolean;
  error: string;
  expanded: boolean;
  dateStr: string;
  onDateChange: (d: string) => void;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const popupW = expanded ? "340px" : "290px";

  const getLatest = (key: EcowittPopupSensorKey): string => {
    const v = latestData?.[key];
    return v !== undefined && !Number.isNaN(Number(v)) ? Number(v).toFixed(2) : "--";
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "72px",
        ...(expanded ? { bottom: "110px" } : {}),
        right: "12px",
        width: popupW,
        background: "#fff",
        borderRadius: "14px",
        boxShadow: "0 6px 32px rgba(0,0,0,0.18)",
        zIndex: 500,
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%)",
          color: "#fff",
          padding: "10px 12px 9px",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: "0.6rem",
            opacity: 0.78,
            fontWeight: "600",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Trạm Ecowitt · {device.id}
        </div>
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: "700",
            lineHeight: 1.25,
            paddingRight: "24px",
            marginTop: "2px",
          }}
        >
          {device.name}
        </div>
        {device.lat != null && (
          <div style={{ fontSize: "0.63rem", opacity: 0.72, marginTop: "2px" }}>
            {device.lat.toFixed(4)}°N, {device.lng?.toFixed(4)}°E
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "#fff",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: "0.95rem",
            lineHeight: "20px",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
          title="Đóng"
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
            padding: "3px 6px",
            fontSize: "0.75rem",
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
          overflowY: expanded ? "auto" : "hidden",
          minHeight: 0,
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
            Đang tải dữ liệu...
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

        {/* ═══ COMPACT VIEW ═══ */}
        {!loading && !error && !expanded && (
          <div style={{ padding: "10px" }}>
            {latestData ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {ECOWITT_POPUP_SENSORS.slice(0, 4).map((sensor) => {
                  const display = getLatest(sensor.key);
                  return (
                    <div
                      key={sensor.key}
                      style={{
                        borderRadius: "10px",
                        background: `${sensor.color}0e`,
                        border: `1px solid ${sensor.color}28`,
                        overflow: "hidden",
                        padding: "8px 9px 0",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.6rem",
                          color: "#64748b",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {sensor.label}
                      </div>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "800",
                          color: sensor.color,
                          marginTop: "1px",
                        }}
                      >
                        {display}
                        <span
                          style={{
                            fontSize: "0.62rem",
                            fontWeight: "500",
                            color: "#94a3b8",
                            marginLeft: "2px",
                          }}
                        >
                          {sensor.unit}
                        </span>
                      </div>
                      <SensorChart
                        data={data}
                        sensor={sensor}
                        hoveredIdx={hoveredIdx}
                        onHover={setHoveredIdx}
                        chartH={40}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              !loading && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px 0",
                    color: "#94a3b8",
                    fontSize: "0.8rem",
                  }}
                >
                  Không có dữ liệu hôm nay
                </div>
              )
            )}

            {/* Expand button */}
            <button
              type="button"
              onClick={onExpand}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "6px 0",
                background: "linear-gradient(135deg,rgba(13,110,253,0.07),rgba(13,202,240,0.07))",
                border: "1px solid rgba(13,110,253,0.18)",
                borderRadius: "8px",
                color: "#0d6efd",
                fontSize: "0.72rem",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              Xem chi tiết
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        )}

        {/* ═══ EXPANDED VIEW ═══ */}
        {!loading && !error && expanded && (
          <div style={{ padding: "10px" }}>
            {/* Collapse button */}
            <button
              type="button"
              onClick={onCollapse}
              style={{
                width: "100%",
                marginBottom: "9px",
                padding: "5px 0",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "7px",
                color: "#64748b",
                fontSize: "0.68rem",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              Thu gọn
            </button>

            {/* Latest values table */}
            {latestData && (
              <>
                <div
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: "700",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: "6px",
                  }}
                >
                  Thông số mới nhất
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
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
                            fontSize: "0.59rem",
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
                            fontSize: "0.95rem",
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
              </>
            )}

            {/* Charts for all 7 sensors */}
            {data.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: "700",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: "8px",
                  }}
                >
                  Biểu đồ trong ngày
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
                          fontSize: "0.67rem",
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
                          fontSize: "0.7rem",
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
                      />
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* No data */}
            {data.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0",
                  color: "#94a3b8",
                  fontSize: "0.8rem",
                }}
              >
                Không có dữ liệu hôm nay
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MapStage({ startDateTime, endDateTime, appliedDatasets, onRemoveDataset, onAddDataset, onStartDateTimeChange, onEndDateTimeChange, waterQualityStations }: MapStageProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const ecowittLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const ecowittSourceRef = useRef<VectorSource | null>(null);
  const wqLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wqSourceRef = useRef<VectorSource | null>(null);
  const wqStationsRef = useRef<ManualStation[]>([]);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const [pixelValue, setPixelValue] = useState<number | null>(null);
  const [pixelValues, setPixelValues] = useState<Record<string, number>>({});
  const [mouseCoords, setMouseCoords] = useState<[number, number] | null>(null);
  const [inspectorExpandedKey, setInspectorExpandedKey] = useState<string | null>(null);

  const [timelineUnitMode, setTimelineUnitMode] = useState<TimelineUnitMode>("auto");

  const startDate = useMemo(() => parseDateTimeLocal(startDateTime), [startDateTime]);
  const endDate = useMemo(() => parseDateTimeLocal(endDateTime), [endDateTime]);

  const timelineData = useMemo(() => {
    if (!startDate || !endDate) {
      return { mode: "day" as TimelineResolvedMode, units: [] as TimelineUnit[] };
    }

    const normalizedStart = startDate <= endDate ? startDate : endDate;
    const normalizedEnd = startDate <= endDate ? endDate : startDate;
    const resolvedMode = resolveTimelineMode(normalizedStart, normalizedEnd, timelineUnitMode);

    return buildTimelineUnits(normalizedStart, normalizedEnd, resolvedMode);
  }, [startDate, endDate, timelineUnitMode]);

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
    const d = new Date(unit.value);
    return `${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}`;
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

  const { renderedLayers, layerRefs, layersCacheRef } = useS3DatasetLayers(appliedDatasets, mapRef, timelineDate, timeSlot, prefetchDate, allTimelineDates);

  // Prepare state: preload all frames before playing
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState({ current: 0, total: 1, label: '' });
  const [isReady, setIsReady] = useState(false);

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
        selected.push({ ...child, added: true, type: ds.type });
      } else {
        const cat = DATASETS.find((c) => c.id === ds.id || c.children?.some((ch) => ch.id === ds.id));
        const item = cat?.children?.find((ch) => ch.id === ds.id) || cat;
        selected.push({
          id: ds.id,
          name: item?.name || ds.id,
          categoryId: cat?.id || ds.id,
          categoryName: cat?.name || ds.id,
          added: true,
          type: ds.type,
          opacity: 0.7,
        });
      }
    }
    // Then append unselected in original ALL_AVAILABLE_LAYERS order
    for (const al of ALL_AVAILABLE_LAYERS) {
      if (!selectedLookup.has(al.id)) {
        unselected.push({ ...al, added: false, type: undefined });
      }
    }
    setPlayerLayers([...selected, ...unselected]);
    setPendingLayerId(null); // close any open popover when list rebuilds
  }, [appliedDatasets]);

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
          olLayer.setVisible(pl.added);
          olLayer.setOpacity(pl.opacity ?? 0.7);
          olLayer.setZIndex(100 + (playerLayers.length - idx));
        }
      }
    });
  }, [playerLayers, renderedLayers]);

  // Playback feature state
  const [showPlaybackPicker, setShowPlaybackPicker] = useState(false);
  const [pbStartDate, setPbStartDate] = useState("");
  const [pbEndDate, setPbEndDate] = useState("");
  const [pbError, setPbError] = useState("");
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.5);
  const [pendingPlayback, setPendingPlayback] = useState<{ start: string; end: string } | null>(null);

  const handleOpenPlayback = () => {
    setPbStartDate("");
    setPbEndDate("");
    setPbError("");
    setIsReady(false);
    setShowPlaybackPicker(true);
  };

  // Store playback frames for controlling auto-advance range
  const playbackFramesRef = useRef<TimelineUnit[]>([]);

  // Auto-advance timeline during playback (only within selected frames)
  const playbackInterval = useMemo(() => Math.max(200, 1000 / playbackSpeed), [playbackSpeed]);

  useEffect(() => {
    if (!isTimelinePlaying || timelineUnits.length === 0) return;
    const frames = playbackFramesRef.current;
    if (frames.length === 0) return;
    const lastFrameIdx = timelineUnits.findIndex(u => u.value === frames[frames.length - 1].value);
    const interval = setInterval(() => {
      setTimelineIndex((prev) => {
        if (prev >= lastFrameIdx) {
          setIsTimelinePlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackInterval);
    return () => clearInterval(interval);
  }, [isTimelinePlaying, timelineUnits.length, playbackInterval]);

  const handleStartPlayback = () => {
    if (!pbStartDate || !pbEndDate) {
      setPbError("Please select both start and end date.");
      return;
    }
    if (pbStartDate > pbEndDate) {
      setPbError("Start date must be before end date.");
      return;
    }

    // Check if timelineUnits already covers the playback range
    const firstInTimeline = timelineUnits.length > 0 ? timelineUnits[0].value.slice(0, 10) : null;
    const lastInTimeline = timelineUnits.length > 0 ? timelineUnits[timelineUnits.length - 1].value.slice(0, 10) : null;
    const rangeCoversPlayback = firstInTimeline && lastInTimeline &&
      firstInTimeline <= pbStartDate && lastInTimeline >= pbEndDate;

    if (!rangeCoversPlayback) {
      // Expand sidebar date range to cover the playback period
      if (onStartDateTimeChange) {
        const currentStart = startDateTime.slice(0, 10);
        if (pbStartDate < currentStart) {
          onStartDateTimeChange(pbStartDate + "T00:00");
        }
      }
      if (onEndDateTimeChange) {
        const currentEnd = endDateTime.slice(0, 10);
        if (pbEndDate > currentEnd) {
          onEndDateTimeChange(pbEndDate + "T23:59");
        }
      }
      // Defer playback start until timelineUnits expands to cover the range
      setShowPlaybackPicker(false);
      setPendingPlayback({ start: pbStartDate, end: pbEndDate });
      return;
    }

    // Timeline already covers the range — start playback immediately
    setIsPreparing(true);
    setIsReady(false);

    const frames = timelineUnits.filter(u => {
      const d = u.value.slice(0, 10);
      return d >= pbStartDate && d <= pbEndDate;
    });

    playbackFramesRef.current = frames;

    setPrepareProgress({ current: 0, total: frames.length, label: 'Starting...' });

    const cache = layersCacheRef.current;
    const loadedDates = new Set(Object.keys(cache));
    const uniqueDates = [...new Set(frames.map(f => f.value.slice(0, 10)))].filter(d => !loadedDates.has(d));

    const firstFrameValue = frames.length > 0 ? frames[0].value : null;

    let idx = 0;
    const preloadNext = () => {
      if (idx >= uniqueDates.length) {
        setIsPreparing(false);
        setIsReady(true);
        setShowPlaybackPicker(false);
        if (firstFrameValue) {
          const firstUnit = timelineUnits.findIndex(u => u.value === firstFrameValue);
          if (firstUnit >= 0) setTimelineIndex(firstUnit);
        }
        setPrepareProgress({ current: frames.length, total: frames.length, label: 'Playing' });
        setIsTimelinePlaying(true);
        return;
      }
      const date = uniqueDates[idx];
      setPrepareProgress({ current: idx + 1, total: uniqueDates.length, label: date });
      setTimelineDate(date);
      setTimeSlot("00-00");
      const matchIdx = timelineUnits.findIndex(u => u.value.startsWith(date));
      if (matchIdx >= 0) setTimelineIndex(matchIdx);
      idx++;
      setTimeout(preloadNext, 1500);
    };

    if (uniqueDates.length === 0) {
      setIsPreparing(false);
      setIsReady(true);
      setShowPlaybackPicker(false);
      if (firstFrameValue) {
        const firstUnit = timelineUnits.findIndex(u => u.value === firstFrameValue);
        if (firstUnit >= 0) setTimelineIndex(firstUnit);
      }
      setPrepareProgress({ current: frames.length, total: frames.length, label: 'Playing' });
      setIsTimelinePlaying(true);
    } else {
      preloadNext();
    }
  };

  const confirmAddLayer = (key: string, layerType: "raster" | "vector") => {
    setPlayerLayers(prev => prev.map(l => getLayerKey(l) === key ? { ...l, added: true, type: layerType } : l));
    setPendingLayerId(null);
    // Sync lên appliedDatasets — lấy id từ key (bỏ suffix -raster/-vector nếu có)
    const id = key.replace(/-(?:raster|vector)$/, "");
    onAddDataset?.(id, layerType);
  };

  const removeLayer = (key: string) => {
    setPlayerLayers(prev => prev.map(l => getLayerKey(l) === key ? { ...l, added: false, type: undefined } : l));
    setPendingLayerId(prev => prev === key ? null : prev);
    // Sync ngược lên appliedDatasets
    const [id, type] = key.split(/-(?=[^-]*$)/); // split at last dash
    onRemoveDataset?.(id, type ?? "raster");
  };

  // Drag-and-drop reordering
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);

  // Ecowitt station popup state
  const [popupDeviceId, setPopupDeviceId] = useState<string | null>(null);
  const [popupData, setPopupData] = useState<EcowittPopupSensorData[]>([]);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState("");
  const [popupExpanded, setPopupExpanded] = useState(false);
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
  ];

  useEffect(() => {
    if (timelineUnits.length === 0) return;
    // Don't reset timeline position during playback or preload
    if (isTimelinePlaying || isPreparing) return;
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
  }, [startDateTime, endDateTime, appliedDatasets, isTimelinePlaying, isPreparing]);

  useEffect(() => {
    if (timelineUnits.length === 0) {
      return;
    }

    setTimelineIndex((currentIndex) => Math.min(currentIndex, timelineUnits.length - 1));
  }, [timelineUnits.length]);

  // ── When timelineUnits expands to cover pending playback range, start playback ──
  useEffect(() => {
    if (!pendingPlayback) return;
    const { start, end } = pendingPlayback;
    // Check if timelineUnits now covers the requested range
    const firstInTimeline = timelineUnits.length > 0 ? timelineUnits[0].value.slice(0, 10) : null;
    const lastInTimeline = timelineUnits.length > 0 ? timelineUnits[timelineUnits.length - 1].value.slice(0, 10) : null;
    if (!firstInTimeline || !lastInTimeline) return;
    if (firstInTimeline <= start && lastInTimeline >= end) {
      setPendingPlayback(null);
      // Now build frames and start playback
      const frames = timelineUnits.filter(u => {
        const d = u.value.slice(0, 10);
        return d >= start && d <= end;
      });
      playbackFramesRef.current = frames;
      if (frames.length === 0) return;

      const firstFrameValue = frames[0].value;
      const firstUnit = timelineUnits.findIndex(u => u.value === firstFrameValue);
      if (firstUnit >= 0) setTimelineIndex(firstUnit);
      setIsTimelinePlaying(true);
    }
  }, [timelineUnits, pendingPlayback]);



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

    // Click handler for station markers — mở popup inline thay vì điều hướng trang
    map.on("click", (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f as Feature | undefined);
      if (feature) {
        const devId = feature.get("deviceId") as string | undefined;
        if (devId) {
          setPopupDeviceId((prev) => (prev === devId ? null : devId));
          return;
        }
        const wqId = feature.get("wqStationId") as number | undefined;
        if (wqId) {
          setSelectedWqStation((prev) => {
            if (prev?.id === wqId) return null;
            const st = wqStationsRef.current?.find(s => s.id === wqId);
            return st || null;
          });
          return;
        }
      }
      setPopupDeviceId(null);
      setSelectedWqStation(null);
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
      setMouseCoords(coordinate as [number, number]);

      const layers = layerRefs.current;
      const collected: Record<string, number> = {};
      let firstValue: number | null = null;
      if (layers && typeof layers === 'object') {
        for (const [key, layer] of Object.entries(layers)) {
          try {
            if (!('getData' in layer)) continue;
            if (!layer.getVisible()) continue;
            const buf = (layer as import("ol/layer/WebGLTile").default).getData(evt.pixel);
            if (buf && !(buf instanceof DataView) && buf.length > 0 && buf[0] > 0) {
              collected[key] = buf[0];
              if (firstValue === null) firstValue = buf[0];
            }
          } catch { /* skip layer */ }
        }
      }
      setPixelValues(collected);
      setPixelValue(firstValue);
    });

    return () => {
      const layers = layerRefs.current;
      if (layers && typeof layers === 'object') {
        for (const layer of Object.values(layers)) {
          layer.getSource()?.dispose?.();
        }
      }
      layerRefs.current = {};
      ecowittLayerRef.current = null;
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

  // Pulse animation loop for selected marker
  useEffect(() => {
    const source = ecowittSourceRef.current;
    if (!source || !popupDeviceId) return;
    let animId: number;
    const tick = () => {
      source.changed();
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [popupDeviceId]);

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
      return;
    }
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
      setPopupExpanded(false);
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
        if (!result.data?.times) throw new Error("Không có dữ liệu từ Ecowitt");
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
    <section className="geo-map">
      <div className="geo-map-canvas">
        <div 
          ref={mapContainerRef} 
          className="geo-map-viewport" 
          aria-label="OpenLayers Map" 
          onMouseLeave={() => {
            setMouseCoords(null);
            setPixelValue(null);
          }}
        />

        {/* Base Layer Switcher */}
        <div className="map-layer-switcher">
          <button
            className="map-layer-toggle"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            type="button"
            title="Change base layer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" />
            </svg>
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

        {/* Add Player Button & Dropdown */}
        <div className="map-player-control">
          <button
            className="map-add-layer-btn"
            onClick={() => { setShowPlayerDropdown(!showPlayerDropdown); setPendingLayerId(null); }}
            type="button"
            title="Manage layers"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
            <span>Add Layer</span>
          </button>

          {showPlayerDropdown && (
            <div className="map-player-dropdown">
              <div className="map-player-dropdown-title">Select Data Layer</div>
              <div className="map-player-list">
                {playerLayers.map((layer) => {
                  const layerKey = getLayerKey(layer);
                  return (
                  <div
                    key={layerKey}
                    className={`map-player-item ${dragLayerId === layerKey ? "is-dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragLayerId(layerKey)}
                    onDragEnd={() => setDragLayerId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragLayerId) reorderLayers(dragLayerId, layerKey);
                    }}
                  >
                    {/* Drag handle */}
                    <span className="map-player-drag-handle" title="Drag to reorder">
                      <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
                        <circle cx="3" cy="6" r="1.5"/><circle cx="7" cy="6" r="1.5"/>
                        <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
                        <circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/>
                      </svg>
                    </span>
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
                      <span>{layer.categoryName}</span>
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
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setPlayerLayers(prev => prev.map(l => getLayerKey(l) === layerKey ? { ...l, opacity: val } : l));
                        }}
                      />
                    )}

                    {/* Layer type badge */}
                    {layer.type && (
                      <span className="map-player-item-type-badge">{layer.type}</span>
                    )}

                    {/* Add / Added button */}
                    {layer.added ? (
                      <button
                        className="map-player-item-tick is-added"
                        title="Added - Click to remove"
                        type="button"
                        onClick={() => removeLayer(layerKey)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                    ) : (
                      <button
                        className={`map-player-item-tick ${pendingLayerId === layerKey ? "is-pending" : ""}`}
                        title="Add layer"
                        type="button"
                        onClick={() => {
                          if (layer.type) {
                            // Already has type from sidebar — add directly
                            confirmAddLayer(layerKey, layer.type as "raster" | "vector");
                          } else {
                            setPendingLayerId(pendingLayerId === layerKey ? null : layerKey);
                          }
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                    )}

                    {/* Inline type-picker popover */}
                    {pendingLayerId === layerKey && (
                      <div className="map-player-type-popover">
                        <div className="map-player-type-popover-label">Select layer format:</div>
                        <div className="map-player-type-popover-options">
                          <button
                            className="map-player-type-opt"
                            type="button"
                            onClick={() => confirmAddLayer(layerKey, "raster")}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                            Raster
                          </button>
                          <button
                            className="map-player-type-opt"
                            type="button"
                            onClick={() => confirmAddLayer(layerKey, "vector")}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3,18 8,8 13,13 18,6"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="13" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/></svg>
                            Vector
                          </button>
                        </div>
                      </div>
                    )}
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
                    onClick={() => setPlayerLayers(prev => prev.map(l => ({ ...l, added: false })))}
                  >Clear all</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="map-zoom-controls">
          <button
            className="map-zoom-btn"
            onClick={() => {
              const view = mapRef.current?.getView();
              if (view) view.animate({ zoom: (view.getZoom() || 10) + 1, duration: 200 });
            }}
            type="button"
            title="Zoom in"
          >
            +
          </button>
          <button
            className="map-zoom-btn"
            onClick={() => {
              const view = mapRef.current?.getView();
              if (view) view.animate({ zoom: (view.getZoom() || 10) - 1, duration: 200 });
            }}
            type="button"
            title="Zoom out"
          >
            −
          </button>
        </div>

        {/* Top Control Bar (Timeline & Playback) */}
        <div className="map-top-bar">
          {showTimeline && (
            <div 
              className="map-timeline-container" 
              data-unit-mode={timelineData.mode} 
              title="Timeline control"
              onMouseLeave={() => setHoverTime(null)}
            >
              {hoverTime && (
                <div 
                  className="map-timeline-tooltip"
                  style={{ 
                    left: `${tooltipPos.x}px`, 
                    top: `${tooltipPos.y}px`,
                    position: 'absolute',
                    zIndex: 100
                  }}
                >
                  {hoverTime}
                </div>
              )}
              <div className="map-timeline-header">
                <div className="map-timeline-unit-control">
                  <button 
                    className={`map-timeline-unit-toggle ${showUnitMenu ? 'is-active' : ''}`}
                    onClick={() => setShowUnitMenu(!showUnitMenu)}
                    title="Select timeline unit"
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 21v-7"></path>
                      <path d="M4 10V3"></path>
                      <path d="M12 21v-9"></path>
                      <path d="M12 8V3"></path>
                      <path d="M20 21v-5"></path>
                      <path d="M20 12V3"></path>
                      <line x1="1" y1="14" x2="7" y2="14"></line>
                      <line x1="9" y1="8" x2="15" y2="8"></line>
                      <line x1="17" y1="16" x2="23" y2="16"></line>
                    </svg>
                    <span className="unit-label-current">{timelineUnitOptions.find(o => o.value === timelineUnitMode)?.label}</span>
                  </button>

                  {showUnitMenu && (
                    <div className="map-timeline-unit-dropdown">
                      {timelineUnitOptions.map((option) => (
                        <button
                          key={option.value}
                          className={`map-timeline-unit-option ${timelineUnitMode === option.value ? "is-active" : ""}`}
                          onClick={() => {
                            setTimelineUnitMode(option.value);
                            setShowUnitMenu(false);
                          }}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div 
                ref={scrollerRef}
                className="map-timeline-scroller" 
                onClick={(event) => event.stopPropagation()}
                onMouseMove={(e) => {
                  const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!containerRect) return;

                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, x / rect.width));
                  const index = Math.round(ratio * (timelineUnits.length - 1));
                  const unit = timelineUnits[index];

                  if (unit) {
                    setHoverTime(unit.label);
                    setHoverPos({
                      x: e.clientX - containerRect.left,
                      y: e.clientY - containerRect.top - 25,
                    });
                  }
                }}
              >
                <div className="map-timeline-inner">
                  <div className="map-timeline-track-wrap">
                    <input
                      className="map-timeline-slider"
                      max={Math.max(0, timelineUnits.length - 1)}
                      min="0"
                      onChange={(event) => setTimelineIndex(Number(event.target.value))}
                      style={{
                        "--timeline-fill": `${(timelineIndex / Math.max(1, timelineUnits.length - 1)) * 100}%`,
                      } as CSSProperties}
                      type="range"
                      value={timelineIndex}
                    />
                  </div>
                  <div className="map-timeline-ticks">
                    {timelineUnits.map((unit, index) => (
                      <span
                        key={unit.value}
                        data-label={unit.label}
                        data-major={unit.isMajor ? "true" : "false"}
                        className={`map-timeline-tick ${index === timelineIndex ? "is-active" : ""}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time-Lapse Button & Dropdown Control */}
          <div className="map-playback-control">
            <button
              className="map-playback-btn"
              onClick={handleOpenPlayback}
              type="button"
              title="Time-lapse map animation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5z"/>
              </svg>
              <span>Time-Lapse</span>
            </button>

            {showPlaybackPicker && (
              <>
                <div className="pb-picker-backdrop" onClick={() => setShowPlaybackPicker(false)} />
                <div className="pb-picker-panel">
                  <div className="pb-picker-header">
                    <div className="pb-picker-title">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
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
                        onChange={e => { setPbStartDate(e.target.value); setPbError(""); }}
                      />
                    </div>
                    <div className="pb-field">
                      <label className="pb-label">End Date</label>
                      <input
                        className="pb-input"
                        type="date"
                        value={pbEndDate}
                        onChange={e => { setPbEndDate(e.target.value); setPbError(""); }}
                      />
                    </div>
                    {pbError && <div className="pb-error">{pbError}</div>}
                  </div>

                  <div className="pb-picker-footer">
                    <button className="pb-btn-cancel" onClick={() => setShowPlaybackPicker(false)} type="button">Cancel</button>
                    {isPreparing ? (
                      <div className="pb-preparing">
                        <div className="pb-prepare-label">
                          Loading {prepareProgress.current}/{prepareProgress.total}...
                        </div>
                        <div className="pb-prepare-track">
                          <div className="pb-prepare-fill" style={{ width: `${(prepareProgress.current / Math.max(1, prepareProgress.total)) * 100}%` }} />
                        </div>
                      </div>
                    ) : (
                      <button className="pb-btn-play" onClick={handleStartPlayback} type="button" disabled={isPreparing}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7L8 5z"/>
                        </svg>
                        {isReady ? 'Ready' : 'Play'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Timeline Player Controls */}
        {isTimelinePlaying && (
          <div className="map-player-controls">
            <button
              className="map-player-btn"
              onClick={() => { setTimelineIndex((p) => Math.max(0, p - 1)); }}
              type="button"
              title="Previous"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 18l-6-6 6-6v12z"/></svg>
            </button>
            <button
              className={`map-player-btn ${isTimelinePlaying ? 'is-active' : ''}`}
              onClick={() => setIsTimelinePlaying(!isTimelinePlaying)}
              type="button"
              title={isTimelinePlaying ? 'Pause' : 'Play'}
            >
              {isTimelinePlaying ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
              )}
            </button>
            <button
              className="map-player-btn"
              onClick={() => { setTimelineIndex((p) => Math.min(timelineUnits.length - 1, p + 1)); }}
              type="button"
              title="Next"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18l6-6-6-6v12z"/></svg>
            </button>
            <span className="map-player-date">
              {timelineUnits[timelineIndex]?.label || ''}
            </span>
            <div className="map-player-speed">
              {[0.25, 0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  className={`map-player-speed-btn ${playbackSpeed === s ? 'is-active' : ''}`}
                  onClick={() => setPlaybackSpeed(s)}
                  type="button"
                >{s}x</button>
              ))}
            </div>
          </div>
        )}

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
              expanded={popupExpanded}
              dateStr={popupDate}
              onDateChange={setPopupDate}
              onClose={() => setPopupDeviceId(null)}
              onExpand={() => setPopupExpanded(true)}
              onCollapse={() => setPopupExpanded(false)}
            />
          );
        })()}

        {/* ---- Water Quality Station Popup ---- */}
        {selectedWqStation && (
          <div style={{
            position: 'absolute', top: '90px', right: '10px',
            background: '#fff', borderRadius: '12px', zIndex: 1000,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)', width: '680px', maxHeight: '85vh', overflowY: 'auto',
            border: `2px solid ${selectedWqStation.stationType === 'groundwater' ? '#0d6efd' : '#198754'}`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
              <strong style={{ fontSize: '0.95rem', color: '#1a1a2e' }}>
                📍 {selectedWqStation.stationId || 'Trạm thủ công'} — {selectedWqStation.location}
              </strong>
              <button onClick={() => setSelectedWqStation(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px', fontSize: '1.1rem', lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Body: 2 columns (only for surface_water with images) */}
            {selectedWqStation.stationType === 'surface_water' ? (
              <div style={{ display: 'flex', gap: '16px', padding: '12px 16px' }}>
                {/* LEFT: Images */}
                <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {wqStationImages.length > 0 ? (
                    wqStationImages.map((url, idx) => (
                      <img key={idx} src={url} alt={`Ảnh ${idx + 1}`}
                        onClick={() => setWqImagePreviewUrl(url)}
                        style={{ width: '100%', borderRadius: '8px', border: '1px solid #ddd', cursor: 'zoom-in', display: 'block' }} />
                    ))
                  ) : (
                    <div style={{
                      width: '100%', height: '180px', borderRadius: '8px', border: '1px dashed #ddd',
                      background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#ccc', fontSize: '0.85rem'
                    }}>🖼️ Chưa có ảnh</div>
                  )}
                </div>

                {/* RIGHT: Station Info + Data */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Station Info */}
                  <div style={{ fontSize: '0.82rem', color: '#555', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong>Loại:</strong>{' '}
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700',
                        background: 'rgba(25,135,84,0.12)', color: '#198754' }}>
                        Nước mặt
                      </span>
                    </div>
                    {selectedWqStation.hydroChar && <div><strong>Đặc tính thủy vực:</strong> {selectedWqStation.hydroChar}</div>}
                    <div><strong>Tọa độ:</strong> X={selectedWqStation.x?.toFixed(4)}, Y={selectedWqStation.y?.toFixed(4)}</div>
                  </div>
                  {/* WQ Data Panel */}
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#1a1a2e' }}>📊 Dữ liệu quan trắc</strong>
                      {wqSamplesLoading && <span style={{ fontSize: '0.72rem', color: '#999' }}>Đang tải...</span>}
                    </div>
                    {wqStationSamples.length > 0 && (<>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600 }}>Ngày:</label>
                        <select value={wqStationSampleDate} onChange={e => setWqStationSampleDate(e.target.value)}
                          style={{ flex: 1, padding: '5px 8px', fontSize: '0.78rem', border: '1px solid #ddd', borderRadius: '6px', background: '#f8f9fa', cursor: 'pointer' }}>
                          {wqStationSamples.map(s => (<option key={s.id} value={s.sampleDate}>{s.sampleDate}</option>))}
                        </select>
                      </div>
                      {wqStationSample && wqStationSample.parameters && wqStationSample.parameters.length > 0 ? (
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #eee', maxHeight: '250px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                            <thead><tr style={{ background: '#f2f2f2', position: 'sticky', top: 0, zIndex: 1 }}>
                              {['Thông số', 'Đơn vị', 'Giá trị', 'Tiêu chuẩn'].map(h => (
                                <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {wqStationSample.parameters.map((p, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '4px 8px', fontWeight: '600', color: '#333' }}>{p.parameterName}</td>
                                  <td style={{ padding: '4px 8px', color: '#666' }}>{p.unit || '—'}</td>
                                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#333' }}>{p.valueRaw || '—'}</td>
                                  <td style={{ padding: '4px 8px', color: '#666', fontSize: '0.7rem' }}>{p.referenceStandard || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : wqSamplesLoading ? null : (
                        <p style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic', margin: '4px 0' }}>Chưa tải được chi tiết dữ liệu.</p>
                      )}
                    </>)}
                    {!wqSamplesLoading && wqStationSamples.length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic', margin: '4px 0' }}>Chưa có dữ liệu import cho trạm này.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Groundwater: No images, full-width data */
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.82rem', color: '#555', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Loại:</strong>{' '}
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700',
                      background: '#0d6efd18', color: '#0d6efd' }}>
                      Nước ngầm
                    </span>
                  </div>
                  {selectedWqStation.hydroChar && <div><strong>Đặc tính thủy vực:</strong> {selectedWqStation.hydroChar}</div>}
                  <div><strong>Tọa độ:</strong> X={selectedWqStation.x?.toFixed(4)}, Y={selectedWqStation.y?.toFixed(4)}</div>
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#1a1a2e' }}>📊 Dữ liệu quan trắc</strong>
                    {wqSamplesLoading && <span style={{ fontSize: '0.72rem', color: '#999' }}>Đang tải...</span>}
                  </div>
                  {wqStationSamples.length > 0 && (<>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600 }}>Ngày:</label>
                      <select value={wqStationSampleDate} onChange={e => setWqStationSampleDate(e.target.value)}
                        style={{ flex: 1, padding: '5px 8px', fontSize: '0.78rem', border: '1px solid #ddd', borderRadius: '6px', background: '#f8f9fa', cursor: 'pointer' }}>
                        {wqStationSamples.map(s => (<option key={s.id} value={s.sampleDate}>{s.sampleDate}</option>))}
                      </select>
                    </div>
                    {wqStationSample && wqStationSample.parameters && wqStationSample.parameters.length > 0 ? (
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #eee', maxHeight: '250px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                          <thead><tr style={{ background: '#f2f2f2', position: 'sticky', top: 0, zIndex: 1 }}>
                            {['Thông số', 'Đơn vị', 'Giá trị', 'Tiêu chuẩn'].map(h => (
                              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {wqStationSample.parameters.map((p, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '4px 8px', fontWeight: '600', color: '#333' }}>{p.parameterName}</td>
                                <td style={{ padding: '4px 8px', color: '#666' }}>{p.unit || '—'}</td>
                                <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#333' }}>{p.valueRaw || '—'}</td>
                                <td style={{ padding: '4px 8px', color: '#666', fontSize: '0.7rem' }}>{p.referenceStandard || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : wqSamplesLoading ? null : (
                      <p style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic', margin: '4px 0' }}>Chưa tải được chi tiết dữ liệu.</p>
                    )}
                  </>)}
                  {!wqSamplesLoading && wqStationSamples.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic', margin: '4px 0' }}>Chưa có dữ liệu import cho trạm này.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Image Lightbox */}
        {wqImagePreviewUrl && (
          <div onClick={() => setWqImagePreviewUrl(null)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', zIndex: 9999,
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

        {Object.keys(pixelValues).length > 0 && mouseCoords !== null && (
          <div className="geo-map-inspector">
            <div className="geo-map-inspector-header">
              <div className="geo-map-inspector-indicator" />
              <span>Map Inspector</span>
            </div>
            <div className="geo-map-inspector-body">
              <div className="geo-map-inspector-row">
                <span className="geo-map-inspector-label">Coordinates:</span>
                <span className="geo-map-inspector-val">
                  {(() => {
                    const lonLat = toLonLat(mouseCoords);
                    return `${lonLat[1].toFixed(4)}° N, ${lonLat[0].toFixed(4)}° E`;
                  })()}
                </span>
              </div>
              {Object.entries(pixelValues).map(([key, val]) => {
                const layerInfo = renderedLayers[key];
                if (!layerInfo) return null;
                const label = translateLegendLabel(layerInfo.name);
                const unitMatch = label.match(/\(([^)]+)\)/);
                const unit = unitMatch ? unitMatch[1] : "";
                const isExpanded = inspectorExpandedKey === key;
                // Extract date from S3 key if available
                const s3Key = layerInfo.type === "raster" || layerInfo.type === "vector" ? layerInfo.proxyUrl : "";
                const dateMatch = s3Key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
                const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;
                return (
                  <div key={key} className="geo-map-inspector-layer">
                    <button
                      className="geo-map-inspector-layer-btn"
                      type="button"
                      onClick={() => setInspectorExpandedKey(isExpanded ? null : key)}
                    >
                      <span className="geo-map-inspector-layer-name">{layerInfo.name}</span>
                      <span className="geo-map-inspector-val value-highlight">
                        {val.toFixed(2)}{unit ? ` ${unit}` : ""}
                      </span>
                      <span className="geo-map-inspector-chevron">{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && (
                      <div className="geo-map-inspector-detail">
                        {dateStr && <div><span className="geo-map-inspector-label">Date:</span> {dateStr}</div>}
                        <div><span className="geo-map-inspector-label">Layer key:</span> {key}</div>
                        <div><span className="geo-map-inspector-label">Type:</span> {layerInfo.type}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
