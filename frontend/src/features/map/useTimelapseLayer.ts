"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type OLMap from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import GeoTIFF from "ol/source/GeoTIFF";
import { transformExtent } from "ol/proj";
import { getDatasetSlug, getParentDataset, getDatasetById } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import type { RenderedLayer } from "./useS3DatasetLayers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RASTER_STYLE: any = {
  color: [
    "case",
    ["<=", ["band", 1], -9999], [0, 0, 0, 0],
    ["<=", ["band", 1], 0], [0, 0, 0, 0],
    ["<", ["band", 1], 0.06], [0, 0, 0, 0],
    ["interpolate", ["linear"], ["band", 1],
      0.06, [0, 0, 255, 1], 5, [0, 255, 255, 1],
      10, [0, 255, 0, 1], 15, [255, 255, 0, 1],
      20, [255, 165, 0, 1], 21, [255, 0, 0, 1],
    ],
  ],
};

// Keep at most this many WebGL layers alive per dataset key
const MAX_POOL = 8;
const FADE_MS = 180;

type FrameKey = string;
type PoolEntry = { frameKey: FrameKey; layer: WebGLTileLayer; ready: boolean; ts: number };

function fade(layer: WebGLTileLayer, from: number, to: number, ms: number) {
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    layer.setOpacity(from + (to - from) * t);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function useTimelapseLayer(
  appliedDatasets: Array<{ id: string; type: string }> | undefined,
  mapRef: React.MutableRefObject<OLMap | null>,
  timelineDate?: string,
  timeSlot?: string,
  allTimelineDates?: string[],
  onActualSlot?: (date: string, slot: string) => void,
) {
  const poolRef = useRef<Map<string, PoolEntry[]>>(new Map());
  const activeRef = useRef<Map<string, FrameKey>>(new Map());
  const metaRef = useRef<Map<FrameKey, RenderedLayer>>(new Map());
  const layerRefs = useRef<Record<string, WebGLTileLayer | VectorLayer>>({});
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const prevDsRef = useRef("");
  const fittedRef = useRef(false);
  // True while pool is being cleared/rebuilt — prevents showFrame race
  const rebuildingRef = useRef(false);

  function evict(dsKey: string, map: OLMap) {
    const pool = poolRef.current.get(dsKey) ?? [];
    const active = activeRef.current.get(dsKey);
    const evictable = pool.filter(e => e.frameKey !== active).sort((a, b) => a.ts - b.ts);
    while (pool.length > MAX_POOL && evictable.length > 0) {
      const e = evictable.shift()!;
      map.removeLayer(e.layer);
      e.layer.getSource()?.dispose?.();
      pool.splice(pool.indexOf(e), 1);
      delete layerRefs.current[e.frameKey];
    }
  }

  function buildLayer(frameKey: FrameKey, proxyUrl: string, dsKey: string, map: OLMap) {
    const pool = poolRef.current.get(dsKey) ?? [];
    if (pool.some(e => e.frameKey === frameKey)) return;
    const src = new GeoTIFF({
      sources: [{ url: `${window.location.origin}${proxyUrl}`, nodata: -9999 }],
      convertToRGB: false, normalize: false, interpolate: false, projection: "EPSG:32648",
    });
    const layer = new WebGLTileLayer({ source: src, opacity: 0, visible: true, style: RASTER_STYLE });
    layer.setZIndex(110);
    map.addLayer(layer);
    const entry: PoolEntry = { frameKey, layer, ready: false, ts: Date.now() };
    pool.push(entry);
    poolRef.current.set(dsKey, pool);
    layerRefs.current[frameKey] = layer;

    if (!fittedRef.current) {
      src.getView().then(vo => {
        if (fittedRef.current || !mapRef.current || !vo.extent || !vo.projection) return;
        fittedRef.current = true;
        const p = typeof vo.projection === "string" ? vo.projection : vo.projection.getCode();
        mapRef.current.getView().fit(transformExtent(vo.extent, p, "EPSG:3857"), { padding: [48, 48, 48, 48], duration: 300, maxZoom: 15 });
      }).catch(() => {});
    }

    src.once("change", () => {
      if (src.getState() !== "ready") return;
      entry.ready = true;
      // Guard: pool may have been cleared while loading
      if (rebuildingRef.current) return;
      if (activeRef.current.get(dsKey) === frameKey) showFrame(dsKey, frameKey, map);
    });
    evict(dsKey, map);
  }

  function showFrame(dsKey: string, newKey: FrameKey, map: OLMap) {
    const pool = poolRef.current.get(dsKey) ?? [];
    const newEntry = pool.find(e => e.frameKey === newKey);
    if (!newEntry?.ready) return;

    const oldKey = activeRef.current.get(dsKey);
    activeRef.current.set(dsKey, newKey);

    // Fade in new layer first, then fade out old — no black gap
    newEntry.layer.setOpacity(0);
    fade(newEntry.layer, 0, 0.7, FADE_MS);
    if (oldKey && oldKey !== newKey) {
      const oldEntry = pool.find(e => e.frameKey === oldKey);
      // Delay fade-out so new layer is visible before old disappears
      if (oldEntry) setTimeout(() => fade(oldEntry.layer, oldEntry.layer.getOpacity(), 0, FADE_MS), FADE_MS * 0.5);
    }

    const meta = metaRef.current.get(newKey);
    if (meta) setRenderedLayers({ [newKey]: meta });
    evict(dsKey, map);
  }

  // ── Discover all frames metadata (list S3) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !appliedDatasets?.length || !allTimelineDates?.length) return;

    const dsStr = appliedDatasets.map(d => `${d.id}-${d.type}`).join(",");
    if (dsStr !== prevDsRef.current) {
      prevDsRef.current = dsStr;
      fittedRef.current = false;
      rebuildingRef.current = true;
      for (const pool of poolRef.current.values())
        for (const e of pool) { map.removeLayer(e.layer); e.layer.getSource()?.dispose?.(); }
      poolRef.current.clear();
      metaRef.current.clear();
      activeRef.current.clear();
      layerRefs.current = {};
      setRenderedLayers({});
    }

    let cancelled = false;
    void (async () => {
      for (const dateStr of allTimelineDates) {
        if (cancelled) break;
        const [y, m, d] = dateStr.split("-").map(Number);
        const md = String(m).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        for (const ds of appliedDatasets) {
          if (cancelled || ds.type !== "raster") continue;
          const dsKey = `${ds.id}-${ds.type}`;
          const dsInfo = getDatasetById(ds.id);
          const parent = getParentDataset(ds.id);
          if (dsInfo?.gisData === false || parent?.gisData === false) continue;
          let datasetId: string, catSlug: string;
          if (parent) { datasetId = parent.id; catSlug = getDatasetSlug(ds.id) || ds.id; }
          else if (dsInfo?.children?.length) { datasetId = ds.id; catSlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id; }
          else { datasetId = ds.id; catSlug = "default"; }
          const catName = dsInfo?.name || ds.id;
          const dsSlug = getDatasetSlug(datasetId) || datasetId;
          try {
            const files = await listS3Files(`gis-data/${dsSlug}/${catSlug}/${y}/${md}/${dd}/`);
            if (cancelled) break;
            const dateOf = (k: string) => { const m2 = k.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//); return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : ""; };
            for (const tif of files.filter(f => f.key?.match(/\.tiff?$/i) && dateOf(f.key) === `${y}/${md}/${dd}`)) {
              const tm = tif.key!.match(/\/(\d{2}-\d{2})\//);
              const slot = tm ? tm[1] : "00-00";
              const frameKey: FrameKey = `${dsKey}__${dateStr}__${slot}`;
              if (!metaRef.current.has(frameKey)) {
                metaRef.current.set(frameKey, {
                  name: parent ? `${parent.name} - ${catName} (${slot})` : `${catName} (${slot})`,
                  proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`,
                  type: "raster", bbox: [594885, 1052655, 688485, 1117455], nodata: -9999,
                });
              }
            }
          } catch { /* ignore */ }
        }
        // Unblock showFrame after each date is discovered, not only at the end
        if (rebuildingRef.current) rebuildingRef.current = false;
      }
    })();
    return () => { cancelled = true; };
  }, [appliedDatasets, allTimelineDates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preload all frames for a given list of frameKeys, resolve when all ready ──
  function preloadFrames(frameKeys: FrameKey[]): Promise<void> {
    const map = mapRef.current;
    if (!map || frameKeys.length === 0) return Promise.resolve();
    return new Promise(resolve => {
      const metaCheckInterval = setInterval(() => {
        const missingMeta = frameKeys.filter(k => !metaRef.current.has(k));
        if (missingMeta.length > 0) return;
        clearInterval(metaCheckInterval);

        const pending = frameKeys.filter(k => {
          const pool = poolRef.current.get(k.split("__")[0]) ?? [];
          return !pool.find(e => e.frameKey === k)?.ready;
        });
        if (pending.length === 0) { resolve(); return; }

        let done = 0;
        for (const frameKey of pending) {
          const dsKey = frameKey.split("__")[0];
          const meta = metaRef.current.get(frameKey);
          if (!meta) { done++; if (done === pending.length) resolve(); continue; }
          const existingPool = poolRef.current.get(dsKey) ?? [];
          const existing = existingPool.find(e => e.frameKey === frameKey);
          if (existing?.ready) { done++; if (done === pending.length) resolve(); continue; }
          if (!existing) buildLayer(frameKey, meta.proxyUrl as string, dsKey, map);
          const check = setInterval(() => {
            const p = poolRef.current.get(dsKey) ?? [];
            if (p.find(e => e.frameKey === frameKey)?.ready) {
              clearInterval(check);
              done++;
              if (done === pending.length) resolve();
            }
          }, 100);
        }
      }, 200);
    });
  }

  // ── On timeline change: show current frame ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !appliedDatasets?.length || !timelineDate || !timeSlot) return;
    if (rebuildingRef.current) return; // pool is being rebuilt, skip

    for (const ds of appliedDatasets) {
      if (ds.type !== "raster") continue;
      const dsKey = `${ds.id}-${ds.type}`;

      // Resolve exact or nearest key
      const frameKey: FrameKey = `${dsKey}__${timelineDate}__${timeSlot}`;
      let targetKey = frameKey;
      if (!metaRef.current.has(frameKey)) {
        const prefix = `${dsKey}__${timelineDate}__`;
        const avail = [...metaRef.current.keys()].filter(k => k.startsWith(prefix));
        if (!avail.length) continue;
        const sn = parseInt(timeSlot.replace("-", ""), 10);
        targetKey = avail.reduce((b, k) => Math.abs(parseInt(k.slice(-5).replace("-", ""), 10) - sn) < Math.abs(parseInt(b.slice(-5).replace("-", ""), 10) - sn) ? k : b);
        const actualSlot = targetKey.slice(-5);
        if (actualSlot !== timeSlot) onActualSlot?.(timelineDate, actualSlot);
      }

      activeRef.current.set(dsKey, targetKey);
      const meta = metaRef.current.get(targetKey);
      if (!meta) continue;

      const pool = poolRef.current.get(dsKey) ?? [];
      const entry = pool.find(e => e.frameKey === targetKey);
      if (entry?.ready) {
        showFrame(dsKey, targetKey, map);
      } else if (!entry) {
        buildLayer(targetKey, meta.proxyUrl as string, dsKey, map);
      }
      // else: building, will show when ready via source.once("change")
    }
  }, [timelineDate, timeSlot, appliedDatasets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      for (const pool of poolRef.current.values())
        for (const e of pool) { map?.removeLayer(e.layer); e.layer.getSource()?.dispose?.(); }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    renderedLayers, layerRefs,
    preloadFrames,
    layersCacheRef: { current: {} } as React.MutableRefObject<Record<string, Record<string, RenderedLayer>>>,
  };
}
