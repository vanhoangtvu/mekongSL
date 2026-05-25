"use client";

import { useEffect, useRef, useState } from "react";
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

// Register UTM 48N projection
proj4.defs("EPSG:32648", "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs");
register(proj4);

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

export function MapStage() {
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

      if (selectedLayer.previewUrl.endsWith('.tif') || selectedLayer.previewUrl.endsWith('.tiff')) {
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
    updateSizes.forEach(delay => {
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.updateSize();
        }
      }, delay);
    });

    map.on('pointermove', (evt) => {
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

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

    const absoluteUrl = rasterUrl.startsWith('http') 
      ? rasterUrl 
      : `${window.location.origin}${rasterUrl}`;
    
    console.log("Absolute GeoTIFF URL:", absoluteUrl);

    const source = new GeoTIFF({
      sources: [{ 
        url: absoluteUrl,
        nodata: selectedLayer.nodata ?? undefined,
      }],
      convertToRGB: false,
      normalize: false,
      interpolate: false,
      projection: 'EPSG:32648',
    });

    source.on('change', () => {
      console.log("GeoTIFF source state:", source.getState());
    });

    const nodataValue = selectedLayer.nodata ?? -9999;
    const rasterLayer = new WebGLTileLayer({
      opacity: 0.7,
      source,
      style: {
        color: [
          'case',
          ['<=', ['band', 1], nodataValue], [0, 0, 0, 0],
          ['<=', ['band', 1], 0], [0, 0, 0, 0],
          ['<', ['band', 1], 0.06], [0, 0, 0, 0],
          [
            'interpolate',
            ['linear'],
            ['band', 1],
            0.06, [0, 0, 255, 1],
            5, [0, 255, 255, 1],
            10, [0, 255, 0, 1],
            15, [255, 255, 0, 1],
            20, [255, 165, 0, 1],
            21, [255, 0, 0, 1],
          ]
        ],
      },
    });

    console.log("Adding raster layer to map");
    rasterLayer.setZIndex(100);
    map.addLayer(rasterLayer);
    rasterLayerRef.current = rasterLayer;

    rasterLayer.on('error', (event) => {
      console.error("Raster layer error:", event);
    });

    void (async () => {
      const worldFile = await loadWorldFile(absoluteUrl);
      return source.getView().then((viewOptions) => ({ viewOptions, worldFile }));
    })().then(({ viewOptions, worldFile }) => {
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
      const pixelExtent = viewOptions.extent && viewOptions.extent.length === 4
        ? (viewOptions.extent as [number, number, number, number])
        : null;
      const worldExtent = worldFile && pixelExtent
        ? buildWorldFileExtent(worldFile, pixelExtent)
        : null;
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
    }).catch((error) => {
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
              <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/>
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
