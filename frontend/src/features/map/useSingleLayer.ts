"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type OLMap from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import GeoTIFF from "ol/source/GeoTIFF";
import { fromArrayBuffer } from "geotiff";
import { getDatasetSlug, getParentDataset, getDatasetById, getRootDataset } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import { showNotification } from "../../lib/notification";
import type { RenderedLayer } from "./useS3DatasetLayers";
import { useS3LayerRenderer } from "./useS3LayerRenderer";

const PRELOAD_CONCURRENCY = 6;
type FrameKey = string;

function parseFrameKey(frameKey: FrameKey): { dsKey: string; date: string; slot: string } | null {
  const parts = frameKey.split("__");
  if (parts.length !== 3) return null;
  return { dsKey: parts[0], date: parts[1], slot: parts[2] };
}

function parseDsKey(dsKey: string): { id: string; type: string } | null {
  if (dsKey.endsWith("-raster")) return { id: dsKey.slice(0, -7), type: "raster" };
  if (dsKey.endsWith("-vector")) return { id: dsKey.slice(0, -7), type: "vector" };
  return null;
}

const dateOf = (k: string) => {
  const m2 = k.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : "";
};

async function discoverFrameMeta(frameKey: FrameKey): Promise<RenderedLayer | null> {
  const parsed = parseFrameKey(frameKey);
  if (!parsed) return null;
  const dsInfo2 = parseDsKey(parsed.dsKey);
  if (!dsInfo2 || dsInfo2.type !== "raster") return null;

  const { id } = dsInfo2;
  const dsInfoCheck = getDatasetById(id);
  const parentCheck = getParentDataset(id);
  if (dsInfoCheck?.gisData === false || parentCheck?.gisData === false) return null;
  if (id === "wq-surface" || id === "wq-ground") return null;

  const parent = getParentDataset(id);
  const dsInfo = getDatasetById(id);

  let datasetId: string, categorySlug: string;
  if (parent) {
    datasetId = parent.id;
    categorySlug = getDatasetSlug(id) || id;
  } else if (dsInfo?.children?.length) {
    datasetId = id;
    categorySlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id;
  } else {
    datasetId = id;
    categorySlug = "default";
  }

  const dsSlug = getDatasetSlug(datasetId) || datasetId;
  const catName = dsInfo?.name || id;
  const [y, m, d] = parsed.date.split("-").map(Number);
  const md = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");

  const prefixes = [
    `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/${dd}/`,
    `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/`,
  ];

  for (const prefix of prefixes) {
    try {
      const result = await listS3Files(prefix);
      const allFiles = result._error ? [] : result.files;
      if (result._error) continue;
      const allTifs = allFiles.filter(f => f.key?.match(/\.tiff?$/i));
      if (!allTifs.length) continue;

      const targetDateStr = `${y}/${md}/${dd}`;
      const uniqueDates = [...new Set(allTifs.map(f => dateOf(f.key ?? "")))].filter(Boolean).sort();
      const lte = uniqueDates.filter(d2 => d2 <= targetDateStr);
      if (!lte.length) break;
      const bestDate = lte[lte.length - 1];
      const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === bestDate);

      const slotPattern = new RegExp(`\\/${parsed.slot}\\/(raster\\/)?[^/]+\\.tiff?$`, "i");
      let pickedTif = tifsForDate.find(f => slotPattern.test(f.key ?? ""));

      if (!pickedTif) {
        const slotNum = parseInt(parsed.slot.replace("-", ""), 10);
        pickedTif = tifsForDate.reduce((best, f) => {
          const mm = f.key?.match(/\/(\d{2}-\d{2})\//);
          if (!mm) return best;
          const diff = Math.abs(parseInt(mm[1].replace("-", ""), 10) - slotNum);
          const bm = best?.key?.match(/\/(\d{2}-\d{2})\//);
          return diff < Math.abs(parseInt((bm?.[1] ?? "9999").replace("-", ""), 10) - slotNum) ? f : best;
        }, tifsForDate[0]);
      }

      if (!pickedTif) continue;

      const timeMatch = pickedTif.key!.match(/\/(\d{2}-\d{2})\//);
      const timeLabel = timeMatch ? timeMatch[1] : "00-00";

      return {
        name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`,
        proxyUrl: `/api/tif?key=${encodeURIComponent(pickedTif.key!)}`,
        type: "raster",
        bbox: [594885, 1052655, 688485, 1117455],
        nodata: -9999,
      };
    } catch { /* continue next prefix */ }
  }

  return null;
}

/**
 * Single-layer viewer mode.
 * - On first apply: finds nearest available slot, syncs timeline via onActualSlot
 * - On timeline drag: exact slot only, no fallback
 * - On same-dataset timeline change: keeps old layer until new data arrives
 * - On dataset change: clears old layer
 * - On dataset removal: defers clear to handle transient state
 * - Uses discoveredMetaRef to cache S3 metadata → avoids re-listing during playback
 * - preloadFrames: bulk discovers + preloads GeoTIFF sources for smooth playback
 */
export function useSingleLayer(
  dataset: { id: string; type: string } | undefined,
  mapRef: React.MutableRefObject<OLMap | null>,
  timelineDate?: string,
  timeSlot?: string,
  onActualSlot?: (date: string, slot: string) => void,
) {
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const prebuiltLayersRef = useRef<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>({});
  const activeDateRef = useRef<string>("");

  const isFirstApplyRef = useRef(true);
  const prevDatasetKeyRef = useRef<string | undefined>(undefined);
  const deferredClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourceCacheRef = useRef<Map<FrameKey, { source: GeoTIFF; ready: boolean }>>(new Map());
  const discoveredMetaRef = useRef<Map<FrameKey, RenderedLayer>>(new Map());
  const rawDataCacheRef = useRef<Map<FrameKey, { data: Float32Array; width: number; height: number }>>(new Map());

  useEffect(() => {
    const dsKey = dataset ? `${dataset.id}-${dataset.type}` : undefined;
    console.log("[useSingleLayer] trigger", { dataset, dsKey, timelineDate, timeSlot });

    if (deferredClearRef.current && dsKey !== undefined) {
      clearTimeout(deferredClearRef.current);
      deferredClearRef.current = null;
    }

    const dsChanged = dsKey !== prevDatasetKeyRef.current;

    if (dsChanged) {
      if (dsKey !== undefined) {
        isFirstApplyRef.current = true;
        prevDatasetKeyRef.current = dsKey;
        setRenderedLayers({});
        prebuiltLayersRef.current = {};
      } else {
        deferredClearRef.current = setTimeout(() => {
          deferredClearRef.current = null;
          setRenderedLayers({});
          prebuiltLayersRef.current = {};
          prevDatasetKeyRef.current = undefined;
          isFirstApplyRef.current = false;
        }, 50);
        return;
      }
    }

    if (!dataset || !dsKey) return;

    const dsInfoCheck = getDatasetById(dataset.id);
    const parentCheck = getParentDataset(dataset.id);
    if (dsInfoCheck?.gisData === false || parentCheck?.gisData === false) return;
    if (dataset.id === "wq-surface" || dataset.id === "wq-ground") return;

    const parent = getParentDataset(dataset.id);
    const dsInfo = getDatasetById(dataset.id);
    const root = getRootDataset(dataset.id);

    let datasetId: string, categorySlug: string;
    if (root && root.id !== dataset.id) {
      datasetId = root.id; categorySlug = getDatasetSlug(dataset.id) || dataset.id;
    } else if (parent) {
      datasetId = parent.id; categorySlug = getDatasetSlug(dataset.id) || dataset.id;
    } else if (dsInfo?.children?.length) {
      datasetId = dataset.id; categorySlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id;
    } else {
      datasetId = dataset.id; categorySlug = "default";
    }

    const [y, m, d] = timelineDate
      ? timelineDate.split("-").map(Number)
      : (() => { const t = new Date(); return [t.getFullYear(), t.getMonth() + 1, t.getDate()]; })();
    const md = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = timelineDate || `${y}-${md}-${dd}`;

    const dsSlug = getDatasetSlug(datasetId) || datasetId;
    const catName = dsInfo?.name || dataset.id;

    // Quick check: if exact frame key already discovered, use cached meta
    const exactKey: FrameKey = `${dsKey}__${dateStr}__${timeSlot ?? "00-00"}`;
    const cached = discoveredMetaRef.current.get(exactKey);

    if (cached) {
      console.log("[useSingleLayer] cache HIT exact", exactKey);
      activeDateRef.current = dateStr;
      setRenderedLayers({ [exactKey]: cached });
      return;
    }

    // Check if we have any keys for this date (different slot)
    const datePrefix = `${dsKey}__${dateStr}__`;
    const sameDateKeys = [...discoveredMetaRef.current.keys()].filter(k => k.startsWith(datePrefix));
    if (sameDateKeys.length > 0) {
      console.log("[useSingleLayer] cache HIT same-date", { date: dateStr, keys: sameDateKeys.length });
      const targetSlotNum = parseInt((timeSlot ?? "00-00").replace("-", ""), 10);
      let bestKey = sameDateKeys[0];
      let bestDiff = Infinity;
      for (const k of sameDateKeys) {
        const s = parseInt(k.slice(-5).replace("-", ""), 10);
        const d2 = Math.abs(s - targetSlotNum);
        if (d2 < bestDiff) { bestDiff = d2; bestKey = k; }
      }
      const bestMeta = discoveredMetaRef.current.get(bestKey);
      if (bestMeta) {
        activeDateRef.current = dateStr;
        setRenderedLayers({ [bestKey]: bestMeta });
        if (bestKey !== exactKey) {
          const actualSlot = bestKey.slice(-5);
          onActualSlot?.(dateStr, actualSlot);
        }
        return;
      }
    }

    // Check any cached key for the same dataset (different date, same slot)
    const dsPrefix = `${dsKey}__`;
    const allDsKeys = [...discoveredMetaRef.current.keys()].filter(k => k.startsWith(dsPrefix));
    if (allDsKeys.length > 0) {
      console.log("[useSingleLayer] cache HIT same-dataset (different date)", { dsKey, keys: allDsKeys.length });
      // Find nearest date to requested
      const targetDateNum = parseInt(dateStr.replace(/-/g, ""), 10);
      let bestKey = allDsKeys[0];
      let bestDiff = Infinity;
      for (const k of allDsKeys) {
        const parts = k.split("__");
        if (parts.length < 2) continue;
        const keyDateNum = parseInt(parts[1].replace(/-/g, ""), 10);
        const diff = Math.abs(keyDateNum - targetDateNum);
        if (diff < bestDiff) { bestDiff = diff; bestKey = k; }
      }
      const bestMeta = discoveredMetaRef.current.get(bestKey);
      if (bestMeta) {
        const actualDate = bestKey.split("__")[1];
        const actualSlot = bestKey.slice(-5);
        activeDateRef.current = actualDate;
        setRenderedLayers({ [bestKey]: bestMeta });
        onActualSlot?.(actualDate, actualSlot);
        return;
      }
    }

    console.log("[useSingleLayer] cache MISS, listing S3", { dsKey, date: dateStr, slot: timeSlot });

    const basePrefix = `gis-data/${dsSlug}/${categorySlug}/`;
    const prefixes = timelineDate
      ? [`${basePrefix}${y}/${md}/${dd}/`, `${basePrefix}${y}/${md}/`]
      : [basePrefix];

    const isFirstApply = isFirstApplyRef.current;
    let cancelled = false;

    void (async () => {
      for (const prefix of prefixes) {
        if (cancelled) { console.log("[useSingleLayer] cancelled before list"); break; }
        try {
          const result = await listS3Files(prefix);
          const allFiles = result._error ? [] : result.files;
          if (result._error) {
            console.warn("[useSingleLayer] S3 list error", { prefix, error: result._error, detail: result._detail });
            showNotification(`Cannot load data: ${result._error}`, "error");
            break;
          }
          console.log("[useSingleLayer] list result", { prefix, count: allFiles.length, cancelled });
          if (cancelled) break;

          if (dataset.type === "vector") {
            const vFile = allFiles.find(f => (f.key?.toLowerCase() ?? "").endsWith(".vct"))
              ?? allFiles.find(f => [".geojson", ".kml", ".zip"].some(e => (f.key?.toLowerCase() ?? "").endsWith(e)));
            if (!vFile) continue;
            const baseLower = vFile.key!.replace(/\.\w+$/, "").toLowerCase();
            const vdcFile = allFiles.find(f => f.key?.toLowerCase() === baseLower + ".vdc");
            const ext = "." + (vFile.key!.split(".").pop() || "").toLowerCase();
            activeDateRef.current = dateStr;
            setRenderedLayers({
              [dsKey]: {
                name: parent ? `${parent.name} - ${catName}` : catName,
                proxyUrl: `/api/tif?key=${encodeURIComponent(vFile.key!)}`,
                type: "vector", ext,
                vdcUrl: vdcFile ? `/api/tif?key=${encodeURIComponent(vdcFile.key!)}` : undefined,
              },
            });
            isFirstApplyRef.current = false;
            return;
          }

          const allTifs = allFiles.filter(f => f.key?.match(/\.tiff?$/i));
          console.log("[useSingleLayer] tifs", { prefix, tifCount: allTifs.length, cancelled });
          if (!allTifs.length) continue;

          const targetDateStr2 = `${y}/${md}/${dd}`;
          const uniqueDates = [...new Set(allTifs.map(f => dateOf(f.key ?? "")))].filter(Boolean).sort();
          const lte = timelineDate ? uniqueDates.filter(d2 => d2 <= targetDateStr2) : uniqueDates;
          if (!lte.length) {
            if (timelineDate) showNotification(`No data for "${catName}" before ${dateStr}`, "info");
            break;
          }
          const bestDate = lte[lte.length - 1];
          const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === bestDate);

          const slotPattern = (slot: string) => new RegExp(`\\/${slot}\\/(raster\\/)?[^/]+\\.tiff?$`, "i");
          let pickedTif = tifsForDate.find(f => slotPattern(timeSlot ?? "00-00").test(f.key ?? ""));

          if (!pickedTif) {
            if (isFirstApply) {
              const slotNum = parseInt((timeSlot ?? "00-00").replace("-", ""), 10);
              pickedTif = tifsForDate.reduce((best, f) => {
                const mm = f.key?.match(/\/(\d{2}-\d{2})\//);
                if (!mm) return best;
                const diff = Math.abs(parseInt(mm[1].replace("-", ""), 10) - slotNum);
                const bm = best?.key?.match(/\/(\d{2}-\d{2})\//);
                return diff < Math.abs(parseInt((bm?.[1] ?? "9999").replace("-", ""), 10) - slotNum) ? f : best;
              }, tifsForDate[0]);
            } else {
              showNotification(`No data for "${catName}" at ${timeSlot}`, "info");
              break;
            }
          }

          if (!pickedTif) break;

          const timeMatch = pickedTif.key!.match(/\/(\d{2}-\d{2})\//);
          const timeLabel = timeMatch ? timeMatch[1] : "00-00";
          const frameKey: FrameKey = `${dsKey}__${bestDate.replace(/\//g, "-")}__${timeLabel}`;

          const meta: RenderedLayer = {
            name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`,
            proxyUrl: `/api/tif?key=${encodeURIComponent(pickedTif.key!)}`,
            type: "raster",
            bbox: [594885, 1052655, 688485, 1117455],
            nodata: -9999,
          };

          activeDateRef.current = bestDate.replace(/\//g, "-");
          discoveredMetaRef.current.set(frameKey, meta);
          console.log("[useSingleLayer] set rendered", frameKey, meta.proxyUrl);
          setRenderedLayers({ [frameKey]: meta });

          if (isFirstApply && timeLabel !== (timeSlot ?? "00-00")) {
            onActualSlot?.(bestDate.replace(/\//g, "-"), timeLabel);
          }
          isFirstApplyRef.current = false;
          return;
        } catch (e) {
          console.warn("[useSingleLayer] error", prefix, e);
        }
      }
      console.log("[useSingleLayer] async done", { cancelled });
    })();

    return () => {
      cancelled = true;
      if (deferredClearRef.current) {
        clearTimeout(deferredClearRef.current);
        deferredClearRef.current = null;
      }
    };
  }, [dataset?.id, dataset?.type, timelineDate, timeSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  async function preloadFrames(frameKeys: FrameKey[]): Promise<void> {
    // Phase 1: discover missing frame keys (S3 listing)
    const needDiscover = frameKeys.filter(k => !discoveredMetaRef.current.has(k));
    if (needDiscover.length > 0) {
      console.log("[preload] Phase1 discover", { total: needDiscover.length });
      for (let i = 0; i < needDiscover.length; i += PRELOAD_CONCURRENCY) {
        const batch = needDiscover.slice(i, i + PRELOAD_CONCURRENCY);
        await Promise.all(batch.map(async (k) => {
          if (discoveredMetaRef.current.has(k)) return null;
          const meta = await discoverFrameMeta(k);
          if (meta) {
            discoveredMetaRef.current.set(k, meta);
          }
          return null;
        }));
      }
      console.log("[preload] Phase1 done, cache size:", discoveredMetaRef.current.size);
    }

    // Phase 2: download GeoTIFF sources + decode raw values
    const toLoad = frameKeys.filter(k =>
      discoveredMetaRef.current.has(k) && !sourceCacheRef.current.has(k)
    );
    if (toLoad.length === 0) return;

    for (let i = 0; i < toLoad.length; i += PRELOAD_CONCURRENCY) {
      const batch = toLoad.slice(i, i + PRELOAD_CONCURRENCY);
      await Promise.all(batch.map(async (frameKey) => {
        const meta = discoveredMetaRef.current.get(frameKey);
        if (!meta || sourceCacheRef.current.has(frameKey)) return;
        try {
          const proxyUrl = meta.proxyUrl as string;
          const url = proxyUrl.startsWith("http") ? proxyUrl : `${window.location.origin}${proxyUrl}`;

          // Single fetch: reuse response for both GeoTIFF source + raw decode
          const resp = await fetch(url);
          const buf = await resp.arrayBuffer();
          const blob = new Blob([buf], { type: "image/tiff" });
          const blobUrl = URL.createObjectURL(blob);

          const source = new GeoTIFF({
            sources: [{ url: blobUrl, nodata: -9999 }],
            convertToRGB: false, normalize: false, interpolate: false,
            projection: "EPSG:32648",
          });
          await source.getView();
          sourceCacheRef.current.set(frameKey, { source, ready: true });

          // Also decode raw values for pixel morphing transition
          if (!rawDataCacheRef.current.has(frameKey)) {
            try {
              const tif = await fromArrayBuffer(buf.slice(0));
              const img = await tif.getImage();
              const rasters = await img.readRasters();
              const rawData = rasters[0] as Float32Array;
              console.log("[preload] raw decoded", { frameKey, w: img.getWidth(), h: img.getHeight(), len: rawData.length });
              rawDataCacheRef.current.set(frameKey, {
                data: rawData,
                width: img.getWidth(),
                height: img.getHeight(),
              });
            } catch (e2) {
              console.warn("[preload] raw decode failed", frameKey, e2);
            }
          }
        } catch {
          console.warn("[preloadFrames] failed", frameKey);
        }
      }));
    }
  }

  const layerRefs = useS3LayerRenderer(renderedLayers, mapRef, prebuiltLayersRef, activeDateRef, sourceCacheRef);
  return { renderedLayers, layerRefs, preloadFrames };
}
