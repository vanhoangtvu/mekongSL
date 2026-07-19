"use client";

import { useEffect, useRef } from "react";
import type React from "react";
import type OLMap from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import KML from "ol/format/KML";
import GeoTIFF from "ol/source/GeoTIFF";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import WKT from "ol/format/WKT";
import { transformExtent, transform } from "ol/proj";
import OLPoint from "ol/geom/Point";
import OLLineString from "ol/geom/LineString";
import OLPolygon from "ol/geom/Polygon";
import type { RenderedLayer } from "./useS3DatasetLayers";
import { showNotification } from "../../lib/notification";
import { getRasterStyle, isLandsatBand } from "../../lib/constants/raster-colors";
import { TITILER_CONFIG, buildTitilerTileUrl } from "../../lib/constants/titiler";
import { parseDBF } from "../../lib/dbf-parser";
import { computePolygonAreaHa } from "../../lib/utils/geo-utils";

export { parseVCT, animateLayer, removeLayerFromMap, defaultVectorStyle, FADE_MS };

const MAX_SOURCE_CACHE = 100;

// Cache parsed vector files by URL so re-adding the same layer is instant
const vectorDataCache = new Map<string, { features: Feature[]; vctAttrName: string }>();

// Web Worker for parsing large GeoJSON files off main thread
let vectorWorker: Worker | null = null;
let workerIdCounter = 0;
const workerCallbacks = new Map<string, (result: Record<string, unknown>) => void>();

function getVectorWorker(): Worker {
  if (!vectorWorker) {
    vectorWorker = new Worker(new URL("../../lib/workers/vector-parser.ts", import.meta.url));
    vectorWorker.onmessage = (e: MessageEvent<Record<string, unknown>>) => {
      const cb = workerCallbacks.get(e.data.id as string);
      if (cb) { cb(e.data); workerCallbacks.delete(e.data.id as string); }
    };
    vectorWorker.onerror = () => {};
  }
  return vectorWorker;
}

// Cache landuse styles by color to avoid creating 10,993 Style objects per render
const landuseStyleCache = new Map<string, Style>();

function trimSourceCache(cache: Map<string, { source: GeoTIFF; ready: boolean }>) {
  if (cache.size <= MAX_SOURCE_CACHE) return;
  const keys = [...cache.keys()];
  const toEvict = cache.size - MAX_SOURCE_CACHE;
  for (let i = 0; i < toEvict; i++) {
    const entry = cache.get(keys[i]);
    if (entry?.ready) try { entry.source.dispose(); } catch {}
    cache.delete(keys[i]);
  }
}

const defaultVectorStyle = new Style({
  stroke: new Stroke({ color: "#2563eb", width: 2.5 }),
  fill: new Fill({ color: "rgba(37, 99, 168, 0.25)" }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#2563eb" }),
    stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
  }),
});



function landuseStyleFunction(feature: any): Style {
  const geomType = feature.getGeometry()?.getType();
  const color = feature.get('_color') || '#ccc';
  const key = geomType === 'Polygon' || geomType === 'MultiPolygon' ? `poly:${color}` : 'line';
  let s = landuseStyleCache.get(key);
  if (s) return s;
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
    s = new Style({
      stroke: new Stroke({ color: '#333', width: 0.4 }),
      fill: new Fill({ color: color + 'cc' }),
    });
  } else {
    s = new Style({ stroke: new Stroke({ color: '#555', width: 0.7 }) });
  }
  landuseStyleCache.set(key, s);
  return s;
}

function vctStyleFunction(attrName: string): (feature: any) => Style {
  return (feature: any) => {
    const val = feature.get(attrName || '_vct_attr');
    const num = Number(val);
    const hue = !isNaN(num) ? ((num * 60) % 360) : 0;
    return new Style({
      stroke: new Stroke({ color: `hsl(${hue}, 70%, 50%)`, width: 1.5 }),
    });
  };
}

const FADE_MS = 200;

