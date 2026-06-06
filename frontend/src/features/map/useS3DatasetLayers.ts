"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type Map from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import { getDatasetSlug, getParentDataset, getDatasetById } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import { showNotification } from "../../lib/notification";
import { useS3LayerRenderer } from "./useS3LayerRenderer";

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

function getPrefix(key: string) { return key.split("__")[0]; }

/**
 * Multi-layer timelapse mode: manages a per-date frame cache, preloads adjacent dates,
 * and delegates all OL rendering to useS3LayerRenderer.
 */
export function useS3DatasetLayers(
  appliedDatasets: Array<{ id: string; type: string }> | undefined,
  mapRef: React.MutableRefObject<Map | null>,
  timelineDate?: string,
  timeSlot?: string,
  prefetchDate?: string,
  allTimelineDates?: string[],
  onActualSlot?: (date: string, slot: string) => void,
) {
  const prevDateRef = useRef<string | undefined>(undefined);
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const layersCacheRef = useRef<Record<string, Record<string, RenderedLayer>>>({});
  const prebuiltLayersRef = useRef<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>({});
  const activeDateRef = useRef<string>("");
  // Track which dataset keys are being applied for the first time (fresh apply, not re-apply)
  const firstApplyKeysRef = useRef<Set<string>>(new Set());

  // ── Main fetch effect ──
  useEffect(() => {
    const dsKeys = (appliedDatasets ?? []).map(d => `${d.id}-${d.type}`);
    const next = new Set(dsKeys);
    const prevKeys = Object.keys(renderedLayers);
    const prev = new Set(prevKeys.map(k => getPrefix(k)));

    const [y, m, d] = timelineDate
      ? timelineDate.split("-").map(Number)
      : (() => { const t = new Date(); return [t.getFullYear(), t.getMonth() + 1, t.getDate()]; })();
    const md = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = timelineDate || `${y}-${md}-${dd}`;

    const dateChanged = prevDateRef.current !== undefined && prevDateRef.current !== timelineDate;
    prevDateRef.current = timelineDate;

    // Mark newly added dataset keys as firstApply
    for (const k of next) {
      if (!prev.has(k)) firstApplyKeysRef.current.add(k);
    }

    const toRemove = prevKeys.filter(key => !next.has(getPrefix(key)));

    // When removing: clear cache + prebuilt layers + firstApply flag for removed datasets
    if (toRemove.length > 0) {
      setRenderedLayers(prev2 => {
        const next2 = { ...prev2 };
        for (const k of toRemove) delete next2[k];
        return next2;
      });
      for (const rp of toRemove.map(getPrefix)) {
        firstApplyKeysRef.current.delete(rp);
        for (const dc of Object.values(layersCacheRef.current))
          for (const k of Object.keys(dc)) { if (getPrefix(k) === rp) delete dc[k]; }
        for (const dl of Object.values(prebuiltLayersRef.current))
          for (const k of Object.keys(dl)) { if (getPrefix(k) === rp) delete dl[k]; }
      }
    }

    // Slot/date changed → check cache for exact slot match (only for non-firstApply datasets)
    if (dateChanged || (timeSlot && prevKeys.length > 0)) {
      const cached = layersCacheRef.current[dateStr];
      if (cached) {
        activeDateRef.current = dateStr;
        const exact: Record<string, RenderedLayer> = {};
        for (const [k, v] of Object.entries(cached)) {
          if ((!timeSlot || k.endsWith(`__${timeSlot}`)) && next.has(k.split("__")[0])) {
            exact[k] = v;
          }
        }
        const cachedPrefixes = new Set(Object.keys(exact).map(k => k.split("__")[0]));
        const allInCache = [...next].every(key => cachedPrefixes.has(key));
        if (allInCache) { setRenderedLayers(exact); return; }
        if (Object.keys(exact).length > 0) setRenderedLayers(exact);
      }
    }

    const toAdd = dateChanged
      ? [...next]
      : [...next].filter(key => !prev.has(key));

    if (toAdd.length === 0) return;
    let isActive = true;

    void (async () => {
      const additions: Record<string, RenderedLayer> = {};

      for (const dsKey of toAdd) {
        if (!isActive) break;
        const dsEntry = (appliedDatasets ?? []).find(d => `${d.id}-${d.type}` === dsKey);
        if (!dsEntry) continue;

        const dsId = dsEntry.id;
        const isVector = dsEntry.type === "vector";
        const dsInfoCheck = getDatasetById(dsId);
        const parentCheck = getParentDataset(dsId);
        if (dsInfoCheck?.gisData === false || parentCheck?.gisData === false) continue;
        if (dsId === "wq-surface" || dsId === "wq-ground") continue;

        const parent = getParentDataset(dsId);
        const dsInfo = getDatasetById(dsId);
        let datasetId: string, categorySlug: string;
        if (parent) {
          datasetId = parent.id;
          categorySlug = getDatasetSlug(dsId) || dsId;
        } else if (dsInfo?.children?.length) {
          datasetId = dsId;
          categorySlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id;
        } else {
          datasetId = dsId;
          categorySlug = "default";
        }

        const dsSlug = getDatasetSlug(datasetId) || datasetId;
        const catName = dsInfo?.name || dsId;
        const basePrefix = `gis-data/${dsSlug}/${categorySlug}/`;
        const prefixes = timelineDate
          ? [`${basePrefix}${y}/${md}/${dd}/`, `${basePrefix}${y}/${md}/`, `${basePrefix}${y}/`, basePrefix]
          : [basePrefix];

        let foundKey: string | null = null;
        let vdcKey: string | null = null;
        let rasterFound = false;

        for (const prefix of prefixes) {
          if (!isActive) break;
          try {
            const allFiles = await listS3Files(prefix);
            if (!isActive) break;
            const files = [...allFiles].sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));

            if (isVector) {
              const vFile = files.find(f => (f.key?.toLowerCase() ?? "").endsWith(".vct"))
                ?? files.find(f => [".geojson", ".kml", ".zip"].some(e => (f.key?.toLowerCase() ?? "").endsWith(e)));
              if (vFile) {
                foundKey = vFile.key!;
                const baseLower = foundKey.replace(/\.\w+$/, "").toLowerCase();
                const comp = files.find(f => f.key?.toLowerCase() === baseLower + ".vdc");
                if (comp) vdcKey = comp.key!;
                break;
              }
            } else {
              const allTifs = files.filter(f => f.key?.match(/\.tiff?$/i));
              if (!allTifs.length) continue;
              const dateOf = (key: string) => { const m2 = key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//); return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : ""; };
              const targetDateStr = `${y}/${md}/${dd}`;
              const uniqueDates = [...new Set(allTifs.map(f => dateOf(f.key ?? "")))].filter(Boolean).sort();

              const lte = timelineDate ? uniqueDates.filter(d2 => d2 <= targetDateStr) : uniqueDates;
              if (!lte.length) {
                if (isActive && timelineDate) showNotification(`No raster data for "${catName}" before ${dateStr}`, "info");
                break;
              }
              const bestDate = lte[lte.length - 1];
              const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === bestDate);

              // isFirstApply: this dataset key was just added (fresh apply or re-apply after remove)
              const isFirstApply = firstApplyKeysRef.current.has(dsKey);

              let pickedTif = tifsForDate.find(f => f.key?.includes(`/${timeSlot ?? "00-00"}/`));

              if (!pickedTif && isFirstApply) {
                // First apply: fallback to nearest slot
                const slotNum = parseInt((timeSlot ?? "00-00").replace("-", ""), 10);
                pickedTif = tifsForDate.reduce((best, f) => {
                  const m2 = f.key?.match(/\/(\d{2}-\d{2})\//);
                  if (!m2) return best;
                  const diff = Math.abs(parseInt(m2[1].replace("-", ""), 10) - slotNum);
                  const bm = best?.key?.match(/\/(\d{2}-\d{2})\//);
                  return diff < Math.abs(parseInt((bm?.[1] ?? "9999").replace("-", ""), 10) - slotNum) ? f : best;
                }, tifsForDate[0]);
              } else if (!pickedTif) {
                // User moved timeline: exact slot required, no fallback
                if (isActive) showNotification(`No data for "${catName}" at ${timeSlot}`, "info");
                break;
              }

              if (pickedTif) {
                const timeMatch = pickedTif.key!.match(/\/(\d{2}-\d{2})\//);
                const timeLabel = timeMatch ? timeMatch[1] : "00-00";
                const frameKey = `${dsKey}__${bestDate.replace(/\//g, "-")}__${timeLabel}`;
                additions[frameKey] = {
                  name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`,
                  proxyUrl: `/api/tif?key=${encodeURIComponent(pickedTif.key!)}`,
                  type: "raster",
                  bbox: [594885, 1052655, 688485, 1117455],
                  nodata: -9999,
                };
                // Notify actual slot loaded (for timeline sync on first apply)
                if (isFirstApply && timeLabel !== (timeSlot ?? "00-00") && isActive) {
                  onActualSlot?.(bestDate.replace(/\//g, "-"), timeLabel);
                }
                firstApplyKeysRef.current.delete(dsKey);
                rasterFound = true;
                break;
              }
            }
          } catch (e) {
            console.warn("[useS3DatasetLayers] error", prefix, e);
          }
        }

        if (!isActive) break;
        if (isVector && !foundKey) { showNotification(`No vector data found for "${catName}" on ${dateStr}`, "error"); continue; }
        if (!isVector && !rasterFound) { if (timelineDate) showNotification(`No raster data found for "${catName}" on ${dateStr}`, "info"); continue; }
        if (isVector) {
          additions[dsKey] = {
            name: parent ? `${parent.name} - ${catName}` : catName,
            proxyUrl: `/api/tif?key=${encodeURIComponent(foundKey!)}`,
            type: "vector",
            ext: "." + (foundKey!.split(".").pop() || "").toLowerCase(),
            vdcUrl: vdcKey ? `/api/tif?key=${encodeURIComponent(vdcKey)}` : undefined,
          };
        }
      }

      if (!isActive) return;

      if (Object.keys(additions).length > 0) {
        layersCacheRef.current[dateStr] = { ...(layersCacheRef.current[dateStr] ?? {}), ...additions };
      }
      activeDateRef.current = dateStr;

      setRenderedLayers(prev2 => {
        const next2: Record<string, RenderedLayer> = {};
        const newPrefixes = new Set(Object.keys(additions).map(k => k.split("__")[0]));
        for (const [k, v] of Object.entries(prev2)) {
          const p = k.split("__")[0];
          if (!newPrefixes.has(p) && next.has(p)) next2[k] = v;
        }
        for (const [k, v] of Object.entries(additions)) next2[k] = v;
        return next2;
      });
    })();

    return () => { isActive = false; };
  }, [appliedDatasets, timelineDate, timeSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Preload adjacent dates in background ──
  useEffect(() => {
    if (!allTimelineDates?.length || !appliedDatasets?.length) return;

    const idx = timelineDate ? allTimelineDates.indexOf(timelineDate) : -1;
    const nearby = allTimelineDates.filter((_, i) => idx >= 0 && Math.abs(i - idx) <= 2 && i !== idx);
    const uniqueDates = [...new Set([...(prefetchDate ? [prefetchDate] : []), ...nearby])];
    let cancelled = false;

    void (async () => {
      for (const dateStr of uniqueDates) {
        if (cancelled) break;
        if (layersCacheRef.current[dateStr]) continue;

        const [y, m, d] = dateStr.split("-").map(Number);
        const md = String(m).padStart(2, "0");
        const dd = String(d).padStart(2, "0");

        for (const ds of appliedDatasets) {
          if (cancelled) break;
          const dsKey = `${ds.id}-${ds.type}`;
          if (layersCacheRef.current[dateStr]?.[dsKey]) continue;

          const dsInfo = getDatasetById(ds.id);
          const parent = getParentDataset(ds.id);
          if (dsInfo?.gisData === false || parent?.gisData === false) continue;

          let datasetId: string, categorySlug: string;
          if (parent) {
            datasetId = parent.id; categorySlug = getDatasetSlug(ds.id) || ds.id;
          } else if (dsInfo?.children?.length) {
            datasetId = ds.id; categorySlug = getDatasetSlug(dsInfo.children[0].id) || dsInfo.children[0].id;
          } else {
            datasetId = ds.id; categorySlug = "default";
          }

          const dsSlug = getDatasetSlug(datasetId) || datasetId;
          const basePrefix = `gis-data/${dsSlug}/${categorySlug}/`;

          for (const prefix of [`${basePrefix}${y}/${md}/${dd}/`, `${basePrefix}${y}/${md}/`]) {
            if (cancelled) break;
            try {
              const allFiles = await listS3Files(prefix);
              if (cancelled) break;
              const files = [...allFiles].sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));
              const dateOf = (key: string) => { const m2 = key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//); return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : ""; };

              if (ds.type === "vector") {
                const vFile = files.find(f => (f.key?.toLowerCase() ?? "").endsWith(".vct"));
                if (vFile) {
                  const ext = "." + (vFile.key!.split(".").pop() || "").toLowerCase();
                  const baseLower = vFile.key!.replace(/\.\w+$/, "").toLowerCase();
                  const vdcFile = files.find(f => f.key?.toLowerCase() === baseLower + ".vdc");
                  const cache = layersCacheRef.current[dateStr] ?? {};
                  cache[dsKey] = { name: parent?.name || dsInfo?.name || ds.id, proxyUrl: `/api/tif?key=${encodeURIComponent(vFile.key!)}`, type: "vector", ext, vdcUrl: vdcFile ? `/api/tif?key=${encodeURIComponent(vdcFile.key!)}` : undefined };
                  layersCacheRef.current[dateStr] = cache;
                  break;
                }
              } else {
                const allTifs = files.filter(f => f.key?.match(/\.tiff?$/i));
                const target = `${y}/${md}/${dd}`;
                const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === target);
                if (tifsForDate.length > 0) {
                  const catName = parent?.name || dsInfo?.name || ds.id;
                  const cache = layersCacheRef.current[dateStr] ?? {};
                  for (const tif of tifsForDate) {
                    const timeMatch = tif.key!.match(/\/(\d{2}-\d{2})\//);
                    const timeLabel = timeMatch ? timeMatch[1] : "00-00";
                    const key = `${dsKey}__${dateStr}__${timeLabel}`;
                    cache[key] = { name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`, proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`, type: "raster", bbox: [594885, 1052655, 688485, 1117455], nodata: -9999 };
                  }
                  layersCacheRef.current[dateStr] = cache;
                  break;
                }
              }
            } catch { /* silently ignore */ }
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [timelineDate, prefetchDate, allTimelineDates, appliedDatasets]); // eslint-disable-line react-hooks/exhaustive-deps

  const layerRefs = useS3LayerRenderer(renderedLayers, mapRef, prebuiltLayersRef, activeDateRef);
  return { renderedLayers, layerRefs, layersCacheRef: layersCacheRef as React.MutableRefObject<Record<string, Record<string, RenderedLayer>>> };
}
