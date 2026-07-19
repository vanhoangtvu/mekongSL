"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type OLMap from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import { getDatasetSlug, getParentDataset, getDatasetById, getRootDataset } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import { showNotification } from "../../lib/notification";
import { useS3LayerRenderer } from "./useS3LayerRenderer";

export type RenderedLayer = {
  name: string;
  proxyUrl: string;
  s3Key?: string;
  type: "raster";
  bbox: [number, number, number, number];
  nodata: number;
} | {
  name: string;
  proxyUrl: string;
  s3Key?: string;
  type: "vector";
  ext: string;
  vdcUrl?: string;
  dbfUrl?: string;
};

function getPrefix(key: string) { return key.split("__")[0]; }

function buildAncestorSlugPath(dsId: string, rootId: string): string {
  const idChain: string[] = [];
  let current = getDatasetById(dsId);
  while (current && current.id !== rootId) {
    idChain.unshift(current.id);
    const parent = getParentDataset(current.id);
    if (!parent) break;
    current = parent;
  }
  const slugParts = idChain.map(id => getDatasetSlug(id) || id.split('/').pop() || id);
  return slugParts.join('/');
}

/**
 * Multi-layer timelapse mode: manages a per-date frame cache, preloads adjacent dates,
 * and delegates all OL rendering to useS3LayerRenderer.
 */