function animateLayer(
  layer: WebGLTileLayer | VectorLayer,
  from: number,
  to: number,
  duration: number,
  linkedLayer?: WebGLTileLayer | VectorLayer,
  targetTotal = 0.7,
): Promise<void> {
  if (from === to) return Promise.resolve();
  return new Promise((resolve) => {
    const start = performance.now();

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      
      const currentOpacity = from + (to - from) * t;
      layer.setOpacity(currentOpacity);

      if (linkedLayer) {
        if (to > from) {
          linkedLayer.setOpacity(Math.max(0, targetTotal - currentOpacity));
        }
      }

      if (t < 1) requestAnimationFrame(step);
      else { 
        layer.setOpacity(to); 
        if (linkedLayer && to > from) linkedLayer.setOpacity(0); // Ensure old is fully gone
        resolve(); 
      }
    }
    requestAnimationFrame(step);
  });
}

function removeLayerFromMap(
  map: OLMap,
  layer: WebGLTileLayer | VectorLayer,
  refs: Record<string, WebGLTileLayer | VectorLayer>,
  id: string,
) {
  if (!map) return;
  map.removeLayer(layer);
  const src = layer.getSource?.();
  if (src && typeof src === "object" && "dispose" in src) {
    try { (src as { dispose: () => void }).dispose(); } catch {}
  }
  delete refs[id];
}

function detectVctUtm(v: DataView, geomType: number): boolean {
  try {
    let coordOff = 0x105;
    if (geomType === 1) {
      coordOff += 8;
    } else {
      coordOff += 40;
      const nParts = v.getUint32(coordOff, true);
      if (geomType === 2) {
        coordOff += 4;
      } else {
        coordOff += 8;
        if (nParts > 1) coordOff += nParts * 4;
        else coordOff += 4;
      }
    }
    if (coordOff + 16 > v.byteLength) return false;
    const x = v.getFloat64(coordOff, true);
    const y = v.getFloat64(coordOff + 8, true);
    return Math.abs(x) > 180 || Math.abs(y) > 90;
  } catch { return false; }
}

