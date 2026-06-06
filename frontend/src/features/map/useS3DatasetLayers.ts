"use client";

import { useEffect, useRef, useState } from "react";
import type Map from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
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
import { getDatasetSlug, getParentDataset, getDatasetById } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import { showNotification } from "../../lib/notification";

export type RenderedLayer = {
  name: string;
  proxyUrl: string;
  type: "raster";
  bbox: [number, number, number, number];
  nodata: number;
} | {
  name: string;
  proxyUrl: string;
  type: "vector";
  ext: string;
  vdcUrl?: string;
};

const VECTOR_EXTS = [".vct", ".vdc", ".geojson", ".kml", ".shp", ".gpkg", ".zip"];

const defaultVectorStyle = new Style({
  stroke: new Stroke({ color: "#2563eb", width: 2.5 }),
  fill: new Fill({ color: "rgba(37, 99, 168, 0.25)" }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#2563eb" }),
    stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
  }),
});

const FADE_MS = 350;

// ── IDRISI VCT binary parser ──────────────────────────────────────────────
// Format (little-endian):
//   byte 0      : geometry type  1=Point  2=LineString  3=Polygon
//   bytes 1-4   : uint32  total features
//   offset 0x105: feature records start
//
// Point record   : f64 id, f64 x, f64 y
// Line record    : f64 id, f64 minX, f64 maxX, f64 minY, f64 maxY,
//                  u32 nNodes, then nNodes×(f64 x, f64 y)
// Polygon record : f64 id, f64 minX, f64 maxX, f64 minY, f64 maxY,
//                  u32 nParts, u32 nTotalNodes,
//                  if nParts>1: nParts×u32 nodeCounts,
//                  then nTotalNodes×(f64 x, f64 y)
function parseVCT(buf: ArrayBuffer, vdcText: string): Feature[] {
  const v = new DataView(buf);
  const geomType = v.getUint8(0); // 1=point 2=line 3=polygon
  if (geomType < 1 || geomType > 3) return [];

  // Detect CRS from VDC companion text
  let srcProj = "EPSG:4326";
  if (vdcText) {
    const refSys = (vdcText.match(/ref\.\s*system\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    const refUnits = (vdcText.match(/ref\.\s*units\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    if (refSys.startsWith("utm-")) {
      const zone = refSys.match(/utm-(\d+)/)?.[1];
      srcProj = zone ? `EPSG:326${zone.padStart(2, "0")}` : "EPSG:32648";
    } else if (refUnits === "m" || refSys === "plane") {
      srcProj = "EPSG:32648"; // assume UTM48N for ĐBSCL
    }
  }

  const toWeb = (x: number, y: number): [number, number] =>
    transform([x, y], srcProj, "EPSG:3857") as [number, number];

  const features: Feature[] = [];
  let offset = 0x105; // 261 — data records start here

  try {
    while (offset < buf.byteLength) {
      if (geomType === 1) {
        if (offset + 24 > buf.byteLength) break;
        const x = v.getFloat64(offset + 8, true);
        const y = v.getFloat64(offset + 16, true);
        offset += 24;
        features.push(new Feature({ geometry: new OLPoint(toWeb(x, y)) }));

      } else if (geomType === 2) {
        if (offset + 44 > buf.byteLength) break;
        offset += 40; // skip id + bbox (5×f64)
        const nNodes = v.getUint32(offset, true);
        offset += 4;
        if (nNodes === 0 || offset + nNodes * 16 > buf.byteLength) { offset += nNodes * 16; continue; }
        const coords: [number, number][] = [];
        for (let i = 0; i < nNodes; i++) {
          coords.push(toWeb(v.getFloat64(offset, true), v.getFloat64(offset + 8, true)));
          offset += 16;
        }
        features.push(new Feature({ geometry: new OLLineString(coords) }));

      } else {
        if (offset + 48 > buf.byteLength) break;
        offset += 40; // skip id + bbox
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
        features.push(new Feature({ geometry: new OLPolygon(rings) }));
      }
    }
  } catch { /* truncated file — return what we have */ }

  return features;
}

function animateLayer(
  layer: WebGLTileLayer | VectorLayer,
  from: number,
  to: number,
  duration: number,
): Promise<void> {
  if (from === to) return Promise.resolve();
  return new Promise((resolve) => {
    const start = performance.now();
    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out quad
      layer.setOpacity(from + (to - from) * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        layer.setOpacity(to);
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

function removeLayerFromMap(
  map: Map,
  layer: WebGLTileLayer | VectorLayer,
  refs: Record<string, WebGLTileLayer | VectorLayer>,
  id: string,
) {
  map.removeLayer(layer);
  const src = layer.getSource?.();
  if (src && typeof src === "object" && "dispose" in src) {
    try { (src as { dispose: () => void }).dispose(); } catch {}
  }
  delete refs[id];
}

function getPrefix(key: string): string {
  return key.split("__")[0];
}

export function useS3DatasetLayers(
  appliedDatasets: Array<{ id: string; type: string }> | undefined,
  mapRef: React.MutableRefObject<Map | null>,
  timelineDate?: string,
  timeSlot?: string,
  prefetchDate?: string,
  allTimelineDates?: string[]
) {
  const layerRefs = useRef<Record<string, WebGLTileLayer | VectorLayer>>({});
  const prevDateRef = useRef<string | undefined>(undefined);
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const layersCacheRef = useRef<Record<string, Record<string, RenderedLayer>>>({});
  const prebuiltLayersRef = useRef<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>({});
  const activeDateRef = useRef<string>("");

  // Track old layers waiting for replacement. prefix → { oldId, done }
  // When a new layer loads, we cross-fade: fade-in new + fade-out old simultaneously.
  const pendingReplaceRef = useRef<Record<string, { oldId: string; done: boolean }>>({});

  function pickFrame(cache: Record<string, RenderedLayer>, slot?: string): Record<string, RenderedLayer> {
    if (slot) {
      const exact: Record<string, RenderedLayer> = {};
      for (const [k, v] of Object.entries(cache)) {
        if (k.endsWith(`__${slot}`)) exact[k] = v;
      }
      if (Object.keys(exact).length > 0) return exact;
      const slotNum = parseInt(slot.replace("-", ""), 10);
      const best: Record<string, [number, RenderedLayer]> = {};
      for (const [k, v] of Object.entries(cache)) {
        const m = k.match(/__(\d{2})-(\d{2})$/);
        if (!m) continue;
        const baseKey = k.replace(/__\d{4}-\d{2}-\d{2}__\d{2}-\d{2}$/, "");
        const diff = Math.abs(parseInt(m[1] + m[2], 10) - slotNum);
        if (!best[baseKey] || diff < best[baseKey][0]) best[baseKey] = [diff, v];
      }
      const result: Record<string, RenderedLayer> = {};
      for (const [k, v] of Object.entries(cache)) {
        const m = k.match(/__(\d{2})-(\d{2})$/);
        if (!m) continue;
        const baseKey = k.replace(/__\d{4}-\d{2}-\d{2}__\d{2}-\d{2}$/, "");
        if (best[baseKey] && best[baseKey][1] === v) result[k] = v;
      }
      if (Object.keys(result).length > 0) return result;
    }
    const latest: Record<string, [string, RenderedLayer]> = {};
    for (const [k, v] of Object.entries(cache)) {
      const baseKey = k.replace(/__\d{4}-\d{2}-\d{2}__\d{2}-\d{2}$/, "");
      if (!latest[baseKey] || k > latest[baseKey][0]) latest[baseKey] = [k, v];
    }
    const display: Record<string, RenderedLayer> = {};
    for (const [, [k, v]] of Object.entries(latest)) display[k] = v;
    return display;
  }

  // ── Main data-fetching effect ──
  useEffect(() => {
    const filtered = (appliedDatasets ?? []).map((d) => `${d.id}-${d.type}`);
    const next = new Set(filtered);
    const prevKeys = Object.keys(renderedLayers);
    const prev = new Set(prevKeys);

    const [y, m, d] = timelineDate
      ? timelineDate.split('-').map(Number)
      : (() => { const t = new Date(); return [t.getFullYear(), t.getMonth() + 1, t.getDate()]; })();
    const md = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = timelineDate || `${y}-${md}-${dd}`;

    const dateChanged = prevDateRef.current !== undefined && prevDateRef.current !== timelineDate;
    prevDateRef.current = timelineDate;

    // Always remove datasets no longer applied
    const toRemove = prevKeys.filter((key) => !next.has(getPrefix(key)));

    // Date or slot changed: check cache first — instant switch, no flash
    if (dateChanged || (timeSlot && prevKeys.length > 0)) {
      const cached = layersCacheRef.current[dateStr];
      if (cached) {
        activeDateRef.current = dateStr;
        const newFrame = pickFrame(cached, timeSlot);

        // Filter: only keep layers matching currently applied datasets
        const filtered: Record<string, RenderedLayer> = {};
        for (const [k, v] of Object.entries(newFrame)) {
          const prefix = k.split("__")[0];
          if (next.has(prefix)) {
            filtered[k] = v;
          }
        }

        // Check if all applied datasets have cached data
        const cachedPrefixes = new Set(Object.keys(filtered).map(k => k.split("__")[0]));
        const allInCache = [...next].every(key => cachedPrefixes.has(key));

        if (allInCache) {
          setRenderedLayers(filtered);
          return;
        }
        // Not all in cache — set what we have from cache, fall through to fetchNew
        if (Object.keys(filtered).length > 0) {
          setRenderedLayers(filtered);
        }
      }
    } else if (toRemove.length > 0) {
      setRenderedLayers((prev) => {
        const nextMap = { ...prev };
        for (const key of toRemove) delete nextMap[key];
        return nextMap;
      });
      // Clear cache + prebuilt OL layers for removed datasets so re-apply fetches fresh
      for (const removedPrefix of toRemove.map(getPrefix)) {
        for (const dateCache of Object.values(layersCacheRef.current)) {
          for (const k of Object.keys(dateCache)) {
            if (getPrefix(k) === removedPrefix) delete dateCache[k];
          }
        }
        for (const dateLayers of Object.values(prebuiltLayersRef.current)) {
          for (const k of Object.keys(dateLayers)) {
            if (getPrefix(k) === removedPrefix) delete dateLayers[k];
          }
        }
      }
      if (![...next].some(key => !prev.has(key))) return;
    }

    const toAdd = dateChanged
      ? [...next]
      : [...next].filter((key) => {
          // Skip if already rendered OR already loading (has an OL layer in map)
          if (prev.has(key)) return false;
          const hasLiveLayer = Object.keys(layerRefs.current).some(k => getPrefix(k) === key);
          return !hasLiveLayer;
        });

    let isActive = true;
    if (toAdd.length === 0) return;

    async function fetchNew() {
      const additions: Record<string, RenderedLayer> = {};

      for (const dsKey of toAdd) {
        if (!isActive) break;
        const dsEntry = (appliedDatasets ?? []).find((d) => `${d.id}-${d.type}` === dsKey);
        if (!dsEntry) continue;

        const dsId = dsEntry.id;
        const isVector = dsEntry.type === "vector";

        const dsInfoCheck = getDatasetById(dsId);
        const parentCheck = getParentDataset(dsId);
        if (dsInfoCheck?.gisData === false || parentCheck?.gisData === false) continue;
        if (dsId === "wq-surface" || dsId === "wq-ground") continue;

        const parent = getParentDataset(dsId);
        const dsInfo = getDatasetById(dsId);
        let datasetId: string;
        let categorySlug: string;
        if (parent) {
          datasetId = parent.id;
          categorySlug = getDatasetSlug(dsId) || dsId;
        } else if (dsInfo?.children && dsInfo.children.length > 0) {
          datasetId = dsId;
          categorySlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id;
        } else {
          datasetId = dsId;
          categorySlug = "default";
        }

        const dsSlug = getDatasetSlug(datasetId) || datasetId;
        const catName = dsInfo?.name || dsId;
        const basePrefix = `gis-data/${dsSlug}/${categorySlug}/`;
        const prefixes = timelineDate ? [
          `${basePrefix}${y}/${md}/${dd}/`,
          `${basePrefix}${y}/${md}/`,
          `${basePrefix}${y}/`,
          basePrefix,
        ] : [basePrefix];

        let foundKey: string | null = null;
        let vdcKey: string | null = null;
        let rasterFound = false;
        for (const prefix of prefixes) {
          try {
            const allFiles = await listS3Files(prefix);
            if (!isActive) break;
            const files = [...allFiles].sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));

            if (isVector) {
              const vFile = files.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return k.endsWith(".vct");
              }) || files.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return VECTOR_EXTS.some((ext) => k.endsWith(ext) && !k.endsWith(".zip") && !k.endsWith(".vdc") && !k.endsWith(".vct"));
              }) || files.find((f) => (f.key?.toLowerCase() ?? "").endsWith(".zip"));
              if (vFile) {
                foundKey = vFile.key;
                const baseLower = foundKey.replace(/\.\w+$/, "").toLowerCase();
                const comp = files.find((f) => f.key?.toLowerCase() === baseLower + ".vdc");
                if (comp) vdcKey = comp.key;
                break;
              }
            } else {
              const allTifs = files.filter((f) => f.key?.match(/\.tiff?$/i));
              if (allTifs.length > 0) {
                const targetDateStr = `${y}/${md}/${dd}`;
                const dateOf = (key: string) => {
                  const m = key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
                  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
                };
                const uniqueDates = [...new Set(allTifs.map(f => dateOf(f.key ?? "")))].filter(Boolean).sort();
                if (timelineDate && uniqueDates.length > 0) {
                  const lte = uniqueDates.filter(d => d <= targetDateStr);
                  if (lte.length === 0) {
                    // No data for this date or any earlier date — don't fallback to later dates
                    if (isActive) showNotification(`No raster data for "${catName}" before ${dateStr}`, "info");
                    break;
                  }
                  const bestDate = lte[lte.length - 1];
                  const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === bestDate);
                  for (const tif of tifsForDate) {
                    const timeMatch = tif.key!.match(/\/(\d{2}-\d{2})\//);
                    const timeLabel = timeMatch ? timeMatch[1] : "00-00";
                    const frameKey = `${dsKey}__${bestDate.replace(/\//g, "-")}__${timeLabel}`;
                    additions[frameKey] = {
                      name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`,
                      proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`,
                      type: "raster",
                      bbox: [594885, 1052655, 688485, 1117455],
                      nodata: -9999,
                    };
                  }
                  rasterFound = true;
                  break;
                } else {
                  // No specific timeline date — use latest available data
                  const bestDate = uniqueDates[uniqueDates.length - 1];
                  const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === bestDate);
                  for (const tif of tifsForDate) {
                    const timeMatch = tif.key!.match(/\/(\d{2}-\d{2})\//);
                    const timeLabel = timeMatch ? timeMatch[1] : "00-00";
                    const frameKey = `${dsKey}__${bestDate.replace(/\//g, "-")}__${timeLabel}`;
                    additions[frameKey] = {
                      name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`,
                      proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`,
                      type: "raster",
                      bbox: [594885, 1052655, 688485, 1117455],
                      nodata: -9999,
                    };
                  }
                  rasterFound = true;
                  break;
                }
              }
            }
          } catch (e) {
            console.warn("[S3] error for prefix", prefix, e);
          }
        }
        if (!isActive) break;
        if (isVector && !foundKey) {
          showNotification(`No vector data found for "${catName}" on ${dateStr}`, "error");
          continue;
        }
        if (!isVector && !rasterFound) {
          if (timelineDate) {
            showNotification(`No raster data found for "${catName}" on ${dateStr}`, "info");
          }
          continue;
        }
        if (isVector) {
          try {
            additions[dsKey] = {
              name: parent ? `${parent.name} - ${catName}` : catName,
              proxyUrl: `/api/tif?key=${encodeURIComponent(foundKey!)}`,
              type: "vector",
              ext: "." + (foundKey!.split(".").pop() || "").toLowerCase(),
              vdcUrl: vdcKey ? `/api/tif?key=${encodeURIComponent(vdcKey)}` : undefined,
            };
          } catch {
            if (isActive) showNotification(`Failed to load "${catName}"`, "error");
          }
        }
      }

      if (!isActive) return;

      // Only cache if we actually found data — avoid caching empty results
      if (Object.keys(additions).length > 0) {
        layersCacheRef.current[dateStr] = { ...(layersCacheRef.current[dateStr] ?? {}), ...additions };
      }
      activeDateRef.current = dateStr;

      const display = pickFrame(additions, timeSlot);
      setRenderedLayers((prev) => {
        const nextMap: Record<string, RenderedLayer> = {};
        const newPrefixes = new Set(Object.keys(display).map(k => k.split("__")[0]));
        for (const [k, v] of Object.entries(prev)) {
          const prefix = k.split("__")[0];
          if (!newPrefixes.has(prefix) && next.has(prefix)) {
            nextMap[k] = v;
          }
        }
        for (const [k, v] of Object.entries(display)) {
          nextMap[k] = v;
        }
        return nextMap;
      });
    }

    void fetchNew();
    return () => { isActive = false; };
  }, [appliedDatasets, timelineDate, timeSlot]);

  // ── Preload adjacent timeline frames in background ──
  useEffect(() => {
    if (!allTimelineDates || allTimelineDates.length === 0 || !appliedDatasets || appliedDatasets.length === 0) return;

    const datesToPreload = [
      ...(prefetchDate ? [prefetchDate] : []),
      ...allTimelineDates.filter((d, i) => {
        if (!timelineDate) return false;
        const idx = allTimelineDates.indexOf(timelineDate);
        if (idx === -1) return false;
        return Math.abs(i - idx) <= 2 && i !== idx;
      }),
    ].filter(Boolean);

    const uniqueDates = [...new Set(datesToPreload)];
    let cancelled = false;

    async function preloadDate(dateStr: string) {
      if (layersCacheRef.current[dateStr]) return;

      const [y, m, d] = dateStr.split('-').map(Number);
      const md = String(m).padStart(2, "0");
      const dd = String(d).padStart(2, "0");

      for (const ds of appliedDatasets!) {
        if (cancelled) return;

        const dsKey = `${ds.id}-${ds.type}`;
        if (layersCacheRef.current[dateStr]?.[dsKey]) continue;

        const dsInfo = getDatasetById(ds.id);
        const parent = getParentDataset(ds.id);
        if (dsInfo?.gisData === false || parent?.gisData === false) continue;

        let datasetId: string;
        let categorySlug: string;
        if (parent) {
          datasetId = parent.id;
          categorySlug = getDatasetSlug(ds.id) || ds.id;
        } else if (dsInfo?.children && dsInfo.children.length > 0) {
          datasetId = ds.id;
          categorySlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id;
        } else {
          datasetId = ds.id;
          categorySlug = "default";
        }

        const dsSlug = getDatasetSlug(datasetId) || datasetId;
        const basePrefix = `gis-data/${dsSlug}/${categorySlug}/`;
        const prefixes = [
          `${basePrefix}${y}/${md}/${dd}/`,
          `${basePrefix}${y}/${md}/`,
        ];

        for (const prefix of prefixes) {
          try {
            const allFiles = await listS3Files(prefix);
            if (cancelled) return;
            const files = [...allFiles].sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));

            if (ds.type === "vector") {
              const vFile = files.find(f => (f.key?.toLowerCase() ?? "").endsWith(".vct"));
              if (vFile) {
                const cache = layersCacheRef.current[dateStr] ?? {};
                const ext = "." + (vFile.key!.split(".").pop() || "").toLowerCase();
                const baseLower = vFile.key!.replace(/\.\w+$/, "").toLowerCase();
                const vdcFile = files.find(f => f.key?.toLowerCase() === baseLower + ".vdc");
                cache[dsKey] = {
                  name: parent?.name || dsInfo?.name || ds.id,
                  proxyUrl: `/api/tif?key=${encodeURIComponent(vFile.key!)}`,
                  type: "vector",
                  ext,
                  vdcUrl: vdcFile ? `/api/tif?key=${encodeURIComponent(vdcFile.key!)}` : undefined,
                };
                layersCacheRef.current[dateStr] = cache;
                break;
              }
            } else {
              const allTifs = files.filter(f => f.key?.match(/\.tiff?$/i));
              // Only cache tifs matching this exact date
              const targetDate = `${y}/${md}/${dd}`;
              const dateOf = (key: string) => {
                const m = key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
                return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
              };
              const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === targetDate);
              if (tifsForDate.length > 0) {
                const catName = parent?.name || dsInfo?.name || ds.id;
                const cache = layersCacheRef.current[dateStr] ?? {};
                for (const tif of tifsForDate) {
                  const timeMatch = tif.key!.match(/\/(\d{2}-\d{2})\//);
                  const timeLabel = timeMatch ? timeMatch[1] : "00-00";
                  const key = `${dsKey}__${dateStr}__${timeLabel}`;
                  cache[key] = {
                    name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`,
                    proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`,
                    type: "raster",
                    bbox: [594885, 1052655, 688485, 1117455],
                    nodata: -9999,
                  };
                }
                layersCacheRef.current[dateStr] = cache;
                break;
              }
            }
          } catch {
            // Silently ignore preload errors
          }
        }
      }
    }

    let idx = 0;
    async function preloadNext() {
      while (idx < uniqueDates.length && !cancelled) {
        await preloadDate(uniqueDates[idx]);
        idx++;
      }
    }
    void preloadNext();

    return () => { cancelled = true; };
  }, [timelineDate, prefetchDate, allTimelineDates, appliedDatasets]);

  // ── Sync renderedLayers state ↔ OpenLayers map layers with deferred cross-fade ──
  //
  // Key insight: When a layer has a replacement (same dataset prefix, different time),
  // we DON'T remove it until the new layer has loaded. Instead:
  //   1. Keep old layer at current opacity (no fade-out yet)
  //   2. Add new layer at opacity 0
  //   3. When new layer's source is ready → cross-fade simultaneously
  //   4. After cross-fade → remove old layer from map
  //
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const safeMap = map;
    const currentLayers = layerRefs.current;
    const pendingReplace = pendingReplaceRef.current;

    const renderedIds = new Set(Object.keys(renderedLayers));

    // ── Phase 1: Remove stale layers ──
    // For layers with replacement (same prefix): keep visible, register as pending replacement
    // For layers without replacement: fade out and remove
    const existingIds = [...Object.keys(currentLayers)];

    // Build prefix → newId map from renderedLayers
    const newByPrefix: Record<string, string> = {};
    for (const newId of renderedIds) {
      newByPrefix[getPrefix(newId)] = newId;
    }

    for (const id of existingIds) {
      if (renderedIds.has(id)) continue; // Still active, skip

      const prefix = getPrefix(id);
      const replacementNewId = newByPrefix[prefix];

      if (replacementNewId) {
        // This old layer has a replacement coming — keep it visible!
        // Register it as pending replacement so we can cross-fade later
        pendingReplace[prefix] = { oldId: id, done: false };
      } else {
        // No replacement — fade out and remove
        const layer = currentLayers[id];
        if (layer) {
          const currentOpacity = layer.getOpacity();
          animateLayer(layer, currentOpacity, 0, FADE_MS).then(() => {
            removeLayerFromMap(safeMap, layer, currentLayers, id);
            for (const dateLayers of Object.values(prebuiltLayersRef.current)) {
              delete dateLayers[id];
            }
          });
        } else {
          delete currentLayers[id];
        }
      }
    }

    // ── Phase 2: Restore cached layers ──
    const activeDate = activeDateRef.current;
    const cachedLayers = prebuiltLayersRef.current[activeDate];
    if (cachedLayers) {
      for (const [id, layer] of Object.entries(cachedLayers)) {
        if (renderedIds.has(id) && !currentLayers[id]) {
          // Check if a pending-replace old layer exists for this prefix
          const prefix = getPrefix(id);
          const pending = pendingReplace[prefix];
          if (pending && !pending.done && currentLayers[pending.oldId]) {
            // New cached layer ready — cross-fade immediately!
            const oldLayer = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
            const oldOpacity = oldLayer.getOpacity();

            safeMap.addLayer(layer);
            currentLayers[id] = layer;
            layer.setZIndex(100 + Object.keys(currentLayers).length);

            // Set new layer to target opacity, fade out old layer
            layer.setOpacity(0.7);
            animateLayer(oldLayer, oldOpacity, 0, FADE_MS).then(() => {
              removeLayerFromMap(safeMap, oldLayer, currentLayers, pending.oldId);
              for (const dateLayers of Object.values(prebuiltLayersRef.current)) {
                delete dateLayers[pending.oldId];
              }
              pending.done = true;
              delete pendingReplace[prefix];
            });
          } else {
            safeMap.addLayer(layer);
            currentLayers[id] = layer;
            layer.setZIndex(100 + Object.keys(currentLayers).length);
          }
        }
      }
    }

    let isActive = true;

    // ── Phase 3: Add new layers ──
    for (const [id, info] of Object.entries(renderedLayers)) {
      if (currentLayers[id]) continue;

      const prefix = getPrefix(id);
      const pending = pendingReplace[prefix];

      if (info.type === "raster") {
        const absoluteUrl = info.proxyUrl.startsWith("http")
          ? info.proxyUrl
          : `${window.location.origin}${info.proxyUrl}`;

        const source = new GeoTIFF({
          sources: [{ url: absoluteUrl, nodata: info.nodata }],
          convertToRGB: false,
          normalize: false,
          interpolate: false,
          projection: "EPSG:32648",
        });

        const rasterLayer = new WebGLTileLayer({
          opacity: 0,
          source,
          style: {
            color: [
              "case",
              ["<=", ["band", 1], info.nodata], [0, 0, 0, 0],
              ["<=", ["band", 1], 0], [0, 0, 0, 0],
              ["<", ["band", 1], 0.06], [0, 0, 0, 0],
              ["interpolate", ["linear"], ["band", 1],
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

        rasterLayer.setZIndex(100 + Object.keys(currentLayers).length);
        safeMap.addLayer(rasterLayer);
        currentLayers[id] = rasterLayer;

        const dateLayers = prebuiltLayersRef.current[activeDate] || {};
        dateLayers[id] = rasterLayer;
        prebuiltLayersRef.current[activeDate] = dateLayers;

        // ── Cross-fade when source loads ──
        source.once("change", () => {
          if (source.getState() === "ready" && isActive) {
            const targetOpacity = 0.7;

            if (pending && !pending.done && currentLayers[pending.oldId]) {
              // Cross-fade: fade in new + fade out old simultaneously
              const oldLayer = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
              const oldOpacity = oldLayer.getOpacity();

              animateLayer(rasterLayer, 0, targetOpacity, FADE_MS);
              animateLayer(oldLayer, oldOpacity, 0, FADE_MS).then(() => {
                removeLayerFromMap(safeMap, oldLayer, currentLayers, pending.oldId);
                for (const dateLayers of Object.values(prebuiltLayersRef.current)) {
                  delete dateLayers[pending.oldId];
                }
                pending.done = true;
                delete pendingReplace[prefix];
              });
            } else {
              // No old layer to replace — just fade in
              animateLayer(rasterLayer, 0, targetOpacity, FADE_MS);
            }

            // Auto-zoom on first layer
            if (Object.keys(currentLayers).filter(k => !pendingReplace[getPrefix(k)]).length <= 1) {
              source
                .getView()
                .then((viewOptions) => {
                  if (!mapRef.current) return;
                  if (viewOptions.extent && viewOptions.projection) {
                    const proj =
                      typeof viewOptions.projection === "string"
                        ? viewOptions.projection
                        : viewOptions.projection.getCode();
                    const ext = transformExtent(viewOptions.extent, proj, "EPSG:3857");
                    safeMap.getView().fit(ext, { padding: [48, 48, 48, 48], duration: 300, maxZoom: 15 });
                  }
                })
                .catch(() => {});
            }
          }
        });
        source.refresh();

      } else if (info.type === "vector") {
        const absoluteUrl = info.proxyUrl.startsWith("http")
          ? info.proxyUrl
          : `${window.location.origin}${info.proxyUrl}`;

        const vectorLayerId = id;
        const vectorExt = info.ext;

        async function loadVectorLayer() {
          try {
            const response = await fetch(absoluteUrl);
            if (!isActive) return;

            const buf = await response.arrayBuffer();
            if (!isActive) return;

            const previewText = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 200));
            const fullText = new TextDecoder("utf-8", { fatal: false }).decode(buf);

            const magic = new Uint8Array(buf.slice(0, 4));
            const isPK = magic[0] === 0x50 && magic[1] === 0x4B;
            const isSHP = magic[0] === 0x00 && magic[1] === 0x00 && magic[2] === 0x27 && magic[3] === 0x0F;
            const isSQLite = previewText.startsWith("SQLite");
            const isGeoJSON = previewText.trim().startsWith("{") || previewText.trim().startsWith("[");
            const isXML = previewText.trim().startsWith("<");
            const isWKT = /^(POINT|LINESTRING|POLYGON|MULTI)/i.test(previewText.trim());
            const isIDRISI = vectorExt === ".vct" || vectorExt === ".vdc";

            let vdcTextFull = "";
            if (info.type === "vector" && info.vdcUrl) {
              try {
                const vdcAbsUrl = info.vdcUrl.startsWith("http")
                  ? info.vdcUrl
                  : `${window.location.origin}${info.vdcUrl}`;
                const vdcRes = await fetch(vdcAbsUrl);
                if (vdcRes.ok && isActive) {
                  const vdcBuf = await vdcRes.arrayBuffer();
                  if (isActive) {
                    vdcTextFull = new TextDecoder("utf-8", { fatal: false }).decode(vdcBuf);
                  }
                }
              } catch {}
            }

            let features: Feature[];
            const wktFormat = new WKT();

            if (isSHP) { showNotification(`Shapefile needs conversion to GeoJSON`, "error"); return; }
            else if (isPK) { showNotification(`ZIP extraction not supported`, "error"); return; }
            else if (isSQLite) { showNotification(`GeoPackage not supported`, "error"); return; }
            else if (isXML) {
              features = new KML({ extractStyles: true }).readFeatures(fullText, {
                dataProjection: "EPSG:4326", featureProjection: "EPSG:3857",
              });
            } else if (isGeoJSON) {
              const fmt = new GeoJSON();
              try { features = fmt.readFeatures(fullText, { featureProjection: "EPSG:3857" }); }
              catch { features = fmt.readFeatures(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }); }
            } else if (isWKT) {
              features = [wktFormat.readFeature(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })].filter(Boolean) as Feature[];
            } else if (isIDRISI) {
              features = parseVCT(buf, vdcTextFull);
            } else { features = []; }

            if (!isActive) return;
            if (!features?.length) { showNotification(`Cannot parse vector "${info.name}"`, "error"); return; }

            const vectorSource = new VectorSource({ features });
            const vectorLayer = new VectorLayer({
              source: vectorSource,
              style: defaultVectorStyle,
              opacity: 0,
            });
            vectorLayer.setZIndex(150 + Object.keys(currentLayers).length);

            if (isActive && renderedIds.has(vectorLayerId) && !currentLayers[vectorLayerId]) {
              safeMap.addLayer(vectorLayer);
              currentLayers[vectorLayerId] = vectorLayer;

              const dateLayers = prebuiltLayersRef.current[activeDate] || {};
              dateLayers[vectorLayerId] = vectorLayer;
              prebuiltLayersRef.current[activeDate] = dateLayers;

              const targetOpacity = 0.7;

              if (pending && !pending.done && currentLayers[pending.oldId]) {
                // Cross-fade: fade in vector + fade out old simultaneously
                const oldLayer = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
                const oldOpacity = oldLayer.getOpacity();

                animateLayer(vectorLayer, 0, targetOpacity, FADE_MS);
                animateLayer(oldLayer, oldOpacity, 0, FADE_MS).then(() => {
                  removeLayerFromMap(safeMap, oldLayer, currentLayers, pending.oldId);
                  for (const dateLayers of Object.values(prebuiltLayersRef.current)) {
                    delete dateLayers[pending.oldId];
                  }
                  pending.done = true;
                  delete pendingReplace[prefix];
                });
              } else {
                animateLayer(vectorLayer, 0, targetOpacity, FADE_MS);
              }

              const extent = vectorSource.getExtent();
              if (extent && extent.length === 4 && extent[0] !== Infinity) {
                safeMap.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 16, duration: 300 });
              }
            }
          } catch (err) {
            showNotification(`Failed to load vector "${info.name}"`, "error");
          }
        }
        void loadVectorLayer();
      }
    }

    return () => { isActive = false; };
  }, [renderedLayers]);

  return { renderedLayers, layerRefs, layersCacheRef: layersCacheRef as React.MutableRefObject<Record<string, Record<string, RenderedLayer>>> };
}