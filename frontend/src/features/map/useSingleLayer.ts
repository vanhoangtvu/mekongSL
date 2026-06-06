"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type Map from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import { getDatasetSlug, getParentDataset, getDatasetById } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import { showNotification } from "../../lib/notification";
import type { RenderedLayer } from "./useS3DatasetLayers";
import { useS3LayerRenderer } from "./useS3LayerRenderer";

/**
 * Single-layer viewer mode.
 * - On first apply (or re-apply): finds nearest available slot to requested timeSlot, calls onActualSlot to sync timeline
 * - On timeline drag: exact slot only — shows "no data" if not found, never fallbacks
 * - On any input change: clears previous layer immediately before fetching new one
 */
export function useSingleLayer(
  dataset: { id: string; type: string } | undefined,
  mapRef: React.MutableRefObject<Map | null>,
  timelineDate?: string,
  timeSlot?: string,
  onActualSlot?: (date: string, slot: string) => void,
) {
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const prebuiltLayersRef = useRef<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>({});
  const activeDateRef = useRef<string>("");

  // Track whether this is a fresh apply (dataset just added/re-added)
  const isFirstApplyRef = useRef(true);
  const prevDatasetKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const dsKey = dataset ? `${dataset.id}-${dataset.type}` : undefined;
    console.log("[useSingleLayer] trigger", { dataset, dsKey, timelineDate, timeSlot });

    // Dataset changed → mark as fresh apply
    if (dsKey !== prevDatasetKeyRef.current) {
      isFirstApplyRef.current = true;
      prevDatasetKeyRef.current = dsKey;
    }

    // Clear immediately on any change
    setRenderedLayers({});

    // Clear prebuilt OL layers
    prebuiltLayersRef.current = {};

    if (!dataset || !dsKey) return;

    const dsInfoCheck = getDatasetById(dataset.id);
    const parentCheck = getParentDataset(dataset.id);
    if (dsInfoCheck?.gisData === false || parentCheck?.gisData === false) return;
    if (dataset.id === "wq-surface" || dataset.id === "wq-ground") return;

    const parent = getParentDataset(dataset.id);
    const dsInfo = getDatasetById(dataset.id);

    let datasetId: string, categorySlug: string;
    if (parent) {
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
    const basePrefix = `gis-data/${dsSlug}/${categorySlug}/`;
    const prefixes = timelineDate
      ? [`${basePrefix}${y}/${md}/${dd}/`, `${basePrefix}${y}/${md}/`, `${basePrefix}${y}/`, basePrefix]
      : [basePrefix];

    const isFirstApply = isFirstApplyRef.current;
    let cancelled = false;

    void (async () => {
      const dateOf = (key: string) => {
        const m2 = key.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        return m2 ? `${m2[1]}/${m2[2]}/${m2[3]}` : "";
      };

      for (const prefix of prefixes) {
        if (cancelled) break;
        try {
          const allFiles = await listS3Files(prefix);
          if (cancelled) break;

          if (dataset.type === "vector") {
            const vFile = allFiles.find(f => (f.key?.toLowerCase() ?? "").endsWith(".vct"))
              ?? allFiles.find(f => [".geojson", ".kml", ".zip"].some(e => (f.key?.toLowerCase() ?? "").endsWith(e)));
            console.log("[useSingleLayer] vector search", { prefix, files: allFiles.length, vFile: vFile?.key });
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
            console.log("[useSingleLayer] vector renderedLayers set", dsKey);
            isFirstApplyRef.current = false;
            return;
          }

          // Raster: find the right date
          const allTifs = allFiles.filter(f => f.key?.match(/\.tiff?$/i));
          if (!allTifs.length) continue;

          const targetDateStr = `${y}/${md}/${dd}`;
          const uniqueDates = [...new Set(allTifs.map(f => dateOf(f.key ?? "")))].filter(Boolean).sort();
          const lte = timelineDate ? uniqueDates.filter(d2 => d2 <= targetDateStr) : uniqueDates;
          if (!lte.length) {
            if (timelineDate) showNotification(`No data for "${catName}" before ${dateStr}`, "info");
            break;
          }
          const bestDate = lte[lte.length - 1];
          const tifsForDate = allTifs.filter(f => dateOf(f.key ?? "") === bestDate);

          // Match slot pattern: /HH-MM/ hoặc /HH-MM/raster/
          const slotPattern = (slot: string) => new RegExp(`\\/${slot.replace('-', '-')}\\/(raster\\/)?[^/]+\\.tiff?$`, 'i');
          let pickedTif = tifsForDate.find(f => slotPattern(timeSlot ?? "00-00").test(f.key ?? ""));

          if (!pickedTif) {
            if (isFirstApply) {
              // First apply: find nearest slot
              const slotNum = parseInt((timeSlot ?? "00-00").replace("-", ""), 10);
              pickedTif = tifsForDate.reduce((best, f) => {
                const m2 = f.key?.match(/\/(\d{2}-\d{2})\//);
                if (!m2) return best;
                const diff = Math.abs(parseInt(m2[1].replace("-", ""), 10) - slotNum);
                const bm = best?.key?.match(/\/(\d{2}-\d{2})\//);
                return diff < Math.abs(parseInt((bm?.[1] ?? "9999").replace("-", ""), 10) - slotNum) ? f : best;
              }, tifsForDate[0]);
            } else {
              // Timeline drag: exact only
              showNotification(`No data for "${catName}" at ${timeSlot}`, "info");
              break;
            }
          }

          if (!pickedTif) break;

          const timeMatch = pickedTif.key!.match(/\/(\d{2}-\d{2})\//);
          const timeLabel = timeMatch ? timeMatch[1] : "00-00";
          const frameKey = `${dsKey}__${bestDate.replace(/\//g, "-")}__${timeLabel}`;

          activeDateRef.current = bestDate.replace(/\//g, "-");
          setRenderedLayers({
            [frameKey]: {
              name: parent ? `${parent.name} - ${catName} (${timeLabel})` : `${catName} (${timeLabel})`,
              proxyUrl: `/api/tif?key=${encodeURIComponent(pickedTif.key!)}`,
              type: "raster",
              bbox: [594885, 1052655, 688485, 1117455],
              nodata: -9999,
            },
          });

          // Notify actual slot for timeline sync on first apply
          if (isFirstApply && timeLabel !== (timeSlot ?? "00-00")) {
            onActualSlot?.(bestDate.replace(/\//g, "-"), timeLabel);
          }
          isFirstApplyRef.current = false;
          return;
        } catch (e) {
          console.warn("[useSingleLayer]", prefix, e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [dataset?.id, dataset?.type, timelineDate, timeSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const layerRefs = useS3LayerRenderer(renderedLayers, mapRef, prebuiltLayersRef, activeDateRef);
  return { renderedLayers, layerRefs };
}
