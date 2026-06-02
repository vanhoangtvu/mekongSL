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

  // ── Applied datasets: smart diff — keep existing, remove stale, fetch new ──
  useEffect(() => {
    console.warn("[AppliedDatasets] effect triggered with:", appliedDatasets, "timelineDate:", timelineDate);
    const filtered = (appliedDatasets ?? []).map((d) => `${d.id}-${d.type}`);
    const next = new Set(filtered);
    const prevKeys = Object.keys(renderedLayers);
    const prev = new Set(prevKeys);

    const dateChanged = prevDateRef.current !== undefined && prevDateRef.current !== timelineDate;
    prevDateRef.current = timelineDate;

    // Date changed: clear all existing layers so they re-fetch with new date
    if (dateChanged && prevKeys.length > 0) {
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
    const [y, m, d] = timelineDate
      ? timelineDate.split('-').map(Number)
      : (() => { const t = new Date(); return [t.getFullYear(), t.getMonth() + 1, t.getDate()]; })();
    const md = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = timelineDate || `${y}-${md}-${dd}`;

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
        const prefixes = [
          `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/${dd}/`,
          `gis-data/${dsSlug}/${categorySlug}/${y}/${md}/`,
          `gis-data/${dsSlug}/${categorySlug}/${y}/`,
        ];

        let foundKey: string | null = null;
        let vdcKey: string | null = null;
        for (const prefix of prefixes) {
          try {
            const allFiles = await listS3Files(prefix);
            if (!isActive) break;
            console.warn(`[S3] prefix="${prefix}" files=${allFiles.length}`, allFiles.slice(0, 10).map(f => f.key));

            if (isVector) {
              const vFile = allFiles.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return k.endsWith(".vct");
              }) || allFiles.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return VECTOR_EXTS.some((ext) => k.endsWith(ext) && !k.endsWith(".zip") && !k.endsWith(".vdc") && !k.endsWith(".vct"));
              }) || allFiles.find((f) => {
                const k = f.key?.toLowerCase() ?? "";
                return k.endsWith(".zip");
              });
              if (vFile) {
                foundKey = vFile.key;
                // Also look for companion .vdc file (case-insensitive)
                const baseLower = foundKey.replace(/\.\w+$/, "").toLowerCase();
                const comp = allFiles.find((f) => f.key?.toLowerCase() === baseLower + ".vdc");
                if (comp) vdcKey = comp.key;
                console.warn("[S3] FOUND vector:", foundKey, "companion .vdc:", vdcKey);
                break;
              }
            } else {
              const tif = allFiles.find((f) => f.key?.match(/\.tiff?$/i));
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

    // Remove stale layers
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

    let isActive = true;

    // Add new layers
    for (const [id, info] of Object.entries(renderedLayers)) {
      if (currentLayers[id]) continue;

      if (info.type === "raster") {
        // ── Raster: WebGLTileLayer with GeoTIFF ──
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
        // ── Vector: fetch content, parse, create VectorLayer ──
        const absoluteUrl = info.proxyUrl.startsWith("http")
          ? info.proxyUrl
          : `${window.location.origin}${info.proxyUrl}`;

        const vectorLayerId = id;
        const vectorExt = info.ext;

        async function loadVectorLayer() {
          try {
            const response = await fetch(absoluteUrl);
            if (!isActive) return;

            const contentType = response.headers.get("content-type") || "";
            const buf = await response.arrayBuffer();
            if (!isActive) return;

            const bytes = new Uint8Array(buf.slice(0, 32));
            const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(" ");
            const previewText = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 200));
            const fullText = new TextDecoder("utf-8", { fatal: false }).decode(buf);
            console.warn("[Vector] content-type:", contentType, "ext:", vectorExt, "magic hex:", hex, "preview:", previewText);
            console.warn("[Vector] file length:", buf.byteLength);

            // Detect format by magic bytes
            const magic = new Uint8Array(buf.slice(0, 4));
            const isPK = magic[0] === 0x50 && magic[1] === 0x4B; // ZIP
            const isSHP = magic[0] === 0x00 && magic[1] === 0x00 && magic[2] === 0x27 && magic[3] === 0x0F; // Shapefile
            const isSQLite = previewText.startsWith("SQLite"); // GeoPackage
            const isGeoJSON = previewText.trim().startsWith("{") || previewText.trim().startsWith("[");
            const isXML = previewText.trim().startsWith("<");
            const isWKT = /^(POINT|LINESTRING|POLYGON|MULTI)/i.test(previewText.trim());
            const isIDRISI = vectorExt === ".vct" || vectorExt === ".vdc";

            console.warn("[Vector] detected: ZIP:", isPK, "SHP:", isSHP, "SQLite:", isSQLite, "GeoJSON:", isGeoJSON, "XML:", isXML, "WKT:", isWKT, "IDRISI:", isIDRISI);

            let vdcTextFull = "";
            // Also fetch .vdc companion if available
            if (info.type === "vector" && info.vdcUrl) {
              try {
                const vdcAbsUrl = info.vdcUrl.startsWith("http")
                  ? info.vdcUrl
                  : `${window.location.origin}${info.vdcUrl}`;
                const vdcRes = await fetch(vdcAbsUrl);
                if (vdcRes.ok && isActive) {
                  const vdcBuf = await vdcRes.arrayBuffer();
                  if (isActive) {
                    const vdcBytes = new Uint8Array(vdcBuf.slice(0, 32));
                    const vdcHex = Array.from(vdcBytes).map(b => b.toString(16).padStart(2, "0")).join(" ");
                    vdcTextFull = new TextDecoder("utf-8", { fatal: false }).decode(vdcBuf);
                    const vdcTextPreview = vdcTextFull.slice(0, 300);
                    console.warn("[Vector] VDC companion size:", vdcBuf.byteLength, "magic:", vdcHex, "content:", vdcTextPreview);
                  }
                }
              } catch (vdcErr) {
                console.warn("[Vector] Failed to fetch VDC companion:", vdcErr);
              }
            }

            let features: Feature[];
            const wktFormat = new WKT();

            if (isSHP) {
              console.warn("[Vector] Shapefile detected, needs library support");
              if (isActive) showNotification(`Shapefile (.vct) needs conversion to GeoJSON`, "error");
              return;
            } else if (isPK) {
              console.warn("[Vector] ZIP archive detected");
              if (isActive) showNotification(`ZIP file detected, extracting not yet supported`, "error");
              return;
            } else if (isSQLite) {
              console.warn("[Vector] GeoPackage detected");
              if (isActive) showNotification(`GeoPackage not yet supported`, "error");
              return;
            } else if (isXML) {
              const kmlFormat = new KML({ extractStyles: true });
              features = kmlFormat.readFeatures(fullText, {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              });
              console.warn("[Vector] KML parsed features:", features?.length);
            } else if (isGeoJSON) {
              const geojsonFormat = new GeoJSON();
              try {
                features = geojsonFormat.readFeatures(fullText, {
                  featureProjection: "EPSG:3857",
                });
              } catch {
                features = geojsonFormat.readFeatures(fullText, {
                  dataProjection: "EPSG:4326",
                  featureProjection: "EPSG:3857",
                });
              }
            } else if (isWKT) {
              features = [wktFormat.readFeature(fullText, {
                dataProjection: "EPSG:4326",
                featureProjection: "EPSG:3857",
              })].filter(Boolean) as Feature[];
            } else if (isIDRISI) {
              features = [];
              try {
                const lowerVdc = vdcTextFull.toLowerCase();
                const isLine = lowerVdc.includes("object type : line");
                const isPolygon = lowerVdc.includes("object type : polygon");
                const isPoint = lowerVdc.includes("object type : point");

                let projCode = "EPSG:32648";
                if (lowerVdc.includes("latlong") || lowerVdc.includes("lat/long")) {
                   projCode = "EPSG:4326";
                }

                const dv = new DataView(buf);
                let offset = 0x105; // 261 bytes header
                
                while (offset + 40 <= buf.byteLength) {
                  if (isLine) {
                    const id = dv.getFloat64(offset, true);
                    offset += 40;
                    if (offset + 4 > buf.byteLength) break;
                    const nNodes = dv.getUint32(offset, true);
                    offset += 4;
                    
                    if (offset + nNodes * 16 > buf.byteLength) break;
                    
                    const coords = [];
                    for(let i = 0; i < nNodes; i++) {
                       const x = dv.getFloat64(offset, true);
                       const y = dv.getFloat64(offset + 8, true);
                       coords.push([x, y]);
                       offset += 16;
                    }
                    
                    const f = new Feature({
                       geometry: new LineString(coords).transform(projCode, "EPSG:3857")
                    });
                    f.set("id", id);
                    f.set("value", id);
                    features.push(f);
                  } else if (isPolygon) {
                    const id = dv.getFloat64(offset, true);
                    offset += 40;
                    if (offset + 8 > buf.byteLength) break;
                    const nParts = dv.getUint32(offset, true);
                    const nTotalNodes = dv.getUint32(offset + 4, true);
                    offset += 8;
                    
                    const partsCount = [];
                    if (nParts > 1) {
                        if (offset + nParts * 4 > buf.byteLength) break;
                        for(let i = 0; i < nParts; i++) {
                            partsCount.push(dv.getUint32(offset, true));
                            offset += 4;
                        }
                    } else {
                        if (offset + 4 > buf.byteLength) break;
                        const nNodes = dv.getUint32(offset, true);
                        offset += 4;
                        partsCount.push(nNodes);
                    }
                    
                    const polys = [];
                    let broken = false;
                    for(let i = 0; i < nParts; i++) {
                        const nNodes = partsCount[i];
                        if (offset + nNodes * 16 > buf.byteLength) {
                            broken = true;
                            break;
                        }
                        const ring = [];
                        for(let j = 0; j < nNodes; j++) {
                           const x = dv.getFloat64(offset, true);
                           const y = dv.getFloat64(offset + 8, true);
                           ring.push([x, y]);
                           offset += 16;
                        }
                        polys.push(ring);
                    }
                    if (broken) break;
                    const f = new Feature({
                       geometry: new Polygon(polys).transform(projCode, "EPSG:3857")
                    });
                    f.set("id", id);
                    f.set("value", id);
                    features.push(f);
                  } else if (isPoint) {
                    const id = dv.getFloat64(offset, true);
                    if (offset + 24 > buf.byteLength) break;
                    const x = dv.getFloat64(offset + 8, true);
                    const y = dv.getFloat64(offset + 16, true);
                    offset += 24;
                    const f = new Feature({
                       geometry: new Point([x, y]).transform(projCode, "EPSG:3857")
                    });
                    f.set("id", id);
                    f.set("value", id);
                    features.push(f);
                  } else {
                     break;
                  }
                }
                console.warn(`[Vector] IDRISI Vector parsed ${features.length} features`);
              } catch (e) {
                 console.error("[Vector] Failed to parse IDRISI Vector", e);
              }
            } else {
              features = [];
            }

            if (!isActive) return;

            if (!features || features.length === 0) {
              console.warn("[Vector] No features parsed for:", info.name);
              if (isActive) showNotification(`Cannot parse vector file "${info.name}" - unsupported format`, "error");
              return;
            }

            const vectorSource = new VectorSource({ features });
            const vectorLayer = new VectorLayer({
              source: vectorSource,
              style: defaultVectorStyle,
            });

            vectorLayer.setZIndex(150 + Object.keys(currentLayers).length);

            if (isActive && renderedIds.has(vectorLayerId) && !currentLayers[vectorLayerId]) {
              safeMap.addLayer(vectorLayer);
              currentLayers[vectorLayerId] = vectorLayer;

              const extent = vectorSource.getExtent();
              console.warn("[Vector] layer extent:", extent);
              if (extent && extent.length === 4 && extent[0] !== Infinity) {
                safeMap.getView().fit(extent, {
                  padding: [48, 48, 48, 48],
                  maxZoom: 16,
                  duration: 300,
                });
              }
            }
          } catch (err) {
            console.error("Error loading vector layer:", err);
            if (isActive) showNotification(`Failed to load vector layer "${info.name}"`, "error");
          }
        }

        void loadVectorLayer();
      }
    }

    return () => {
      isActive = false;
    };
  }, [renderedLayers]);

  return { renderedLayers, layerRefs };
}
