"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import TileLayer from "ol/layer/Tile";
import WebGLTileLayer from "ol/layer/WebGLTile";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat, transformExtent } from "ol/proj";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import GeoTIFF from "ol/source/GeoTIFF";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";

import type { RasterLayerManifest } from "../../lib/constants/raster-layers";
import { DATASETS } from "../../lib/constants/datasets";

// Register UTM 48N projection
proj4.defs("EPSG:32648", "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs");
register(proj4);

// ---------------------------------------------------------------------------
// Flatten DATASETS (from datasets.ts) into a list of addable map layers.
// Parent categories with children → each child becomes one layer entry.
// Parent categories without children → the parent itself becomes a layer entry.
// ---------------------------------------------------------------------------
const ALL_AVAILABLE_LAYERS = DATASETS.flatMap((cat) =>
  cat.children
    ? cat.children.map((child) => ({
        id: child.id,
        name: child.name,
        categoryId: cat.id,       // used for CSS class: map-player-item-type--{categoryId}
        categoryName: cat.name,   // displayed in badge
        added: false,
      }))
    : [{
        id: cat.id,
        name: cat.name,
        categoryId: cat.id,
        categoryName: cat.name,
        added: false,
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

  if (diffDays < 7) {
    return "hour4";
  }

  if (diffDays < 30) {
    return "day";
  }

  return "month";
}

function buildTimelineUnits(startDate: Date, endDate: Date, mode: TimelineResolvedMode) {
  if (mode === "hour4") {
    const units: TimelineUnit[] = [];

    // One tick every 2 hours (double the density)
    for (let index = 0; index < 480; index += 1) {
      const current = addHours(startDate, index * 2);
      if (current > endDate) {
        break;
      }

      units.push({
        label: formatHourLabel(current),
        value: current.toISOString(),
        isMajor: index % 12 === 0, // Every 24 hours
      });
    }

    return { mode, units };
  }

  if (mode === "day") {
    const units: TimelineUnit[] = [];
    const diffHours = Math.ceil((endDate.getTime() - startDate.getTime()) / 3_600_000);
    const limit = Math.min(diffHours / 12 + 1, 240); // One tick every 12 hours

    for (let index = 0; index < limit; index += 1) {
      const current = addHours(startDate, index * 12);
      if (current > endDate) {
        break;
      }

      units.push({
        label: formatDayLabel(current),
        value: current.toISOString(),
        isMajor: index % 2 === 0, // Every day
      });
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

export function MapStage({ startDateTime, endDateTime }: MapStageProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const rasterLayerRef = useRef<WebGLTileLayer | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<RasterLayerManifest | null>(null);
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState("Đang tải lớp raster...");
  const [pixelValue, setPixelValue] = useState<number | null>(null);
  const [mouseCoords, setMouseCoords] = useState<[number, number] | null>(null);
  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>("osm");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showUnitMenu, setShowUnitMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [tooltipPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [playerLayers, setPlayerLayers] = useState(
    () => ALL_AVAILABLE_LAYERS.map((l) => ({ ...l }))
  );  // Which layer id is waiting for layer-type selection
  const [pendingLayerId, setPendingLayerId] = useState<string | null>(null);

  // Playback feature state
  const [showPlaybackPicker, setShowPlaybackPicker] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [pbStartDate, setPbStartDate] = useState("");
  const [pbEndDate, setPbEndDate] = useState("");
  const [pbError, setPbError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Custom playback controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const handleOpenPlayback = () => {
    setPbStartDate("");
    setPbEndDate("");
    setPbError("");
    setShowPlaybackPicker(true);
  };

  const handleStartPlayback = () => {
    if (!pbStartDate || !pbEndDate) {
      setPbError("Please select both start and end date.");
      return;
    }
    if (pbStartDate > pbEndDate) {
      setPbError("Start date must be before end date.");
      return;
    }
    setShowPlaybackPicker(false);
    setShowVideoModal(true);
    
    // Reset control states
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1);

    // Auto-play after modal opens
    setTimeout(() => { 
      if (videoRef.current) {
        videoRef.current.playbackRate = 1;
        videoRef.current.play().catch(() => {}); 
      }
    }, 300);
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSpeedChange = () => {
    if (!videoRef.current) return;
    let nextSpeed = 1;
    if (playbackSpeed === 1) nextSpeed = 1.5;
    else if (playbackSpeed === 1.5) nextSpeed = 2;
    
    videoRef.current.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  };

  // Date interpolation for scrubber/ruler
  const getCurrentPlaybackDate = () => {
    if (!pbStartDate || !pbEndDate || duration === 0) return pbStartDate || "";
    const start = new Date(pbStartDate).getTime();
    const end = new Date(pbEndDate).getTime();
    if (isNaN(start) || isNaN(end)) return pbStartDate || "";
    
    const progress = currentTime / duration;
    const currentMillis = start + progress * (end - start);
    const currentDate = new Date(currentMillis);
    
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const confirmAddLayer = (id: string, _layerType: "raster" | "vector") => {
    setPlayerLayers(prev => prev.map(l => l.id === id ? { ...l, added: true } : l));
    setPendingLayerId(null);
  };

  const removeLayer = (id: string) => {
    setPlayerLayers(prev => prev.map(l => l.id === id ? { ...l, added: false } : l));
  };

  // Drag-and-drop reordering
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);

  const reorderLayers = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setPlayerLayers(prev => {
      const from = prev.findIndex(l => l.id === fromId);
      const to   = prev.findIndex(l => l.id === toId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const [timelineIndex, setTimelineIndex] = useState(0);
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
  const timelineUnitOptions: Array<{ value: TimelineUnitMode; label: string }> = [
    { value: "auto", label: "Auto" },
    { value: "hour4", label: "4h" },
    { value: "day", label: "Ngày" },
    { value: "month", label: "Tháng" },
  ];

  useEffect(() => {
    setTimelineIndex(0);
  }, [startDateTime, endDateTime]);

  useEffect(() => {
    if (timelineUnits.length === 0) {
      return;
    }

    setTimelineIndex((currentIndex) => Math.min(currentIndex, timelineUnits.length - 1));
  }, [timelineUnits.length]);

  useEffect(() => {
    let isActive = true;

    async function loadLayerManifest() {
      try {
        const response = await fetch("/api/layers", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Không thể tải danh sách lớp raster (${response.status})`);
        }

        const payload: { layers?: RasterLayerManifest[] } = await response.json();
        const nextLayer = payload.layers?.[0] ?? null;

        if (isActive) {
          setSelectedLayer(nextLayer);
          setLoadStatus(nextLayer ? `Đã chọn ${nextLayer.name}` : "Chưa có lớp raster nào");
        }
      } catch (error) {
        if (isActive) {
          setSelectedLayer(null);
          setLoadStatus(error instanceof Error ? error.message : "Không thể tải lớp raster");
        }
      }
    }

    void loadLayerManifest();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadRasterUrl() {
      if (!selectedLayer) {
        setRasterUrl(null);
        return;
      }

      if (selectedLayer.previewUrl.endsWith(".tif") || selectedLayer.previewUrl.endsWith(".tiff")) {
        if (isActive) {
          setRasterUrl(selectedLayer.previewUrl);
          setLoadStatus(`Đang hiển thị ${selectedLayer.name}`);
        }

        return;
      }

      try {
        const response = await fetch(selectedLayer.previewUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Không thể lấy URL render raster (${response.status})`);
        }

        const payload: { url?: string } = await response.json();
        if (isActive) {
          setRasterUrl(payload.url ?? null);
          setLoadStatus(payload.url ? `Đang hiển thị ${selectedLayer.name}` : "Thiếu URL render raster");
        }
      } catch (error) {
        if (isActive) {
          setRasterUrl(null);
          setLoadStatus(error instanceof Error ? error.message : "Không thể lấy URL render raster");
        }
      }
    }

    void loadRasterUrl();

    return () => {
      isActive = false;
    };
  }, [selectedLayer]);

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

      const layer = rasterLayerRef.current;
      if (!layer) {
        setPixelValue(null);
        return;
      }

      const data = layer.getData(evt.pixel);
      if (!data || data instanceof DataView) {
        setPixelValue(null);
        return;
      }

      if (data.length > 0) {
        const value = data[0];
        setPixelValue(value > 0 ? value : null);
      } else {
        setPixelValue(null);
      }
    });

    return () => {
      rasterLayerRef.current = null;
      baseLayerRef.current = null;
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (rasterLayerRef.current) {
      map.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
    }

    if (!selectedLayer || !rasterUrl) {
      console.log("No layer or URL:", { selectedLayer, rasterUrl });
      return;
    }

    console.log("Creating GeoTIFF source with URL:", rasterUrl);

    const absoluteUrl = rasterUrl.startsWith("http") ? rasterUrl : `${window.location.origin}${rasterUrl}`;

    console.log("Absolute GeoTIFF URL:", absoluteUrl);

    const source = new GeoTIFF({
      sources: [
        {
          url: absoluteUrl,
          nodata: selectedLayer.nodata ?? undefined,
        },
      ],
      convertToRGB: false,
      normalize: false,
      interpolate: false,
      projection: "EPSG:32648",
    });

    source.on("change", () => {
      console.log("GeoTIFF source state:", source.getState());
    });

    const nodataValue = selectedLayer.nodata ?? -9999;
    const rasterLayer = new WebGLTileLayer({
      opacity: 0.7,
      source,
      style: {
        color: [
          "case",
          ["<=", ["band", 1], nodataValue], [0, 0, 0, 0],
          ["<=", ["band", 1], 0], [0, 0, 0, 0],
          ["<", ["band", 1], 0.06], [0, 0, 0, 0],
          [
            "interpolate",
            ["linear"],
            ["band", 1],
            0.06, [0, 0, 255, 1],
            5, [0, 255, 255, 1],
            10, [0, 255, 0, 1],
            15, [255, 255, 0, 1],
            20, [255, 165, 0, 1],
            21, [255, 0, 0, 1],
          ],
        ],
      },
    });

    console.log("Adding raster layer to map");
    rasterLayer.setZIndex(100);
    map.addLayer(rasterLayer);
    rasterLayerRef.current = rasterLayer;

    rasterLayer.on("error", (event) => {
      console.error("Raster layer error:", event);
    });

    void (async () => {
      const worldFile = await loadWorldFile(absoluteUrl);
      return source.getView().then((viewOptions) => ({ viewOptions, worldFile }));
    })()
      .then(({ viewOptions, worldFile }) => {
        console.log("GeoTIFF viewOptions:", viewOptions);
        console.log("GeoTIFF extent:", viewOptions.extent);
        console.log("GeoTIFF projection:", viewOptions.projection);
        console.log("GeoTIFF resolutions:", viewOptions.resolutions);

        if (!mapRef.current) {
          return;
        }

        if (viewOptions.extent && viewOptions.projection) {
          const view = map.getView();
          const sourceProjection =
            typeof viewOptions.projection === "string"
              ? viewOptions.projection
              : viewOptions.projection.getCode();

          console.log("Source projection code:", sourceProjection);

          const transformedExtent = transformExtent(viewOptions.extent, sourceProjection, "EPSG:3857");
          console.log("Transformed extent (EPSG:3857):", transformedExtent);

          view.fit(transformedExtent, {
            padding: [48, 48, 48, 48],
            duration: 300,
            maxZoom: 15,
          });

          console.log("✅ Map fitted to GeoTIFF extent");
          return;
        }

        const view = map.getView();
        const pixelExtent =
          viewOptions.extent && viewOptions.extent.length === 4
            ? (viewOptions.extent as [number, number, number, number])
            : null;
        const worldExtent = worldFile && pixelExtent ? buildWorldFileExtent(worldFile, pixelExtent) : null;
        const fallbackExtent = selectedLayer?.bbox ?? [594885, 1052655, 688485, 1117455];
        const resolvedExtent = worldExtent ?? fallbackExtent;

        if (worldExtent) {
          console.log("✅ Map fitted to world file extent");
        } else {
          console.warn("⚠️ No extent/projection in GeoTIFF; using fallback extent");
        }

        const transformedExtent = transformExtent(resolvedExtent, "EPSG:32648", "EPSG:3857");
        console.log("Resolved transformed extent:", transformedExtent);

        view.fit(transformedExtent, {
          padding: [48, 48, 48, 48],
          duration: 300,
          maxZoom: 15,
        });
      })
      .catch((error) => {
        console.error("❌ Error reading GeoTIFF view:", error);
        console.error("Error stack:", error.stack);

        const view = map.getView();
        const fallbackExtent = selectedLayer?.bbox ?? [594885, 1052655, 688485, 1117455];
        const transformedExtent = transformExtent(fallbackExtent, "EPSG:32648", "EPSG:3857");

        view.fit(transformedExtent, {
          padding: [48, 48, 48, 48],
          duration: 300,
          maxZoom: 15,
        });
      });
  }, [rasterUrl, selectedLayer]);

  return (
    <section className="geo-map">
      <div className="geo-map-canvas">
        <div ref={mapContainerRef} className="geo-map-viewport" aria-label="OpenLayers Map" />

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
                {playerLayers.map((layer) => (
                  <div
                    key={layer.id}
                    className={`map-player-item ${dragLayerId === layer.id ? "is-dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragLayerId(layer.id)}
                    onDragEnd={() => setDragLayerId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragLayerId) reorderLayers(dragLayerId, layer.id);
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
                      {layer.categoryId === "climate" && (
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

                    {/* Add / Added button */}
                    {layer.added ? (
                      <button
                        className="map-player-item-tick is-added"
                        title="Added - Click to remove"
                        type="button"
                        onClick={() => removeLayer(layer.id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                    ) : (
                      <button
                        className={`map-player-item-tick ${pendingLayerId === layer.id ? "is-pending" : ""}`}
                        title="Add layer"
                        type="button"
                        onClick={() => setPendingLayerId(pendingLayerId === layer.id ? null : layer.id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                    )}

                    {/* Inline type-picker popover */}
                    {pendingLayerId === layer.id && (
                      <div className="map-player-type-popover">
                        <div className="map-player-type-popover-label">Select layer format:</div>
                        <div className="map-player-type-popover-options">
                          <button
                            className="map-player-type-opt"
                            type="button"
                            onClick={() => confirmAddLayer(layer.id, "raster")}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                            Raster
                          </button>
                          <button
                            className="map-player-type-opt"
                            type="button"
                            onClick={() => confirmAddLayer(layer.id, "vector")}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3,18 8,8 13,13 18,6"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="13" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/></svg>
                            Vector
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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
                className="map-timeline-scroller" 
                onClick={(event) => event.stopPropagation()}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!containerRect) return;

                  const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                  const totalWidth = e.currentTarget.scrollWidth;
                  const ratio = Math.max(0, Math.min(1, (x - 20) / (totalWidth - 40)));
                  const index = Math.round(ratio * (timelineUnits.length - 1));
                  const unit = timelineUnits[index];
                  
                  if (unit) {
                    setHoverTime(unit.label);
                    // Position relative to the CONTAINER, not the scroller content
                    setHoverPos({ 
                      x: e.clientX - containerRect.left, 
                      y: e.clientY - containerRect.top - 25 
                    });
                  }
                }}
              >
                <div className="map-timeline-inner" style={{ width: `${Math.max(600, timelineUnits.length * 40)}px` }}>
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
                    <button className="pb-btn-play" onClick={handleStartPlayback} type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7L8 5z"/>
                      </svg>
                      Play
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Video Playback Modal */}
        {showVideoModal && (
          <div className="pb-video-overlay" onClick={() => setShowVideoModal(false)}>
            <div className="pb-video-panel" onClick={e => e.stopPropagation()}>
              <div className="pb-video-header">
                <div className="pb-video-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7L8 5z"/>
                  </svg>
                  Time-Lapse Playback
                  {pbStartDate && pbEndDate && (
                    <span className="pb-video-period">{pbStartDate} → {pbEndDate}</span>
                  )}
                </div>
                <button className="pb-video-close" onClick={() => { setShowVideoModal(false); videoRef.current?.pause(); }} type="button">×</button>
              </div>
              <div className="pb-video-body">
                <div className="pb-video-container">
                  <video
                    ref={videoRef}
                    className="pb-video-player"
                    controls={false}
                    autoPlay
                    loop
                    playsInline
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  >
                    <source src="/api/playback" type="video/mp4" />
                    Your browser does not support time-lapse playback.
                  </video>

                  {/* Map Scale Bar Overlay (Cây thước tỷ lệ) */}
                  <div className="pb-video-map-scale">
                    <span className="scale-label">50 km</span>
                    <div className="scale-bar-line" />
                  </div>
                </div>

                {/* Date Scrubber / Timeline Ruler (Thước thời gian) */}
                <div className="pb-video-timeline-container">
                  <div className="pb-video-timeline-ruler">
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      step="0.05"
                      value={currentTime}
                      onChange={handleSliderChange}
                      className="pb-video-timeline-slider"
                      style={{
                        background: `linear-gradient(to right, #2563a8 0%, #2563a8 ${(currentTime / (duration || 100)) * 100}%, #e2e8f0 ${(currentTime / (duration || 100)) * 100}%, #e2e8f0 100%)`
                      }}
                    />
                    <div className="pb-video-timeline-ticks">
                      <span className="pb-timeline-tick-label start">{pbStartDate}</span>
                      <span className="pb-timeline-tick-label current">{getCurrentPlaybackDate()}</span>
                      <span className="pb-timeline-tick-label end">{pbEndDate}</span>
                    </div>
                  </div>
                </div>

                {/* Custom Control Buttons Row */}
                <div className="pb-video-controls-row">
                  <button className="pb-video-control-btn play-pause" onClick={handleTogglePlay} type="button" title={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  <div className="pb-video-controls-divider" />

                  {/* Time display */}
                  <div className="pb-video-time-display">
                    {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                  </div>

                  <div style={{ flexGrow: 1 }} />

                  {/* Speed Selector */}
                  <button className="pb-video-control-btn speed" onClick={handleSpeedChange} type="button">
                    {playbackSpeed}x Speed
                  </button>

                  <div className="pb-video-controls-divider" />

                  <div className="pb-video-stat pb-video-stat-live">
                    <span className="pb-stat-live">● Live Simulation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {pixelValue !== null && (
          <div className="geo-map-overlay geo-map-overlay-bottom">
            <div>
              <strong>Value at cursor: {pixelValue.toFixed(2)}</strong>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
