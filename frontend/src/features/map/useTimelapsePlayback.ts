"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type OLMap from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFF from "ol/source/GeoTIFF";
import { getRasterStyle } from "../../lib/constants/raster-colors";
import { getDatasetSlug, getParentDataset, getDatasetById, getRootDataset } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";

const OBS_HOURS = [0, 5, 10, 15, 20];
const FRAME_INTERVAL_MS = 500;
const PRELOAD_CONCURRENCY = 6;

type RLayer = {
  name: string;
  proxyUrl: string;
  type: "raster";
  bbox: [number, number, number, number];
  nodata: number;
};

type QueueItem = {
  label: string;
  layers: Record<string, RLayer>;
};

function getPrefix(key: string) { return key.split("__")[0]; }

export function useTimelapsePlayback(
  appliedDatasets: Array<{ id: string; type: string }> | undefined,
  mapRef: React.MutableRefObject<OLMap | null>,
  onCacheData?: (dateKey: string, layerKey: string, layer: RLayer) => void,
) {
  const [showPicker, setShowPicker] = useState(false);
  const [pbStartDate, setPbStartDate] = useState("");
  const [pbEndDate, setPbEndDate] = useState("");
  const [pbError, setPbError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [pbLoading, setPbLoading] = useState(false);
  const [pbProgressText, setPbProgressText] = useState("");
  const [playbackQueue, setPlaybackQueue] = useState<QueueItem[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  // Managed WebGL layers & preloaded source cache
  const playbackLayerRefs = useRef<Record<string, WebGLTileLayer>>({});
  const sourceCacheRef = useRef<Map<string, GeoTIFF>>(new Map());

  // Cleanup playback layers from map
  const removePlaybackLayers = useCallback(() => {
    const map = mapRef.current;
    for (const layer of Object.values(playbackLayerRefs.current)) {
      if (map) map.removeLayer(layer);
      try { layer.getSource()?.dispose?.(); } catch {}
    }
    playbackLayerRefs.current = {};
  }, [mapRef]);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || playbackQueue.length === 0) return;
    const interval = setInterval(() => {
      setPlaybackIndex(prev => {
        if (prev >= playbackQueue.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPlaying, playbackQueue.length]);

  // Swap sources when frame changes
  useEffect(() => {
    if (!isPlaying || playbackQueue.length === 0) return;
    const frame = playbackQueue[playbackIndex];
    if (!frame) return;

    for (const layerKey of Object.keys(frame.layers)) {
      const dsKey = getPrefix(layerKey);
      const layer = playbackLayerRefs.current[dsKey];
      const cachedSource = sourceCacheRef.current.get(layerKey);
      if (layer && cachedSource && layer.getSource() !== cachedSource) {
        layer.setOpacity(0);
        layer.setSource(cachedSource);
        layer.setOpacity(0.7);
      }
    }
  }, [playbackIndex, isPlaying, playbackQueue]);

  const openPicker = useCallback(() => {
    setPbStartDate("");
    setPbEndDate("");
    setPbError("");
    setShowPicker(true);
  }, []);

  const playPause = useCallback(() => {
    if (!isPlaying && playbackIndex >= playbackQueue.length - 1) {
      setPlaybackIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
    }
  }, [isPlaying, playbackIndex, playbackQueue.length]);

  const prevFrame = useCallback(() => {
    setPlaybackIndex(p => Math.max(0, p - 1));
  }, []);

  const nextFrame = useCallback(() => {
    setPlaybackIndex(p => Math.min(playbackQueue.length - 1, p + 1));
  }, [playbackQueue.length]);

  const seekTo = useCallback((idx: number) => {
    setPlaybackIndex(Math.max(0, Math.min(playbackQueue.length - 1, idx)));
  }, [playbackQueue.length]);

  const exitPlayback = useCallback(() => {
    for (const source of sourceCacheRef.current.values()) {
      try { source.dispose?.(); } catch {}
    }
    removePlaybackLayers();
    sourceCacheRef.current.clear();
    setPlaybackQueue([]);
    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [removePlaybackLayers]);

  const handleStartPlayback = useCallback(async () => {
    if (!pbStartDate || !pbEndDate) {
      setPbError("Please select both start and end date.");
      return;
    }
    const start = new Date(pbStartDate);
    const end = new Date(pbEndDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 7) {
      setPbError("Please select a range between 0 and 7 days.");
      return;
    }

    // Clean up any previous playback layers & cached sources
    for (const source of sourceCacheRef.current.values()) {
      try { source.dispose?.(); } catch {}
    }
    removePlaybackLayers();
    sourceCacheRef.current.clear();

    setShowPicker(false);
    setPbLoading(true);
    setPbError("");

    try {
      const activeDs = (appliedDatasets ?? []).filter(d => d.type === "raster");
      if (activeDs.length === 0) throw new Error("No active raster datasets selected.");

      const dates: string[] = [];
      const cur = new Date(pbStartDate);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }

      const frameMap: Record<string, Record<string, RLayer>> = {};

      const dateOf = (k: string) => {
        const mm = k.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        return mm ? `${mm[1]}/${mm[2]}/${mm[3]}` : "";
      };

      const monthGroups: Record<string, string[]> = {};
      for (const d of dates) {
        const mk = d.slice(0, 7);
        if (!monthGroups[mk]) monthGroups[mk] = [];
        monthGroups[mk].push(d);
      }

      for (const ds of activeDs) {
        const dsKey = `${ds.id}-${ds.type}`;
        const parent = getParentDataset(ds.id);
        const dsInfo = getDatasetById(ds.id);
        const root = getRootDataset(ds.id);
        const catName = dsInfo?.name || ds.id;

        let datasetSlug: string, categorySlug: string;
        if (root && root.id !== ds.id) {
          datasetSlug = getDatasetSlug(root.id) || root.id;
          const rel = ds.id.startsWith(root.id + "/") ? ds.id.slice(root.id.length + 1) : ds.id;
          categorySlug = getDatasetSlug(ds.id) || rel;
        } else if (parent) {
          datasetSlug = getDatasetSlug(parent.id) || parent.id;
          const rel = ds.id.startsWith(parent.id + "/") ? ds.id.slice(parent.id.length + 1) : ds.id;
          categorySlug = getDatasetSlug(ds.id) || rel;
        } else {
          datasetSlug = getDatasetSlug(ds.id) || ds.id;
          categorySlug = "default";
        }

        const basePrefix = `gis-data/${datasetSlug}/${categorySlug}/`;

        for (const [ym, ymDates] of Object.entries(monthGroups)) {
          const [y, m] = ym.split("-");
          const monthPrefix = `${basePrefix}${y}/${m}/`;
          setPbProgressText(`Fetching ${catName} ${ym}…`);

          let result;
          try { result = await listS3Files(monthPrefix); } catch { continue; }
          if (result._error) continue;

          const tifs = result.files.filter(f => f.key?.match(/\.tiff?$/i));
          const allDatesSet = new Set(ymDates);

          for (const tif of tifs) {
            const dPath = dateOf(tif.key!);
            if (!dPath) continue;
            const dateKey = dPath.replace(/\//g, "-");
            if (!allDatesSet.has(dateKey)) continue;
            const sm = tif.key!.match(/\/(\d{2}-\d{2})\//);
            const slot = sm ? sm[1] : "00-00";
            const frameKey = `${dateKey}__${slot}`;
            if (!frameMap[frameKey]) frameMap[frameKey] = {};
            const layerKey = `${dsKey}__${dateKey}__${slot}`;
            const layer: RLayer = {
              name: parent ? `${parent.name} - ${catName} (${slot})` : `${catName} (${slot})`,
              proxyUrl: `/api/tif?key=${encodeURIComponent(tif.key!)}`,
              type: "raster",
              bbox: [594885, 1052655, 688485, 1117455],
              nodata: -9999,
            };
            frameMap[frameKey][layerKey] = layer;
            onCacheData?.(dateKey, layerKey, layer);
          }
        }
      }

      const queue: QueueItem[] = [];
      for (const date of dates) {
        for (const h of OBS_HOURS) {
          const slot = `${String(h).padStart(2, "0")}-00`;
          const fk = `${date}__${slot}`;
          const layers = frameMap[fk];
          if (layers && Object.keys(layers).length > 0) {
            const hh = String(h).padStart(2, "0");
            const [, mm, dd] = date.split("-");
            queue.push({ label: `${Number(dd)}/${Number(mm)} ${hh}:00`, layers });
          }
        }
      }

      if (queue.length === 0) throw new Error("No data found in S3 for the selected range.");

      // Preload GeoTIFF sources with concurrency limit & render incrementally
      const allEntries = queue.flatMap(item => Object.entries(item.layers));
      setPbProgressText(`Loading ${allEntries.length} frames…`);
      let loaded = 0;
      let layersCreated = false;
      for (let i = 0; i < allEntries.length; i += PRELOAD_CONCURRENCY) {
        const batch = allEntries.slice(i, i + PRELOAD_CONCURRENCY);
        await Promise.all(batch.map(async ([layerKey, info]) => {
          if (sourceCacheRef.current.has(layerKey)) return;
          try {
            const url = info.proxyUrl.startsWith("http") ? info.proxyUrl : `${window.location.origin}${info.proxyUrl}`;
            const source = new GeoTIFF({
              sources: [{ url, nodata: (info as { nodata?: number }).nodata ?? -9999 }],
              convertToRGB: false, normalize: false, interpolate: false, projection: "EPSG:32648",
            });
            await source.getView();
            sourceCacheRef.current.set(layerKey, source);
          } catch { /* skip bad frame */ }
        }));
        loaded = Math.min(i + PRELOAD_CONCURRENCY, allEntries.length);
        setPbProgressText(`Loading (${loaded}/${allEntries.length})…`);

        // Render immediately after first batch — don't wait for all
        if (!layersCreated) {
          layersCreated = true;
          const map = mapRef.current;
          if (!map) continue;
          const firstFrame = queue[0];
          if (!firstFrame) continue;

          const dsStyleCache: Record<string, Record<string, unknown>> = {};
          for (const [layerKey, info] of Object.entries(firstFrame.layers)) {
            const dsKey = getPrefix(layerKey);
            if (playbackLayerRefs.current[dsKey]) continue;
            const source = sourceCacheRef.current.get(layerKey);
            if (!source) continue;

            if (!dsStyleCache[dsKey]) {
              const url = info.proxyUrl.startsWith("http") ? info.proxyUrl : `${window.location.origin}${info.proxyUrl}`;
              dsStyleCache[dsKey] = getRasterStyle(dsKey, url, info.nodata);
            }

            const layer = new WebGLTileLayer({
              opacity: 0.7,
              source,
              style: dsStyleCache[dsKey],
            });
            layer.setZIndex(500 + Object.keys(playbackLayerRefs.current).length);
            map.addLayer(layer);
            playbackLayerRefs.current[dsKey] = layer;
          }

          setPlaybackQueue(queue);
          setPlaybackIndex(0);
          setIsPlaying(true);
        }
      }
    } catch (err: unknown) {
      setPbError(err instanceof Error ? err.message : "Failed to start playback.");
    } finally {
      setPbLoading(false);
    }
  }, [pbStartDate, pbEndDate, appliedDatasets, onCacheData, mapRef, removePlaybackLayers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const source of sourceCacheRef.current.values()) {
        try { source.dispose?.(); } catch {}
      }
      removePlaybackLayers();
      sourceCacheRef.current.clear();
    };
  }, [removePlaybackLayers]);

  return {
    showPicker,
    setShowPicker,
    pbStartDate,
    setPbStartDate,
    pbEndDate,
    setPbEndDate,
    pbError,
    pbLoading,
    pbProgressText,
    isPlaying,
    playbackQueue,
    playbackIndex,
    openPicker,
    handleStartPlayback,
    playPause,
    prevFrame,
    nextFrame,
    seekTo,
    exitPlayback,
  };
}
