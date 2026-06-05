"use client";

import { useEffect, useRef, useState } from "react";
import type Map from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import { Point, LineString, Polygon } from "ol/geom";
import GeoJSON from "ol/format/GeoJSON";
import KML from "ol/format/KML";
import GeoTIFF from "ol/source/GeoTIFF";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import WKT from "ol/format/WKT";
import { transformExtent } from "ol/proj";
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

export function useS3DatasetLayers(
  appliedDatasets: Array<{ id: string; type: string }> | undefined,
  mapRef: React.MutableRefObject<Map | null>,
  timelineDate?: string
) {
  const layerRefs = useRef<Record<string, WebGLTileLayer | VectorLayer>>({});
  const prevDateRef = useRef<string | undefined>(undefined);
  const [renderedLayers, setRenderedLayers] = useState<Record<string, RenderedLayer>>({});
  const layersCacheRef = useRef<Record<string, Record<string, RenderedLayer>>>({});
  const prebuiltLayersRef = useRef<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>({});
  const activeDateRef = useRef<string>("");

  // ── Applied datasets: smart diff — keep existing, remove stale, fetch new ──
  useEffect(() => {
    console.warn("[AppliedDatasets] effect triggered with:", appliedDatasets, "timelineDate:", timelineDate);
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

    // Date changed: check cache first
    if (dateChanged && prevKeys.length > 0) {
      const cached = layersCacheRef.current[dateStr];
      if (cached) {
        setRenderedLayers(cached);
        activeDateRef.current = dateStr;
        return;
      }
      setRenderedLayers({});
    }

    const toRemove = prevKeys.filter((key) => !next.has(key));
    const toKeep = prevKeys.filter((key) => next.has(key));
    const toAdd = dateChanged
      ? [...next]
      : [...next].filter((key) => !prev.has(key));

    if (!dateChanged && toRemove.length > 0) {
      setRenderedLayers((prev) => {
        const nextMap = { ...prev };
        for (const key of toRemove) delete nextMap[key];
        return nextMap;
      });
      if (toAdd.length === 0) {
        showNotification(`Removed ${toRemove.length} layer(s)`, "info");
      }
    }

    let isActive = true;

    if (toAdd.length === 0) return;
    if (dateChanged) {
      showNotification(`Loading data for ${dateStr}...`, "info");
    } else if (toKeep.length > 0) {
      showNotification(`Keeping ${toKeep.length}, fetching ${toAdd.length} new...`, "info");
    }

    async function fetchNew() {
      const additions: Record<string, RenderedLayer> = {};

      for (const dsKey of toAdd) {
        if (!isActive) break;
        
        // Find the actual dataset entry from the applied list
        const dsEntry = (appliedDatasets ?? []).find((d) => `${d.id}-${d.type}` === dsKey);
        if (!dsEntry) continue;

        const dsId = dsEntry.id;
        const isVector = dsEntry.type === "vector";

        // Skip datasets that don't have GIS/S3 data (e.g. weather station items)
        const dsInfoCheck = getDatasetById(dsId);
        const parentCheck = getParentDataset(dsId);
        if (dsInfoCheck?.gisData === false || parentCheck?.gisData === false) continue;
        
        showNotification(`Looking up "${dsId}" (${dsEntry.type})...`, "info");

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
        const prefixes = timelineDate ? [
          `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/${dd}/`,
          `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/`,
          `gis-data/${dsSlug}/${categorySlug}/${y}/`,
          `gis-data/${dsSlug}/${categorySlug}/`,
        ] : [
          `gis-data/${dsSlug}/${categorySlug}/`,
        ];

        let foundKey: string | null = null;
        let vdcKey: string | null = null;
        for (const prefix of prefixes) {
          try {
            const allFiles = await listS3Files(prefix);
            if (!isActive) break;
            console.warn(`[S3] prefix="${prefix}" files=${allFiles.length}`, allFiles.slice(0, 10).map(f => f.key));

            // When no timelineDate, sort by lastModified descending to get latest file first
            const files = timelineDate
              ? allFiles
              : [...allFiles].sort((a, b) => {
                  const ta = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                  const tb = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                  return tb - ta;
                });

            if (isVector) {
              const vFile = files.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return k.endsWith(".vct");
              }) || files.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return VECTOR_EXTS.some((ext) => k.endsWith(ext) && !k.endsWith(".zip") && !k.endsWith(".vdc") && !k.endsWith(".vct"));
              }) || files.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return k.endsWith(".zip");
              });
              if (vFile) {
                foundKey = vFile.key;
                // Also look for companion .vdc file (case-insensitive)
                const baseLower = foundKey.replace(/\.\w+$/, "").toLowerCase();
                const comp = files.find((f) => f.key?.toLowerCase() === baseLower + ".vdc");
                if (comp) vdcKey = comp.key;
                console.warn("[S3] FOUND vector:", foundKey, "companion .vdc:", vdcKey);
                break;
              }
            } else {
              const tif = files.find((f) => f.key?.match(/\.tiff?$/i));
              if (tif) {
                foundKey = tif.key;
                console.warn("[S3] FOUND .tif:", foundKey);
                break;
              }
            }
          } catch (e) {
            console.warn("[S3] error for prefix", prefix, e);
          }
        }
        if (!isActive) break;

        const catName = dsInfo?.name || dsId;
        if (!foundKey) {
          showNotification(`No ${isVector ? 'vector' : 'raster'} data found for "${catName}" on ${dateStr}`, "error");
          continue;
        }

        try {
          const proxyUrl = `/api/tif?key=${encodeURIComponent(foundKey)}`;
          if (isVector) {
            const ext = "." + (foundKey.split(".").pop() || "").toLowerCase();
            additions[dsKey] = {
              name: parent ? `${parent.name} - ${catName}` : catName,
              proxyUrl,
              type: "vector",
              ext,
              vdcUrl: vdcKey ? `/api/tif?key=${encodeURIComponent(vdcKey)}` : undefined,
            };
          } else {
            additions[dsKey] = {
              name: parent ? `${parent.name} - ${catName}` : catName,
              proxyUrl,
              type: "raster",
              bbox: [594885, 1052655, 688485, 1117455],
              nodata: -9999,
            };
          }
        } catch {
          if (isActive) showNotification(`Failed to load "${catName}"`, "error");
        }
      }

      if (!isActive) return;

      // Cache fetched layers
      layersCacheRef.current[dateStr] = additions;
      activeDateRef.current = dateStr;

      setRenderedLayers((prev) => {
        const nextMap = { ...prev };
        for (const [key, info] of Object.entries(additions)) nextMap[key] = info;
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
  }, [appliedDatasets, timelineDate]);

  // ── Sync renderedLayers state ↔ OpenLayers map layers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const safeMap = map;
    const currentLayers = layerRefs.current;

    const renderedIds = new Set(Object.keys(renderedLayers));
    const existingIds = new Set(Object.keys(currentLayers));

    // Remove stale layers (but keep in prebuiltLayersRef for reuse)
    for (const id of existingIds) {
      if (!renderedIds.has(id)) {
        const layer = currentLayers[id];
        if (layer) {
          safeMap.removeLayer(layer);
          layer.getSource()?.dispose?.();
        }
        delete currentLayers[id];
      }
    }

    // Restore cached layers for the active date
    const activeDate = activeDateRef.current;
    const cachedLayers = prebuiltLayersRef.current[activeDate];
    if (cachedLayers) {
      for (const [id, layer] of Object.entries(cachedLayers)) {
        if (renderedIds.has(id) && !currentLayers[id]) {
          safeMap.addLayer(layer);
          currentLayers[id] = layer;
          layer.setZIndex(100 + Object.keys(currentLayers).length);
        }
      }
    }

    let isActive = true;

    // Add new layers
    for (const [id, info] of Object.entries(renderedLayers)) {
      if (currentLayers[id]) continue;

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
        safeMap.addLayer(rasterLayer);
        currentLayers[id] = rasterLayer;

        // Cache layer for reuse
        const dateLayers = prebuiltLayersRef.current[activeDate] || {};
        dateLayers[id] = rasterLayer;
        prebuiltLayersRef.current[activeDate] = dateLayers;

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
                    safeMap.getView().fit(ext, { padding: [48, 48, 48, 48], duration: 300, maxZoom: 15 });
                  }
                })
                .catch(() => {});
            }
          });
          source.refresh();
        }
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
              features = []; // IDRISI vector parsing simplified for brevity
            } else { features = []; }

            if (!isActive) return;
            if (!features?.length) { showNotification(`Cannot parse vector "${info.name}"`, "error"); return; }

            const vectorSource = new VectorSource({ features });
            const vectorLayer = new VectorLayer({ source: vectorSource, style: defaultVectorStyle });
            vectorLayer.setZIndex(150 + Object.keys(currentLayers).length);

            if (isActive && renderedIds.has(vectorLayerId) && !currentLayers[vectorLayerId]) {
              safeMap.addLayer(vectorLayer);
              currentLayers[vectorLayerId] = vectorLayer;

              const dateLayers = prebuiltLayersRef.current[activeDate] || {};
              dateLayers[vectorLayerId] = vectorLayer;
              prebuiltLayersRef.current[activeDate] = dateLayers;

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
