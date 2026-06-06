"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
      0.06, [0, 0, 255, 1],
      5,    [0, 255, 255, 1],
      10,   [0, 255, 0, 1],
      15,   [255, 255, 0, 1],
      20,   [255, 165, 0, 1],
      21,   [255, 0, 0, 1],
    ],
  ],
};

type FrameKey = string; // `${dsKey}__${date}__${slot}`

/**
 * Timelapse mode: preloads ALL frames as hidden WebGL layers.
 * Frame switch = setVisible() only — zero fetch latency during playback.
 */
export function useTimelapseLayer(
  appliedDatasets: Array<{ id: string; type: string }> | undefined,
  mapRef: React.MutableRefObject<OLMap | null>,
  timelineDate?: string,
  timeSlot?: string,
  allTimelineDates?: string[],
  onActualSlot?: (date: string, slot: string) => void,
) {
  const poolRef = useRef<Map<FrameKey, { layer: WebGLTileLayer; ready: boolean }>>(new Map());
  const activeKeyRef = useRef<FrameKey | null>(null);
  const layerRefs = useRef<Record<string, WebGLTileLayer | VectorLayer>>({});
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const prevDsRef = useRef("");
  const fittedRef = useRef(false);

  const showFrame = useCallback((key: FrameKey | null) => {
    for (const [k, f] of poolRef.current) {
      f.layer.setVisible(k === key);
    }
    activeKeyRef.current = key;
  }, []);

  // ── Preload all frames across all dates ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !appliedDatasets?.length || !allTimelineDates?.length) return;

    const dsStr = appliedDatasets.map(d => `${d.id}-${d.type}`).join(",");
    if (dsStr !== prevDsRef.current) {
      prevDsRef.current = dsStr;
      fittedRef.current = false;
      for (const { layer } of poolRef.current.values()) {
        map.removeLayer(layer);
        layer.getSource()?.dispose?.();
      }
      poolRef.current.clear();
      layerRefs.current = {};
      activeKeyRef.current = null;
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

          const dsSlug = getDatasetSlug(datasetId) || datasetId;
          const catName = dsInfo?.name || ds.id;
          const prefix = `gis-data/${dsSlug}/${catSlug}/${y}/${md}/${dd}/`;

          try {
            const files = await listS3Files(prefix);
            if (cancelled) break;
            const dateOf = (k: string) => { const m2 = k.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//); return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : ""; };
            const tifs = files.filter(f => f.key?.match(/\.tiff?$/i) && dateOf(f.key) === `${y}/${md}/${dd}`);

            for (const tif of tifs) {
              if (cancelled) break;
              const tm = tif.key!.match(/\/(\d{2}-\d{2})\//);
              const slot = tm ? tm[1] : "00-00";
              const frameKey: FrameKey = `${dsKey}__${dateStr}__${slot}`;
              if (poolRef.current.has(frameKey)) continue;

              const proxyUrl = `/api/tif?key=${encodeURIComponent(tif.key!)}`;
              const absUrl = `${window.location.origin}${proxyUrl}`;
              const source = new GeoTIFF({
                sources: [{ url: absUrl, nodata: -9999 }],
                convertToRGB: false, normalize: false, interpolate: false,
                projection: "EPSG:32648",
              });
              const layer = new WebGLTileLayer({ source, opacity: 0.7, visible: false, style: RASTER_STYLE });
              layer.setZIndex(110);
              map.addLayer(layer);

              const entry = { layer, ready: false };
              poolRef.current.set(frameKey, entry);
              layerRefs.current[frameKey] = layer;

              source.once("change", () => {
                if (source.getState() !== "ready") return;
                entry.ready = true;
                if (!fittedRef.current && mapRef.current) {
                  fittedRef.current = true;
                  source.getView().then(vo => {
                    if (!mapRef.current || !vo.extent || !vo.projection) return;
                    const proj = typeof vo.projection === "string" ? vo.projection : vo.projection.getCode();
                    mapRef.current.getView().fit(transformExtent(vo.extent, proj, "EPSG:3857"), {
                      padding: [48, 48, 48, 48], duration: 300, maxZoom: 15,
                    });
                  }).catch(() => {});
                }
                if (frameKey === activeKeyRef.current) layer.setVisible(true);
              });
              source.refresh();

              setRenderedLayers(prev => ({
                ...prev,
                [frameKey]: {
                  name: parent ? `${parent.name} - ${catName} (${slot})` : `${catName} (${slot})`,
                  proxyUrl, type: "raster",
                  bbox: [594885, 1052655, 688485, 1117455], nodata: -9999,
                },
              }));
            }
          } catch { /* silently ignore */ }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [appliedDatasets, allTimelineDates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch frame on date/slot change ──
  useEffect(() => {
    if (!appliedDatasets?.length || !timelineDate || !timeSlot) return;

    for (const ds of appliedDatasets) {
      if (ds.type !== "raster") continue;
      const dsKey = `${ds.id}-${ds.type}`;
      const frameKey: FrameKey = `${dsKey}__${timelineDate}__${timeSlot}`;

      if (poolRef.current.has(frameKey)) {
        showFrame(frameKey);
        setRenderedLayers(prev => {
          const entry = prev[frameKey];
          return entry ? { [frameKey]: entry } : prev;
        });
      } else {
        // Not yet preloaded — show nearest available slot on this date
        const prefix = `${dsKey}__${timelineDate}__`;
        const available = [...poolRef.current.keys()].filter(k => k.startsWith(prefix));
        if (available.length > 0) {
          const slotNum = parseInt(timeSlot.replace("-", ""), 10);
          const nearest = available.reduce((best, k) => {
            const diff = Math.abs(parseInt(k.slice(-5).replace("-", ""), 10) - slotNum);
            return diff < Math.abs(parseInt(best.slice(-5).replace("-", ""), 10) - slotNum) ? k : best;
          });
          showFrame(nearest);
          const actualSlot = nearest.slice(-5);
          if (actualSlot !== timeSlot) onActualSlot?.(timelineDate, actualSlot);
        } else {
          showFrame(null);
        }
      }
    }
  }, [timelineDate, timeSlot, appliedDatasets, showFrame, onActualSlot]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const map = mapRef.current;
      for (const { layer } of poolRef.current.values()) {
        map?.removeLayer(layer);
        layer.getSource()?.dispose?.();
      }
      poolRef.current.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    renderedLayers, layerRefs,
    layersCacheRef: { current: {} } as React.MutableRefObject<Record<string, Record<string, RenderedLayer>>>,
  };
}