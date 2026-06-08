"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type OLMap from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import GeoTIFF from "ol/source/GeoTIFF";
import { transformExtent } from "ol/proj";
import { getDatasetSlug, getParentDataset, getDatasetById, getRootDataset } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import type { RenderedLayer } from "./useS3DatasetLayers";
import { buildInterpolateStyle, TIMELAPSE_STOPS } from "../../lib/constants/raster-colors";

const RASTER_STYLE = buildInterpolateStyle(TIMELAPSE_STOPS, -9999);

const FADE_MS = 180;
const PRELOAD_CONCURRENCY = 6;
const MAX_SOURCE_CACHE = 300;
type FrameKey = string;

type DsEntry = {
  layer: WebGLTileLayer;
  currentFrameKey: FrameKey | null;
  loading: boolean;
};

type SourceCacheEntry = {
  source: GeoTIFF;
  ready: boolean;
};

function fade(layer: WebGLTileLayer, from: number, to: number, ms: number) {
  if (from === to) return;
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
  const dsLayersRef = useRef<Map<string, DsEntry>>(new Map());
  const metaRef = useRef<Map<FrameKey, RenderedLayer>>(new Map());
  const sourceCacheRef = useRef<Map<FrameKey, SourceCacheEntry>>(new Map());
  const layerRefs = useRef<Record<string, WebGLTileLayer | VectorLayer>>({});
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const prevDsRef = useRef("");
  const fittedRef = useRef(false);
  const [discoverTick, setDiscoverTick] = useState(0);

  function evictSourceCache(toKeep: number) {
    const cache = sourceCacheRef.current;
    if (cache.size <= toKeep) return;
    const keys = [...cache.keys()];
    const toEvict = cache.size - toKeep;
    for (let i = 0; i < toEvict && i < keys.length; i++) {
      const entry = cache.get(keys[i]);
      if (entry) {
        try { entry.source.dispose(); } catch { /* ignore */ }
      }
      cache.delete(keys[i]);
    }
  }

  function showFrame(dsKey: string, frameKey: FrameKey, map: OLMap) {
    const entry = dsLayersRef.current.get(dsKey);
    const meta = metaRef.current.get(frameKey);
    if (!entry || !meta) return;
    if (entry.currentFrameKey === frameKey) return;

    const cached = sourceCacheRef.current.get(frameKey);
    if (cached?.ready) {
      entry.loading = false;
      entry.currentFrameKey = frameKey;
      entry.layer.setOpacity(0);
      entry.layer.setSource(cached.source);
      fade(entry.layer, 0, 0.7, FADE_MS);
      setRenderedLayers(prev => ({ ...prev, [frameKey]: meta }));
      if (!fittedRef.current) {
        fittedRef.current = true;
        cached.source.getView().then(vo => {
          if (!mapRef.current || !vo.extent || !vo.projection) return;
          const p = typeof vo.projection === "string" ? vo.projection : vo.projection.getCode();
          mapRef.current.getView().fit(transformExtent(vo.extent, p, "EPSG:3857"), { padding: [48, 48, 48, 48], duration: 300, maxZoom: 15 });
        }).catch(() => {});
      }
      return;
    }

    const proxyUrl = meta.proxyUrl as string;
    const url = proxyUrl.startsWith("http") ? proxyUrl : `${window.location.origin}${proxyUrl}`;

    const newSrc = new GeoTIFF({
      sources: [{ url, nodata: -9999 }],
      convertToRGB: false, normalize: false, interpolate: false, projection: "EPSG:32648",
    });

    entry.loading = true;
    entry.currentFrameKey = frameKey;
    entry.layer.setOpacity(0);
    entry.layer.setSource(newSrc);

    newSrc.once("change", () => {
      if (newSrc.getState() !== "ready") return;
      if (entry.currentFrameKey !== frameKey) return;
      entry.loading = false;
      fade(entry.layer, 0, 0.7, FADE_MS);
      setRenderedLayers(prev => ({ ...prev, [frameKey]: meta }));

      sourceCacheRef.current.set(frameKey, { source: newSrc, ready: true });
      evictSourceCache(MAX_SOURCE_CACHE);

      if (!fittedRef.current) {
        fittedRef.current = true;
        newSrc.getView().then(vo => {
          if (!mapRef.current || !vo.extent || !vo.projection) return;
          const p = typeof vo.projection === "string" ? vo.projection : vo.projection.getCode();
          mapRef.current.getView().fit(transformExtent(vo.extent, p, "EPSG:3857"), { padding: [48, 48, 48, 48], duration: 300, maxZoom: 15 });
        }).catch(() => {});
      }
    });
  }

  function buildDsPaths(ds: { id: string; type: string }) {
    const dsInfo = getDatasetById(ds.id);
    const parent = getParentDataset(ds.id);
    const root = getRootDataset(ds.id);
    
    let datasetId: string, catSlug: string;
    
    if (root && root.id !== ds.id) {
      datasetId = root.id;
      const rootPrefix = root.id + "/";
      const relativePath = ds.id.startsWith(rootPrefix) ? ds.id.slice(rootPrefix.length) : ds.id;
      catSlug = getDatasetSlug(ds.id) || relativePath;
    } else if (parent) {
      datasetId = parent.id;
      const parentPrefix = parent.id + "/";
      const relativePath = ds.id.startsWith(parentPrefix) ? ds.id.slice(parentPrefix.length) : ds.id;
      catSlug = getDatasetSlug(ds.id) || relativePath;
    } else if (dsInfo?.children?.length) {
      datasetId = ds.id;
      catSlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id;
    } else {
      datasetId = ds.id;
      catSlug = "default";
    }
    
    const dsSlug = getDatasetSlug(datasetId) || datasetId;
    const catName = dsInfo?.name || ds.id;
    
    return { parent, catName, dsSlug, catSlug, datasetId };
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const rasterDs = (appliedDatasets ?? []).filter(d => d.type === "raster");
    const dsStr = rasterDs.map(d => `${d.id}-${d.type}`).join(",");

    if (dsStr !== prevDsRef.current) {
      prevDsRef.current = dsStr;
      fittedRef.current = false;
      for (const entry of dsLayersRef.current.values()) {
        map.removeLayer(entry.layer);
        entry.layer.getSource()?.dispose?.();
      }
      dsLayersRef.current.clear();
      metaRef.current.clear();
      layerRefs.current = {};
      setRenderedLayers({});

      rasterDs.forEach((ds, idx) => {
        const dsKey = `${ds.id}-${ds.type}`;
        const layer = new WebGLTileLayer({ opacity: 0, style: RASTER_STYLE });
        layer.setZIndex(110 + idx);
        map.addLayer(layer);
        layerRefs.current[dsKey] = layer;
        dsLayersRef.current.set(dsKey, { layer, currentFrameKey: null, loading: false });
      });
    }

    if (!rasterDs.length || !allTimelineDates?.length) return;

    let cancelled = false;
    void (async () => {
      const dateOf = (k: string) => { const m2 = k.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//); return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : ""; };

      // Group dates by month for bulk listing
      const monthGroups = new Map<string, string[]>();
      for (const d of allTimelineDates) {
        const [y, m] = d.split("-");
        const mk = `${y}-${m}`;
        if (!monthGroups.has(mk)) monthGroups.set(mk, []);
        monthGroups.get(mk)!.push(d);
      }

      let firstDateDone = false;

      for (const ds of rasterDs) {
        if (cancelled) break;
        const paths = buildDsPaths(ds);
        if (paths.datasetId === ds.id && !paths.dsSlug) continue;

        const dsKey = `${ds.id}-${ds.type}`;

        for (const [ym, dates] of monthGroups) {
          if (cancelled) break;
          const [y, m] = ym.split("-");
          const md = String(Number(m)).padStart(2, "0");
          const monthPrefix = `gis-data/${paths.dsSlug}/${paths.catSlug}/${y}/${md}/`;

          try {
            // List month once, then filter by dates
            let monthFiles: Awaited<ReturnType<typeof listS3Files>>;
            try {
              monthFiles = await listS3Files(monthPrefix);
            } catch { continue; }
            if (cancelled) break;

            const tifs = monthFiles.files.filter(f => f.key?.match(/\.tiff?$/i));
            if (!tifs.length) continue;

            // Build date→slot→tif map from the single month listing
            // Use allTimelineDates for filtering, not just current month dates
            const allDatesSet = new Set(allTimelineDates);
            const dateSlotMap = new Map<string, Map<string, typeof tifs[0]>>();
            for (const t of tifs) {
              const d = dateOf(t.key!);
              if (!d) continue;
              const dateKey = d.replace(/\//g, "-");
              if (!allDatesSet.has(dateKey)) continue;
              const sm = t.key!.match(/\/(\d{2}-\d{2})\//);
              const slot = sm ? sm[1] : "00-00";
              if (!dateSlotMap.has(d)) dateSlotMap.set(d, new Map());
              dateSlotMap.get(d)!.set(slot, t);
            }

            for (const dateStr of dates) {
              if (cancelled) break;
              const [yy, mm, dd] = dateStr.split("-");
              const dateKey = `${yy}/${String(Number(mm)).padStart(2, "0")}/${String(Number(dd)).padStart(2, "0")}`;

              const slots = dateSlotMap.get(dateKey);
              if (!slots) continue;

              for (const [slot, tif] of slots) {
                const frameKey: FrameKey = `${dsKey}__${dateStr}__${slot}`;
                if (!metaRef.current.has(frameKey)) {
                  metaRef.current.set(frameKey, {
                    name: paths.parent ? `${paths.parent.name} - ${paths.catName} (${slot})` : `${paths.catName} (${slot})`,
                    proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`,
                    type: "raster", bbox: [594885, 1052655, 688485, 1117455], nodata: -9999,
                  });
                }
              }
            }
          } catch { /* ignore */ }
        }

        if (!firstDateDone) {
          firstDateDone = true;
          setDiscoverTick(t => t + 1);
        }
      }
      setDiscoverTick(t => t + 1);
    })();

    return () => { cancelled = true; };
  }, [appliedDatasets, allTimelineDates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !appliedDatasets?.length || !timelineDate || !timeSlot) return;

    for (const ds of appliedDatasets) {
      if (ds.type !== "raster") continue;
      const dsKey = `${ds.id}-${ds.type}`;
      if (!dsLayersRef.current.has(dsKey)) continue;

      const exactKey: FrameKey = `${dsKey}__${timelineDate}__${timeSlot}`;
      let targetKey = exactKey;

      if (!metaRef.current.has(exactKey)) {
        const prefix = `${dsKey}__${timelineDate}__`;
        const avail = [...metaRef.current.keys()].filter(k => k.startsWith(prefix));
        if (!avail.length) continue;
        const sn = parseInt(timeSlot.replace("-", ""), 10);
        targetKey = avail.reduce((b, k) => {
          const diff = (key: string) => Math.abs(parseInt(key.slice(-5).replace("-", ""), 10) - sn);
          return diff(k) < diff(b) ? k : b;
        });
        const actualSlot = targetKey.slice(-5);
        if (actualSlot !== timeSlot) onActualSlot?.(timelineDate, actualSlot);
      }

      showFrame(dsKey, targetKey, map);
    }
  }, [timelineDate, timeSlot, appliedDatasets, discoverTick]);

  async function preloadFrames(frameKeys: FrameKey[]): Promise<void> {
    const toLoad = frameKeys.filter(k =>
      metaRef.current.has(k) && !sourceCacheRef.current.has(k)
    );
    if (toLoad.length === 0) return;

    evictSourceCache(Math.max(0, MAX_SOURCE_CACHE - toLoad.length));

    for (let i = 0; i < toLoad.length; i += PRELOAD_CONCURRENCY) {
      const batch = toLoad.slice(i, i + PRELOAD_CONCURRENCY);
      await Promise.all(batch.map(async (frameKey) => {
        const meta = metaRef.current.get(frameKey);
        if (!meta || sourceCacheRef.current.has(frameKey)) return;
        try {
          const proxyUrl = meta.proxyUrl as string;
          const url = proxyUrl.startsWith("http") ? proxyUrl : `${window.location.origin}${proxyUrl}`;
          const source = new GeoTIFF({
            sources: [{ url, nodata: -9999 }],
            convertToRGB: false, normalize: false, interpolate: false,
            projection: "EPSG:32648",
          });
          await source.getView();
          sourceCacheRef.current.set(frameKey, { source, ready: true });
        } catch {
          console.warn("[preloadFrames] failed", frameKey);
        }
      }));
    }
    evictSourceCache(MAX_SOURCE_CACHE);
  }

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      for (const entry of dsLayersRef.current.values()) {
        map?.removeLayer(entry.layer);
        entry.layer.getSource()?.dispose?.();
      }
      for (const entry of sourceCacheRef.current.values()) {
        try { entry.source.dispose(); } catch { /* ignore */ }
      }
      sourceCacheRef.current.clear();
    };
  }, []);

  return {
    renderedLayers, layerRefs,
    preloadFrames,
    layersCacheRef: { current: {} } as React.MutableRefObject<Record<string, Record<string, RenderedLayer>>>,
  };
}
