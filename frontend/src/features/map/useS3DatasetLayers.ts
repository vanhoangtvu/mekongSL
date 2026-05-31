"use client";

import { useEffect, useRef, useState } from "react";
import type Map from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFF from "ol/source/GeoTIFF";
import { transformExtent } from "ol/proj";
import { getDatasetSlug, getParentDataset, getDatasetById } from "../../lib/constants/datasets";
import { listS3Files } from "../../lib/admin-api";
import { showNotification } from "../../lib/notification";

export type RenderedLayer = {
  name: string;
  proxyUrl: string;
  bbox: [number, number, number, number];
  nodata: number;
};

export function useS3DatasetLayers(
  appliedDatasets: string[] | undefined,
  mapRef: React.MutableRefObject<Map | null>
) {
  const layerRefs = useRef<Record<string, WebGLTileLayer>>({});
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});

  // ── Applied datasets: smart diff — keep existing, remove stale, fetch new ──
  useEffect(() => {
    console.warn("[AppliedDatasets] effect triggered with:", appliedDatasets);
    const next = new Set(appliedDatasets ?? []);
    const prevKeys = Object.keys(renderedLayers);
    const prev = new Set(prevKeys);
    const toRemove = prevKeys.filter((id) => !next.has(id));
    const toKeep = prevKeys.filter((id) => next.has(id));
    const toAdd = [...next].filter((id) => !prev.has(id));

    if (toRemove.length > 0) {
      setRenderedLayers((prev) => {
        const nextMap = { ...prev };
        for (const id of toRemove) delete nextMap[id];
        return nextMap;
      });
      if (toAdd.length === 0) {
        showNotification(`Removed ${toRemove.length} layer(s)`, "info");
      }
    }

    if (toAdd.length === 0) return;
    if (toKeep.length > 0) {
      showNotification(`Keeping ${toKeep.length}, fetching ${toAdd.length} new...`, "info");
    }

    let isActive = true;
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const md = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${y}-${md}-${dd}`;

    async function fetchNew() {
      const additions: Record<string, RenderedLayer> = {};

      for (const dsId of toAdd) {
        if (!isActive) break;
        showNotification(`Looking up "${dsId}"...`, "info");

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
        const prefixes = [
          `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/${dd}/`,
          `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/`,
          `gis-data/${dsSlug}/${categorySlug}/${y}/`,
        ];

        let foundKey: string | null = null;
        for (const prefix of prefixes) {
          try {
            const allFiles = await listS3Files(prefix);
            if (!isActive) break;
            console.warn(`[S3] prefix="${prefix}" files=${allFiles.length}`, allFiles.slice(0, 3));
            const tif = allFiles.find((f) => f.key?.match(/\.tiff?$/i));
            if (tif) {
              foundKey = tif.key;
              console.warn("[S3] FOUND .tif:", foundKey);
              break;
            }
          } catch (e) {
            console.warn("[S3] error for prefix", prefix, e);
          }
        }
        if (!isActive) break;

        const catName = dsInfo?.name || dsId;
        if (!foundKey) {
          showNotification(`No data found for "${catName}" on ${dateStr}`, "error");
          continue;
        }

        try {
          const proxyUrl = `/api/tif?key=${encodeURIComponent(foundKey)}`;
          additions[dsId] = {
            name: parent ? `${parent.name} - ${catName}` : catName,
            proxyUrl,
            bbox: [594885, 1052655, 688485, 1117455],
            nodata: -9999,
          };
        } catch {
          if (isActive) showNotification(`Failed to load "${catName}"`, "error");
        }
      }

      if (!isActive) return;

      setRenderedLayers((prev) => {
        const nextMap = { ...prev };
        for (const [id, info] of Object.entries(additions)) nextMap[id] = info;
        return nextMap;
      });

      const count = Object.keys(additions).length;
      if (count > 0) {
        const names = Object.values(additions).map((v) => v.name).join(", ");
        showNotification(`Displaying ${count} layer(s): ${names}`, "success");
      }
    }

    void fetchNew();
    return () => {
      isActive = false;
    };
  }, [appliedDatasets]);

  // ── Sync renderedLayers state ↔ OpenLayers map layers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentLayers = layerRefs.current;

    const renderedIds = new Set(Object.keys(renderedLayers));
    const existingIds = new Set(Object.keys(currentLayers));

    for (const id of existingIds) {
      if (!renderedIds.has(id)) {
        const layer = currentLayers[id];
        if (layer) {
          map.removeLayer(layer);
          layer.getSource()?.dispose?.();
        }
        delete currentLayers[id];
      }
    }

    for (const [id, info] of Object.entries(renderedLayers)) {
      if (currentLayers[id]) continue;

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
        opacity: 0.7,
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
      map.addLayer(rasterLayer);
      currentLayers[id] = rasterLayer;

      if (Object.keys(currentLayers).length === 1) {
        source.once("change", () => {
          if (source.getState() === "ready") {
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
                  map.getView().fit(ext, { padding: [48, 48, 48, 48], duration: 300, maxZoom: 15 });
                }
              })
              .catch(() => {});
          }
        });
        source.refresh();
      }
    }
  }, [renderedLayers]);

  return { renderedLayers, layerRefs };
}