function parseVCT(buf: ArrayBuffer, vdcText: string): { features: Feature[]; attrName: string } {
  const v = new DataView(buf);
  const geomType = v.getUint8(0);
  if (geomType < 1 || geomType > 3) return { features: [], attrName: "" };

  let srcProj = "EPSG:4326";
  let attrName = "";
  let attrIsInt = false;
  if (vdcText) {
    const refSys = (vdcText.match(/ref\.\s*system\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    const refUnits = (vdcText.match(/ref\.\s*units\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    if (refSys.startsWith("utm-")) {
      const zone = refSys.match(/utm-(\d+)/)?.[1];
      srcProj = zone ? `EPSG:326${zone.padStart(2, "0")}` : "EPSG:32648";
    } else if (refUnits === "m" || refSys === "plane") {
      srcProj = "EPSG:32648";
    }
    // Parse first column definition from VDC
    const colMatch = vdcText.match(/column\s+\d+\s*:\s*(.+)/i);
    if (colMatch) {
      attrName = colMatch[1].trim();
      const typeMatch = vdcText.match(/type\s*:\s*(.+)/i);
      if (typeMatch) attrIsInt = typeMatch[1].trim().toLowerCase() === "integer";
    }
  } else if (detectVctUtm(v, geomType)) {
    srcProj = "EPSG:32648";
  }

  const toWeb = (x: number, y: number): [number, number] =>
    transform([x, y], srcProj, "EPSG:3857") as [number, number];

  const features: Feature[] = [];
  let offset = 0x105;
  const setAttr = (f: Feature) => {
    const raw = v.getFloat64(offset, true);
    if (attrName) {
      f.set(attrName, attrIsInt ? Math.round(raw) : raw);
    } else {
      f.set('_vct_attr', raw);
    }
  };
  try {
    while (offset < buf.byteLength) {
      if (geomType === 1) {
        if (offset + 24 > buf.byteLength) break;
        const f = new Feature({ geometry: new OLPoint(toWeb(v.getFloat64(offset + 8, true), v.getFloat64(offset + 16, true))) });
        setAttr(f);
        features.push(f);
        offset += 24;
      } else if (geomType === 2) {
        if (offset + 44 > buf.byteLength) break;
        const lineF = new Feature();
        setAttr(lineF);
        offset += 40;
        const nNodes = v.getUint32(offset, true);
        offset += 4;
        if (nNodes === 0 || offset + nNodes * 16 > buf.byteLength) { offset += nNodes * 16; continue; }
        const coords: [number, number][] = [];
        for (let i = 0; i < nNodes; i++) {
          coords.push(toWeb(v.getFloat64(offset, true), v.getFloat64(offset + 8, true)));
          offset += 16;
        }
        lineF.setGeometry(new OLLineString(coords));
        features.push(lineF);
      } else {
        if (offset + 48 > buf.byteLength) break;
        const polyF = new Feature();
        setAttr(polyF);
        offset += 40;
        const nParts = v.getUint32(offset, true);
        const nTotalNodes = v.getUint32(offset + 4, true);
        offset += 8;
        if (nParts === 0 || nTotalNodes === 0 || nParts > 100000 || nTotalNodes > 10_000_000) break;
        const nodeCounts: number[] = [];
        if (nParts > 1) {
          if (offset + nParts * 4 > buf.byteLength) break;
          for (let i = 0; i < nParts; i++) { nodeCounts.push(v.getUint32(offset, true)); offset += 4; }
        } else {
          if (offset + 4 > buf.byteLength) break;
          nodeCounts.push(v.getUint32(offset, true));
          offset += 4;
        }
        if (offset + nTotalNodes * 16 > buf.byteLength) break;
        const rings: [number, number][][] = [];
        for (let p = 0; p < nParts; p++) {
          const ring: [number, number][] = [];
          for (let i = 0; i < nodeCounts[p]; i++) {
            ring.push(toWeb(v.getFloat64(offset, true), v.getFloat64(offset + 8, true)));
            offset += 16;
          }
          rings.push(ring);
        }
        polyF.setGeometry(new OLPolygon(rings));
        features.push(polyF);
      }
    }
  } catch { /* truncated */ }
  return { features, attrName };
}

function getPrefix(key: string) { return key.split("__")[0]; }

/**
 * Waits until a WebGLTileLayer has actually rendered non-background data on screen.
 * Polls multiple pixels around the viewport center using requestAnimationFrame.
 * Falls back after timeout to avoid blocking forever.
 */
function waitForLayerRender(
  map: OLMap,
  layer: WebGLTileLayer | VectorLayer,
  nodata = -9999,
  timeout = 15000,
): Promise<void> {
  return new Promise((resolve) => {
    const view = map.getView();
    const center = view.getCenter();
    if (!center) { resolve(); return; }

    const centerPx = map.getPixelFromCoordinate(center);
    let attempts = 0;
    const pollMs = 200;
    const maxAttempts = Math.ceil(timeout / pollMs);

    const poll = () => {
      if (attempts++ > maxAttempts) { resolve(); return; }
      for (let dx = -20; dx <= 20; dx += 20) {
        for (let dy = -20; dy <= 20; dy += 20) {
          try {
            const buf = (layer as WebGLTileLayer).getData([centerPx[0] + dx, centerPx[1] + dy]);
            if (buf && !(buf instanceof DataView) && buf.length > 0) {
              const val = buf[0];
              if (val !== 0 && val !== nodata) { resolve(); return; }
            }
          } catch { /* pixel outside viewport or not yet rendered */ }
        }
      }
      setTimeout(poll, pollMs);
    };
    setTimeout(poll, pollMs);
  });
}

/**
 * Syncs a `renderedLayers` map → actual OpenLayers layers on the map.
 * Cross-fades when replacing a layer with same dataset prefix.
 * Returns layerRefs so callers can read pixel values.
 */
export function useS3LayerRenderer(
  renderedLayers: Record<string, RenderedLayer>,
  mapRef: React.MutableRefObject<OLMap | null>,
  prebuiltLayersRef: React.MutableRefObject<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>,
  activeDateRef: React.MutableRefObject<string>,
  sourceCacheRef?: React.MutableRefObject<Map<string, { source: GeoTIFF; ready: boolean }>>,
  targetOpacity = 0.7,
  onLayerReady?: (id: string) => void,
) {
  const layerRefs = useRef<Record<string, WebGLTileLayer | VectorLayer>>({});
  const pendingReplaceRef = useRef<Record<string, { oldId: string; done: boolean }>>({});

  useEffect(() => {
    const map = mapRef.current;
    console.log("[useS3LayerRenderer] sync", { layers: Object.keys(renderedLayers), mapExists: !!map });
    if (!map) return;
    const safeMap = map;
    const currentLayers = layerRefs.current;
    const pendingReplace = pendingReplaceRef.current;
    const renderedIds = new Set(Object.keys(renderedLayers));
    const activeDate = activeDateRef.current;

    // Build prefix → newId
    const newByPrefix: Record<string, string> = {};
    for (const id of renderedIds) newByPrefix[getPrefix(id)] = id;

    // Phase 1: remove stale or register pending-replace
    for (const id of Object.keys(currentLayers)) {
      if (renderedIds.has(id)) continue;
      const prefix = getPrefix(id);
      if (newByPrefix[prefix] && !pendingReplace[prefix]) {
        pendingReplace[prefix] = { oldId: id, done: false };
      } else {
        const layer = currentLayers[id];
        if (layer) {
          const op = layer.getOpacity();
          animateLayer(layer, op, 0, FADE_MS).then(() => {
            removeLayerFromMap(safeMap, layer, currentLayers, id);
            for (const dl of Object.values(prebuiltLayersRef.current)) delete dl[id];
          });
        } else {
          delete currentLayers[id];
        }
      }
    }

    // Phase 2: restore prebuilt cached OL layers
    const cachedLayers = prebuiltLayersRef.current[activeDate];
    if (cachedLayers) {
      for (const [id, layer] of Object.entries(cachedLayers)) {
        if (!renderedIds.has(id) || currentLayers[id]) continue;
        const prefix = getPrefix(id);
        const pending = pendingReplace[prefix];

        // Safety: check if layer is already on the map (e.g. reused from a different ID)
        const mapLayers = safeMap.getLayers().getArray();
        if (!mapLayers.includes(layer)) {
          safeMap.addLayer(layer);
        }

        currentLayers[id] = layer;
        onLayerReady?.(id);
        layer.setZIndex(100 + Object.keys(currentLayers).length);

        if (pending && !pending.done && currentLayers[pending.oldId]) {
          const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
          if (old === layer) {
            // Same instance, just claim it
            delete currentLayers[pending.oldId];
            pending.done = true;
            delete pendingReplace[prefix];
          } else {
            layer.setOpacity(0.7);
            animateLayer(old, old.getOpacity(), 0, FADE_MS).then(() => {
              removeLayerFromMap(safeMap, old, currentLayers, pending.oldId);
              for (const dl of Object.values(prebuiltLayersRef.current)) delete dl[pending.oldId];
              pending.done = true;
              delete pendingReplace[prefix];
            });
          }
        }
      }
    }

    let isActive = true;

    // Phase 3: add new layers
    for (const [id, info] of Object.entries(renderedLayers)) {
      if (currentLayers[id]) continue;
      const prefix = getPrefix(id);
      const pending = pendingReplace[prefix];

      if (info.type === "raster") {
        const dsPrefix = getPrefix(id);

        // Try TiTiler XYZ tiles first (only for COG files which are under gis-data/cog/)
        let rasterLayer: WebGLTileLayer = null!;
        let titilerUsed = false;

        const isCogFile = info.s3Key ? info.s3Key.startsWith('gis-data/cog/') : false;
        if (TITILER_CONFIG.enabled && isCogFile) {
          const tileUrl = buildTitilerTileUrl(info.s3Key!, dsPrefix);
          if (tileUrl) {
            const xyzSource = new XYZ({
              url: tileUrl,
              maxZoom: TITILER_CONFIG.maxZoom,
              tileSize: 256,
            });
            rasterLayer = new TileLayer({
              opacity: 0,
              source: xyzSource,
              maxZoom: TITILER_CONFIG.maxZoom,
            }) as unknown as WebGLTileLayer;
            titilerUsed = true;
          }
        }

        // Fallback to GeoTIFF rendering
        if (!titilerUsed) {
          const gtUrl = info.proxyUrl.startsWith("http")
            ? info.proxyUrl
            : `${window.location.origin}${info.proxyUrl}`;

          const cachedSrc = sourceCacheRef?.current?.get(id);
          const src = cachedSrc?.ready
            ? cachedSrc.source
            : new GeoTIFF({
                sources: [{ url: gtUrl, nodata: info.nodata }],
                convertToRGB: false,
                normalize: isLandsatBand(dsPrefix),
                interpolate: false,
                projection: "EPSG:32648",
              });

          const rasterStyle = getRasterStyle(dsPrefix, gtUrl, info.nodata);

          rasterLayer = new WebGLTileLayer({
            opacity: 0,
            source: src,
            style: rasterStyle,
            maxZoom: 17,
          });
        }

        rasterLayer.setZIndex(100 + Object.keys(currentLayers).length);
        if (!safeMap.getLayers().getArray().includes(rasterLayer)) {
          safeMap.addLayer(rasterLayer);
        }
        currentLayers[id] = rasterLayer;
        const dl = prebuiltLayersRef.current[activeDate] ?? {};
        dl[id] = rasterLayer;
        prebuiltLayersRef.current[activeDate] = dl;

        // Show layer immediately - no fade, no polling
        const showLayer = () => {
          if (!isActive) return;
          rasterLayer.setOpacity(targetOpacity);
          onLayerReady?.(id);
          
          // Cache source for future reuse
          if (!titilerUsed && sourceCacheRef) {
            const gtSrc = (rasterLayer as WebGLTileLayer).getSource() as import("ol/source/GeoTIFF").default;
            if (gtSrc && !sourceCacheRef.current.has(id)) {
              sourceCacheRef.current.set(id, { source: gtSrc, ready: true });
              trimSourceCache(sourceCacheRef.current);
            }
          }
          
          // Remove old layer if replacing
          if (pending && !pending.done && currentLayers[pending.oldId]) {
            const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
            removeLayerFromMap(safeMap, old, currentLayers, pending.oldId);
            for (const dlX of Object.values(prebuiltLayersRef.current)) delete dlX[pending.oldId];
            pending.done = true;
            delete pendingReplace[prefix];
          }
          
          // Fit view for first layer
          if (!titilerUsed && Object.keys(currentLayers).filter(k => !pendingReplace[getPrefix(k)]).length <= 1) {
            const gtSrc = (rasterLayer as WebGLTileLayer).getSource() as { getView?: () => Promise<{ extent?: number[]; projection?: unknown }> };
            if (gtSrc?.getView) {
              gtSrc.getView().then((vo) => {
                if (!mapRef.current || !vo.extent || !vo.projection) return;
                const proj = typeof vo.projection === "string" ? vo.projection : (vo.projection as { getCode?: () => string }).getCode?.() || "EPSG:3857";
                safeMap.getView().fit(transformExtent(vo.extent, proj, "EPSG:3857"), {
                  padding: [48, 48, 48, 48], duration: 0, maxZoom: 15,
                });
              }).catch(() => {});
            }
          }
        };

        if (titilerUsed) {
          showLayer();
        } else {
          const gtSource = (rasterLayer as WebGLTileLayer).getSource() as import("ol/source/GeoTIFF").default;
          const onSourceReady = () => {
            if (gtSource.getState() !== "ready" || !isActive) return;
            showLayer();
          };
          if (gtSource.getState() === "ready") {
            showLayer();
          } else {
            gtSource.once("change", onSourceReady);
          }
        }

      } else if (info.type === "vector") {
        const url = info.proxyUrl.startsWith("http")
          ? info.proxyUrl
          : `${window.location.origin}${info.proxyUrl}`;
        const layerId = id;
        const ext = info.ext;
        const vdcUrl = info.vdcUrl
          ? (info.vdcUrl.startsWith("http") ? info.vdcUrl : `${window.location.origin}${info.vdcUrl}`)
          : null;
        const dbfUrl = info.dbfUrl
          ? (info.dbfUrl.startsWith("http") ? info.dbfUrl : `${window.location.origin}${info.dbfUrl}`)
          : null;

        void (async () => {
          try {
            // Check cache first — avoid re-download + re-parse the same GeoJSON file
            const cachedResult = vectorDataCache.get(url);
            if (cachedResult) {
              const featuresClone = cachedResult.features.map(f => f.clone());
              await finishVectorLayer(featuresClone, cachedResult.vctAttrName, url, vdcUrl, dbfUrl, id, layerId, ext, info, pending, prefix, safeMap, currentLayers, prebuiltLayersRef, activeDate, targetOpacity, isActive, renderedLayers);
              return;
            }

            const buf = await (await fetch(url)).arrayBuffer();
            if (!isActive) return;
            const previewText = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 200));
            const fullText = new TextDecoder("utf-8", { fatal: false }).decode(buf);
            const magic = new Uint8Array(buf.slice(0, 4));
            const isPK = magic[0] === 0x50 && magic[1] === 0x4B;
            const isSHP = magic[0] === 0x00 && magic[3] === 0x0F;
            const isSQLite = previewText.startsWith("SQLite");
            const isGeoJSON = previewText.trim().startsWith("{") || previewText.trim().startsWith("[");
            const isXML = previewText.trim().startsWith("<");
            const isWKT = /^(POINT|LINESTRING|POLYGON|MULTI)/i.test(previewText.trim());
            const isIDRISI = ext === ".vct" || ext === ".vdc";

            let vdcText = "";
            if (vdcUrl) {
              try {
                const vr = await fetch(vdcUrl);
                if (vr.ok && isActive) vdcText = new TextDecoder("utf-8", { fatal: false }).decode(await vr.arrayBuffer());
              } catch {}
            }

            let features: Feature[];
            let vctAttrName = "";
            if (isSHP || isPK || isSQLite) { showNotification(`Format not supported`, "error"); return; }
            else if (isXML) features = new KML({ extractStyles: true }).readFeatures(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
            else if (isGeoJSON) {
              // Parse in Web Worker — keeps main thread responsive
              const wid = `vec_${++workerIdCounter}`;
              getVectorWorker().postMessage({ id: wid, type: 'geojson', buf }, [buf]);
              const geoResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
                workerCallbacks.set(wid, resolve);
                setTimeout(() => reject(new Error('Worker timeout')), 30000);
              });
              if (geoResult?.error) throw new Error(String(geoResult.error));

              const geoJSON = geoResult.geoJSON as { type: string; features: unknown[] };
              const coordMatch = fullText.match(/-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/);
              const opts: Record<string, string | undefined> = {};
              if (coordMatch) {
                const [x, y] = coordMatch[0].split(',').map(Number);
                opts.dataProjection = Math.abs(x) > 180 || Math.abs(y) > 90 ? "EPSG:32648" : "EPSG:4326";
                opts.featureProjection = "EPSG:3857";
              } else opts.featureProjection = "EPSG:3857";

              // Chunk Feature creation — yields between batches so UI stays responsive
              const fmt = new GeoJSON();
              features = [];
              const allFeatures = geoJSON.features;
              const chunkSize = 500;
              for (let i = 0; i < allFeatures.length; i += chunkSize) {
                const chunk = allFeatures.slice(i, i + chunkSize);
                const batch = fmt.readFeatures({ type: "FeatureCollection", features: chunk }, opts);
                features.push(...batch);
                if (i + chunkSize < allFeatures.length) await new Promise(r => setTimeout(r, 0));
              }
            } else if (isWKT) features = [new WKT().readFeature(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })].filter(Boolean) as Feature[];
            else if (isIDRISI) {
              const result = parseVCT(buf, vdcText);
              features = result.features;
              vctAttrName = result.attrName;
            }
            else features = [];

            if (!isActive || !features?.length) { showNotification(`Cannot parse "${info.name}"`, "error"); return; }

            // Cache parsed features by URL for instant re-use
            vectorDataCache.set(url, { features, vctAttrName });
            // Evict old entries (max 10)
            if (vectorDataCache.size > 10) {
              const firstKey = vectorDataCache.keys().next().value;
              if (firstKey !== undefined) vectorDataCache.delete(firstKey);
            }

            await finishVectorLayer(features, vctAttrName, url, vdcUrl, dbfUrl, id, layerId, ext, info, pending, prefix, safeMap, currentLayers, prebuiltLayersRef, activeDate, targetOpacity, isActive, renderedLayers);
          } catch { showNotification(`Failed to load "${info.name}"`, "error"); }
        })();
      }
    }

    async function finishVectorLayer(
      features: Feature[],
      vctAttrName: string,
      url: string,
      vdcUrl: string | null,
      dbfUrl: string | null,
      id: string,
      layerId: string,
      ext: string,
      info: { name?: string },
      pending: { oldId: string; done: boolean } | undefined,
      prefix: string,
      safeMap: OLMap,
      currentLayers: Record<string, WebGLTileLayer | VectorLayer>,
      prebuiltLayersRef: React.MutableRefObject<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>,
      activeDate: string,
      targetOpacity: number,
      isActive: boolean,
      renderedLayers: Record<string, RenderedLayer>,
    ) {
      if (!isActive) return;

      if (dbfUrl) {
        try {
          const dbfResp = await fetch(dbfUrl);
          if (dbfResp.ok) {
            const dbfBuf = await dbfResp.arrayBuffer();
            const dbfResult = parseDBF(dbfBuf);
            const attrName = vctAttrName || "_vct_attr";
            for (const f of features) {
              const val = f.get(attrName);
              if (val === undefined) continue;
              const idx = Math.round(Number(val)) - 1;
              if (idx >= 0 && idx < dbfResult.records.length) {
                const rec = dbfResult.records[idx];
                for (const [k, v] of Object.entries(rec)) {
                  f.set(k, v);
                }
              }
            }
          }
        } catch {}
      }

      const isLanduse = id.startsWith('baseline-landuse-plan');
      const useVctStyle = vctAttrName || features.some(f => f.get('_vct_attr') !== undefined);
      const vectorStyle: any = isLanduse
        ? landuseStyleFunction
        : useVctStyle
          ? vctStyleFunction(vctAttrName || '_vct_attr')
          : defaultVectorStyle;
      const vectorSource = new VectorSource({ features });
      const vectorLayer = new VectorLayer({ source: vectorSource, style: vectorStyle, opacity: 0 });
      vectorLayer.set('_datasetKey', layerId);
      if (isLanduse) {
        vectorLayer.set('_landuseLayer', true);
        let totalAreaHa = 0;
        const codeAreaHa: Record<string, number> = {};
        const codeColor: Record<string, string> = {};
        const feats = vectorSource.getFeatures();
        for (let fi = 0; fi < feats.length; fi++) {
          const f = feats[fi];
          const g = f.getGeometry();
          if (!g) continue;
          const gt = g.getType();
          if (gt !== 'Polygon' && gt !== 'MultiPolygon') continue;
          const code = f.get('_code') as string;
          if (!code) continue;
          const a = computePolygonAreaHa(g);
          totalAreaHa += a;
          if (!codeAreaHa[code]) codeAreaHa[code] = 0;
          codeAreaHa[code] += a;
          if (!codeColor[code]) codeColor[code] = (f.get('_color') as string) || '#ccc';
        }
        vectorLayer.set('_luStats', { totalAreaHa, codeAreaHa, codeColor });
      }
      vectorLayer.setZIndex(150 + Object.keys(currentLayers).length);

      if (!isActive || !new Set(Object.keys(renderedLayers)).has(layerId) || currentLayers[layerId]) return;
      if (!safeMap.getLayers().getArray().includes(vectorLayer)) {
        safeMap.addLayer(vectorLayer);
      }
      currentLayers[layerId] = vectorLayer;
      const dl2 = prebuiltLayersRef.current[activeDate] ?? {};
      dl2[layerId] = vectorLayer;
      prebuiltLayersRef.current[activeDate] = dl2;

      const targetOp = targetOpacity;
      if (pending && !pending.done && currentLayers[pending.oldId]) {
        const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
        animateLayer(vectorLayer, 0, targetOp, FADE_MS).then(() => {
          onLayerReady?.(layerId);
        });
        animateLayer(old, old.getOpacity(), 0, FADE_MS).then(() => {
          removeLayerFromMap(safeMap, old, currentLayers, pending.oldId);
          for (const dl3 of Object.values(prebuiltLayersRef.current)) delete dl3[pending.oldId];
          pending.done = true;
          delete pendingReplace[prefix];
        });
      } else {
        animateLayer(vectorLayer, 0, targetOp, FADE_MS).then(() => {
          onLayerReady?.(layerId);
        });
      }
      const extent = vectorSource.getExtent();
      if (extent && extent[0] !== Infinity) safeMap.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 16, duration: 300 });
    }

    return () => { isActive = false; };
  }, [renderedLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  return layerRefs;
}