export function useS3DatasetLayers(
  appliedDatasets: Array<{ id: string; type: string }> | undefined,
  mapRef: React.MutableRefObject<OLMap | null>,
  timelineDate?: string,
  timeSlot?: string,
  prefetchDate?: string,
  allTimelineDates?: string[],
  onActualSlot?: (date: string, slot: string) => void,
  renderedLayersOverride?: Record<string, RenderedLayer>,
) {
  const prevDateRef = useRef<string | undefined>(undefined);
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const layersCacheRef = useRef<Record<string, Record<string, RenderedLayer>>>({});
  const prebuiltLayersRef = useRef<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>({});
  const activeDateRef = useRef<string>("");
  const sourceCacheRef = useRef<Map<string, { source: import("ol/source/GeoTIFF").default; ready: boolean }>>(new Map());
  // Track which dataset keys are being applied for the first time (fresh apply, not re-apply)
  const firstApplyKeysRef = useRef<Set<string>>(new Set());
  // Loading status per dataset key: "listing" → "rendering" → "ready"
  const [loadingStatus, setLoadingStatus] = useState<Record<string, "listing" | "rendering" | "ready">>({});

  const handleLayerReady = useCallback((fullKey: string) => {
    const prefix = getPrefix(fullKey);
    setLoadingStatus(prev => {
      if (prev[prefix] !== "rendering") return prev;
      return { ...prev, [prefix]: "ready" };
    });
  }, []);

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

    // When removing: clear cache + prebuilt layers + firstApply flag + loading status for removed datasets
    if (toRemove.length > 0) {
      setRenderedLayers(prev2 => {
        const next2 = { ...prev2 };
        for (const k of toRemove) delete next2[k];
        return next2;
      });
      setLoadingStatus(prev => {
        const next2 = { ...prev };
        for (const rp of toRemove.map(getPrefix)) delete next2[rp];
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

    // Slot/date changed → check cache for closest slot match for each dataset
    if (dateChanged || (timeSlot && prevKeys.length > 0)) {
      const cached = layersCacheRef.current[dateStr];
      if (cached) {
        activeDateRef.current = dateStr;
        const exact: Record<string, RenderedLayer> = {};
        const dsPrefixes = [...next];
        
        for (const prefix of dsPrefixes) {
          // 1. Try exact match first
          const exactKey = timeSlot ? `${prefix}__${dateStr}__${timeSlot}` : null;
          if (exactKey && cached[exactKey]) {
            exact[exactKey] = cached[exactKey];
            continue;
          }
          
          // 2. Fallback to closest slot in the same day
          const availKeys = Object.keys(cached).filter(k => k.startsWith(`${prefix}__`));
          if (availKeys.length > 0) {
            if (!timeSlot) {
              // No timeSlot, just take the first one (usually 00-00)
              exact[availKeys[0]] = cached[availKeys[0]];
            } else {
              const targetMinutes = parseInt(timeSlot.split("-")[0]) * 60 + parseInt(timeSlot.split("-")[1]);
              let bestKey = availKeys[0];
              let minDiff = Infinity;
              
              for (const k of availKeys) {
                const slotMatch = k.match(/__(\d{2}-\d{2})$/);
                if (slotMatch) {
                  const [hh, mm] = slotMatch[1].split("-").map(Number);
                  const diff = Math.abs((hh * 60 + mm) - targetMinutes);
                  if (diff < minDiff) {
                    minDiff = diff;
                    bestKey = k;
                  }
                }
              }
              exact[bestKey] = cached[bestKey];
            }
          }
        }

        if (Object.keys(exact).length > 0) {
          setRenderedLayers(exact);
          const foundPrefixes = new Set(Object.keys(exact).map(k => k.split("__")[0]));
          // Cached data needs rendering on map, so set to "rendering"
          setLoadingStatus(prev => {
            const next2 = { ...prev };
            for (const p of foundPrefixes) {
              if (next2[p] === "listing") next2[p] = "rendering";
            }
            return next2;
          });
          // If we have all requested datasets represented, we can skip fetching
          if (dsPrefixes.every(p => foundPrefixes.has(p))) return;
        }
      }
    }

    const toAdd = dateChanged
      ? [...next]
      : [...next].filter(key => !prev.has(key));

    if (toAdd.length === 0) return;

    // Mark all new datasets as "listing"
    setLoadingStatus(prev => {
      const next2 = { ...prev };
      for (const k of toAdd) next2[k] = "listing";
      return next2;
    });

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
        if (dsId === "wq-surface" || dsId === "wq-ground" || dsId === "weather") {
          // Skip datasets that don't need S3 loading — mark ready immediately
          setLoadingStatus(prev => ({ ...prev, [dsKey]: "ready" }));
          continue;
        }

        const parent = getParentDataset(dsId);
        const dsInfo = getDatasetById(dsId);
        const root = getRootDataset(dsId);
        
        // Root is the top-level dataset (e.g. 'baseline-environment')
        // Parent is the immediate parent (e.g. 'landuse-classification')
        // dsId is the current selection (e.g. 'landuse-classification/rice-shrimp')
        
        // Only Channel System uses hierarchical S3 path (parent/child slugs)
        const needsHierarchicalPath = dsId.startsWith('channel-system/');

        let datasetSlug: string, categorySlug: string;

        if (root && root.id !== dsId) {
          datasetSlug = getDatasetSlug(root.id) || root.id;
          const rootPrefix = root.id + "/";
          let relativePath = dsId.startsWith(rootPrefix) ? dsId.slice(rootPrefix.length) : dsId;

          if (needsHierarchicalPath && parent) {
            relativePath = buildAncestorSlugPath(dsId, root.id);
          } else if (relativePath === dsId && parent) {
            const parentSlug = getDatasetSlug(parent.id);
            const leafSlug = getDatasetSlug(dsId) || dsId.split('/').pop() || dsId;
            relativePath = parentSlug ? `${parentSlug}/${leafSlug}` : leafSlug;
          }
          categorySlug = relativePath;
        } else if (parent) {
          datasetSlug = getDatasetSlug(parent.id) || parent.id;
          const parentPrefix = parent.id + "/";
          let relativePath = dsId.startsWith(parentPrefix) ? dsId.slice(parentPrefix.length) : dsId;
          if (relativePath === dsId) {
            relativePath = getDatasetSlug(dsId) || dsId;
          }
          categorySlug = relativePath;
        } else {
          datasetSlug = getDatasetSlug(dsId) || dsId;
          categorySlug = datasetSlug;
        }

        const catName = dsInfo?.name || dsId;
        const basePrefix = `gis-data/${datasetSlug}/${categorySlug}/`;

        // Fallback paths for backward compatibility
        const allBasePrefixes: string[] = [basePrefix];
        
        // For Landuse Classification, also search COG-optimized path first
        const isLanduseClass = dsId.startsWith("landuse-classification/");
        if (isLanduseClass) {
          const cogPrefix = basePrefix.replace("gis-data/", "gis-data/cog/");
          allBasePrefixes.unshift(cogPrefix);
        }
        
        const leafSlug2 = getDatasetSlug(dsId) || dsId.split('/').pop() || dsId;
        if (leafSlug2 && leafSlug2 !== categorySlug) {
          allBasePrefixes.push(`gis-data/${datasetSlug}/${leafSlug2}/`);
        }
        const parentSlug = parent ? getDatasetSlug(parent.id) : null;
        const hierSlug = parentSlug ? `${parentSlug}/${leafSlug2}` : null;
        if (hierSlug && hierSlug !== categorySlug) {
          allBasePrefixes.push(`gis-data/${datasetSlug}/${hierSlug}/`);
        }

        // Check if this is Landsat or Baseline (only use year, ignore month/day)
        const rootId = root?.id ?? "";
        const isLandsat = rootId === "landsat" || dsId.startsWith("landsat") || dsId.startsWith("band-") || dsId === "rgb";
        const isBaseline = rootId === "baseline" || dsId.startsWith("baseline") || 
                          dsId.startsWith("channel-") || dsId.startsWith("landuse-") ||
                          dsId.startsWith("admin-") || dsId.startsWith("waterbody") ||
                          dsId.startsWith("soil") || dsId.startsWith("road") ||
                          dsId.startsWith("groundwater");
        const isFlooding = rootId === "flooding" || dsId.startsWith("flooding");
        const yearOnly = isLandsat || isBaseline || isFlooding;
        
        // For yearOnly datasets: use year only. For others: use full date path (always use current date if no timelineDate)
        const searchYear = timelineDate ? y : new Date().getFullYear();
        const searchMd = String(m).padStart(2, "0");
        const searchDd = String(d).padStart(2, "0");

        // Build search prefixes for all base paths (primary + fallbacks)
        const prefixes = allBasePrefixes.flatMap(bp =>
          yearOnly
            ? [`${bp}${searchYear}/`, bp]
            : (timelineDate
                ? [`${bp}${y}/${md}/${dd}/`, `${bp}${y}/${md}/`, `${bp}${y}/`, bp]
                : [`${bp}${searchYear}/${searchMd}/${searchDd}/`, `${bp}${searchYear}/${searchMd}/`, `${bp}${searchYear}/`, bp])
        );

        let foundKey: string | null = null;
        let vdcKey: string | null = null;
        let dbfKey: string | null = null;
        let rasterFound = false;

        for (const prefix of prefixes) {
          if (!isActive) break;
          try {
            const { files: allFiles } = await listS3Files(prefix);
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
                const dbf = files.find(f => f.key?.toLowerCase().endsWith(".dbf"));
                if (dbf) dbfKey = dbf.key!;
                break;
              }
            } else {
              const allTifs = files.filter(f => f.key?.match(/\.tiff?$/i));
              if (!allTifs.length) continue;
              
              // For Landsat/Baseline: extract year only. For others: extract full date
              const yearOf = (key: string) => { const m = key.match(/\/(\d{4})\//); return m ? m[1] : ""; };
              const dateOf = (key: string) => { const m = key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//); return m ? `${m[1]}/${m[2]}/${m[3]}` : ""; };
              
              if (yearOnly) {
                // Landsat/Baseline: filter by year only
                const targetYear = String(searchYear);
                const uniqueYears = [...new Set(allTifs.map(f => yearOf(f.key ?? "")))].filter(Boolean).sort();
                const exactMatch = uniqueYears.find(y => y === targetYear);
                
                if (exactMatch) {
                  const tifsForYear = allTifs.filter(f => yearOf(f.key ?? "") === exactMatch);
                  const pickedTif = tifsForYear[0];
                  if (pickedTif) {
                    const frameKey = `${dsKey}__${exactMatch}__00-00`;
                    additions[frameKey] = {
                      name: parent ? `${parent.name} - ${catName} (${exactMatch})` : `${catName} (${exactMatch})`,
                      proxyUrl: `/api/tif?key=${encodeURIComponent(pickedTif.key!)}`,
                      s3Key: pickedTif.key!,
                      type: "raster",
                      bbox: [594885, 1052655, 688485, 1117455],
                      nodata: -9999,
                    };
                    rasterFound = true;
                    firstApplyKeysRef.current.delete(dsKey);
                    break;
                  }
                }
                
                // First load: fall back to nearest year ≤ target
                if (firstApplyKeysRef.current.has(dsKey)) {
                  const lte = timelineDate ? uniqueYears.filter(y2 => y2 <= targetYear) : uniqueYears;
                  if (!lte.length) {
                    if (isActive) showNotification(`No data for "${catName}" in year ${searchYear}`, "info");
                    break;
                  }
                  const bestYear = lte[lte.length - 1];
                  const tifsForYear = allTifs.filter(f => yearOf(f.key ?? "") === bestYear);
                  const pickedTif = tifsForYear[0];
                  if (pickedTif) {
                    const frameKey = `${dsKey}__${bestYear}__00-00`;
                    additions[frameKey] = {
                      name: parent ? `${parent.name} - ${catName} (${bestYear})` : `${catName} (${bestYear})`,
                      proxyUrl: `/api/tif?key=${encodeURIComponent(pickedTif.key!)}`,
                      s3Key: pickedTif.key!,
                      type: "raster",
                      bbox: [594885, 1052655, 688485, 1117455],
                      nodata: -9999,
                    };
                    rasterFound = true;
                    firstApplyKeysRef.current.delete(dsKey);
                    break;
                  }
                }
                
                // User dragged to a year with no data
                if (isActive) showNotification(`No data for "${catName}" in year ${searchYear}`, "info");
                break;
              } else {
                // Non-Landsat: filter by full date
                const targetDateStr = `${y}/${md}/${dd}`;
                const uniqueDates = [...new Set(allTifs.map(f => dateOf(f.key ?? "")))].filter(Boolean).sort();

                const lte = timelineDate ? uniqueDates.filter(d2 => d2 <= targetDateStr) : uniqueDates;
                if (!lte.length) {
                  if (isActive && timelineDate) showNotification(`No raster data for "${catName}" before ${dateStr}`, "info");
                  break;
                }
                const bestDate = lte[lte.length - 1];
                const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === bestDate);

                // Get all available slots for this date
                const allSlotsForDate = [...new Set(tifsForDate.map(f => {
                  const m = f.key?.match(/\/(\d{2}-\d{2})\//);
                  return m ? m[1] : "00-00";
                }))].sort();

                // Cache only nearby slots (±3 around target) instead of ALL slots
                const targetSlot = timeSlot || "00-00";
                const targetIdx = allSlotsForDate.indexOf(targetSlot);
                const nearbySlots = targetIdx >= 0
                  ? allSlotsForDate.slice(Math.max(0, targetIdx - 3), targetIdx + 4)
                  : allSlotsForDate.slice(0, 7);

                let firstSlotKey: string | null = null;
                for (const slot of nearbySlots) {
                  const pickedTif = tifsForDate.find(f => f.key?.includes(`/${slot}/`));
                  if (pickedTif) {
                    const frameKey = `${dsKey}__${bestDate.replace(/\//g, "-")}__${slot}`;
                    if (!layersCacheRef.current[bestDate.replace(/\//g, "-")]) {
                      layersCacheRef.current[bestDate.replace(/\//g, "-")] = {};
                    }
                    layersCacheRef.current[bestDate.replace(/\//g, "-")][frameKey] = {
                      name: parent ? `${parent.name} - ${catName} (${slot})` : `${catName} (${slot})`,
                      proxyUrl: `/api/tif?key=${encodeURIComponent(pickedTif.key!)}`,
                      s3Key: pickedTif.key!,
                      type: "raster",
                      bbox: [594885, 1052655, 688485, 1117455],
                      nodata: -9999,
                    };
                    
                    if (!firstSlotKey) {
                      firstSlotKey = frameKey;
                      rasterFound = true;
                      additions[frameKey] = layersCacheRef.current[bestDate.replace(/\//g, "-")][frameKey];
                    }
                  }
                }

                // If a specific timeSlot was requested, find the closest cached slot
                if (firstSlotKey && timeSlot) {
                  const targetMinutes = parseInt(timeSlot.split("-")[0]) * 60 + parseInt(timeSlot.split("-")[1]);
                  let bestKey = firstSlotKey;
                  let minDiff = Infinity;
                  
                  const cacheForDate = layersCacheRef.current[bestDate.replace(/\//g, "-")];
                  const availKeys = Object.keys(cacheForDate).filter(k => k.startsWith(`${dsKey}__`));
                  
                  for (const k of availKeys) {
                    const slotMatch = k.match(/__(\d{2}-\d{2})$/);
                    if (slotMatch) {
                      const [hh, mm] = slotMatch[1].split("-").map(Number);
                      const diff = Math.abs((hh * 60 + mm) - targetMinutes);
                      if (diff < minDiff) {
                        minDiff = diff;
                        bestKey = k;
                      }
                    }
                  }
                  
                  if (bestKey !== firstSlotKey) {
                    delete additions[firstSlotKey];
                    additions[bestKey] = cacheForDate[bestKey];
                  }
                }
                
                break;
              }
            }
          } catch (e) {
            console.warn("[useS3DatasetLayers] error", prefix, e);
          }
        }

        if (!isActive) break;
        if (isVector && !foundKey) {
          showNotification(`No vector data found for "${catName}" on ${dateStr}`, "error");
          setLoadingStatus(prev => ({ ...prev, [dsKey]: "ready" }));
          continue;
        }
        if (!isVector && !rasterFound) {
          if (timelineDate) showNotification(`No raster data found for "${catName}" on ${dateStr}`, "info");
          setLoadingStatus(prev => ({ ...prev, [dsKey]: "ready" }));
          continue;
        }
          if (isVector) {
            additions[dsKey] = {
              name: parent ? `${parent.name} - ${catName}` : catName,
              proxyUrl: `/api/tif?key=${encodeURIComponent(foundKey!)}`,
              s3Key: foundKey!,
              type: "vector",
              ext: "." + (foundKey!.split(".").pop() || "").toLowerCase(),
              vdcUrl: vdcKey ? `/api/tif?key=${encodeURIComponent(vdcKey)}` : undefined,
              dbfUrl: dbfKey ? `/api/tif?key=${encodeURIComponent(dbfKey)}` : undefined,
            };
          }
          // Per-dataset: immediately mark "rendering" right after this dataset's data is found
          setLoadingStatus(prev => ({ ...prev, [dsKey]: "rendering" }));
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
    const nearby = allTimelineDates.filter((_, i) => idx >= 0 && Math.abs(i - idx) <= 7 && i !== idx);
    const uniqueDates = [...new Set([...(prefetchDate ? [prefetchDate] : []), ...nearby])];
    let cancelled = false;

    void (async () => {
      for (const dateStr of uniqueDates) {
        if (cancelled) break;
        // Don't skip the entire day, only individual datasets inside the loop

        const [y, m, d] = dateStr.split("-").map(Number);
        const md = String(m).padStart(2, "0");
        const dd = String(d).padStart(2, "0");

        for (const ds of appliedDatasets) {
          if (cancelled) break;
          const dsKey = `${ds.id}-${ds.type}`;
          
          if (ds.id === "weather") continue; // Skip weather S3 preloading

          // Check if this specific dataset for this specific day is already cached
          if (layersCacheRef.current[dateStr] && 
              Object.keys(layersCacheRef.current[dateStr]).some(k => k.startsWith(dsKey + "__"))) {
            continue;
          }

          const dsInfo = getDatasetById(ds.id);
          const parent = getParentDataset(ds.id);
          const root = getRootDataset(ds.id);
          if (dsInfo?.gisData === false || parent?.gisData === false) continue;

          // Skip preload for Landsat and Baseline (uses year only)
          const rootId = root?.id ?? "";
          const isLandsat = rootId === "landsat" || ds.id.startsWith("landsat") || ds.id.startsWith("band-") || ds.id === "rgb";
          const isBaseline = rootId === "baseline" || ds.id.startsWith("baseline") || 
                            ds.id.startsWith("channel-") || ds.id.startsWith("landuse-") ||
                            ds.id.startsWith("admin-") || ds.id.startsWith("waterbody") ||
                            ds.id.startsWith("soil") || ds.id.startsWith("road") ||
                            ds.id.startsWith("groundwater");
          const isFlooding = rootId === "flooding" || ds.id.startsWith("flooding");
          if (isLandsat || isBaseline || isFlooding) continue;

          let datasetSlug: string, categorySlug: string;
          if (root && root.id !== ds.id) {
            datasetSlug = getDatasetSlug(root.id) || root.id;
            categorySlug = buildAncestorSlugPath(ds.id, root.id);
          } else if (parent) {
            datasetSlug = getDatasetSlug(parent.id) || parent.id;
            categorySlug = buildAncestorSlugPath(ds.id, parent.id);
          } else {
            datasetSlug = getDatasetSlug(ds.id) || ds.id;
            categorySlug = datasetSlug;
          }

          const basePrefix = `gis-data/${datasetSlug}/${categorySlug}/`;

          for (const prefix of [`${basePrefix}${y}/${md}/${dd}/`, `${basePrefix}${y}/${md}/`]) {
            if (cancelled) break;
            try {
              const { files: allFiles } = await listS3Files(prefix);
              if (cancelled) break;
              const files = [...allFiles].sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));


              const dateOf = (key: string) => { const m2 = key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//); return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : ""; };

              if (ds.type === "vector") {
                const vFile = files.find(f => (f.key?.toLowerCase() ?? "").endsWith(".vct"));
                if (vFile) {
                  const ext = "." + (vFile.key!.split(".").pop() || "").toLowerCase();
                  const baseLower = vFile.key!.replace(/\.\w+$/, "").toLowerCase();
                  const vdcFile = files.find(f => f.key?.toLowerCase() === baseLower + ".vdc");
                  const dbfFile = files.find(f => f.key?.toLowerCase().endsWith(".dbf"));
                  const cache = layersCacheRef.current[dateStr] ?? {};
                  cache[dsKey] = { name: parent?.name || dsInfo?.name || ds.id, proxyUrl: `/api/tif?key=${encodeURIComponent(vFile.key!)}`, s3Key: vFile.key!, type: "vector", ext, vdcUrl: vdcFile ? `/api/tif?key=${encodeURIComponent(vdcFile.key!)}` : undefined, dbfUrl: dbfFile ? `/api/tif?key=${encodeURIComponent(dbfFile.key!)}` : undefined };
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
                    cache[key] = { name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`, proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`, s3Key: tif.key!, type: "raster", bbox: [594885, 1052655, 688485, 1117455], nodata: -9999 };
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
  }, [timelineDate, prefetchDate, allTimelineDates, appliedDatasets]);

  const layerRefs = useS3LayerRenderer(
    renderedLayersOverride || renderedLayers,
    mapRef,
    prebuiltLayersRef,
    activeDateRef,
    sourceCacheRef,
    renderedLayersOverride ? 1 : undefined,
    handleLayerReady,
  );
  return { 
    renderedLayers, 
    layerRefs, 
    layersCacheRef: layersCacheRef as React.MutableRefObject<Record<string, Record<string, RenderedLayer>>>,
    prebuiltLayersRef,
    activeDateRef,
    sourceCacheRef,
    loadingStatus,
  };
}
