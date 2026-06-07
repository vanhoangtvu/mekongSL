"use client";

import { useEffect, useRef } from "react";
import type React from "react";
import type OLMap from "ol/Map";
import WebGLTileLayer from "ol/layer/WebGLTile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import KML from "ol/format/KML";
import GeoTIFF from "ol/source/GeoTIFF";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import WKT from "ol/format/WKT";
import { transformExtent, transform } from "ol/proj";
import OLPoint from "ol/geom/Point";
import OLLineString from "ol/geom/LineString";
import OLPolygon from "ol/geom/Polygon";
import type { RenderedLayer } from "./useS3DatasetLayers";
import { showNotification } from "../../lib/notification";

export { parseVCT, animateLayer, removeLayerFromMap, defaultVectorStyle, FADE_MS };

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

const FADE_MS = 700;

function animateLayer(
  layer: WebGLTileLayer | VectorLayer,
  from: number,
  to: number,
  duration: number,
  linkedLayer?: WebGLTileLayer | VectorLayer, // Add linkedLayer to sync opacities
): Promise<void> {
  if (from === to) return Promise.resolve();
  return new Promise((resolve) => {
    const start = performance.now();
    const targetTotal = 0.7; // The desired constant visual density

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      
      const currentOpacity = from + (to - from) * t;
      layer.setOpacity(currentOpacity);

      // Strict Capping: if linkedLayer exists, ensure total doesn't exceed 0.7
      if (linkedLayer) {
        // If this is the new layer (fading in), the linked old layer should be (0.7 - current)
        if (to > from) {
          linkedLayer.setOpacity(Math.max(0, targetTotal - currentOpacity));
        } 
        // If this is the old layer (fading out), the linked new layer is already handled by its own animation
      }

      if (t < 1) requestAnimationFrame(step);
      else { 
        layer.setOpacity(to); 
        if (linkedLayer && to > from) linkedLayer.setOpacity(0); // Ensure old is fully gone
        resolve(); 
      }
    }
    requestAnimationFrame(step);
  });
}

function removeLayerFromMap(
  map: OLMap,
  layer: WebGLTileLayer | VectorLayer,
  refs: Record<string, WebGLTileLayer | VectorLayer>,
  id: string,
) {
  map.removeLayer(layer);
  const src = layer.getSource?.();
  if (src && typeof src === "object" && "dispose" in src) {
    try { (src as { dispose: () => void }).dispose(); } catch {}
  }
  delete refs[id];
}

function parseVCT(buf: ArrayBuffer, vdcText: string): Feature[] {
  const v = new DataView(buf);
  const geomType = v.getUint8(0);
  if (geomType < 1 || geomType > 3) return [];

  let srcProj = "EPSG:4326";
  if (vdcText) {
    const refSys = (vdcText.match(/ref\.\s*system\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    const refUnits = (vdcText.match(/ref\.\s*units\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    if (refSys.startsWith("utm-")) {
      const zone = refSys.match(/utm-(\d+)/)?.[1];
      srcProj = zone ? `EPSG:326${zone.padStart(2, "0")}` : "EPSG:32648";
    } else if (refUnits === "m" || refSys === "plane") {
      srcProj = "EPSG:32648";
    }
  }

  const toWeb = (x: number, y: number): [number, number] =>
    transform([x, y], srcProj, "EPSG:3857") as [number, number];

  const features: Feature[] = [];
  let offset = 0x105;
  try {
    while (offset < buf.byteLength) {
      if (geomType === 1) {
        if (offset + 24 > buf.byteLength) break;
        const x = v.getFloat64(offset + 8, true);
        const y = v.getFloat64(offset + 16, true);
        offset += 24;
        features.push(new Feature({ geometry: new OLPoint(toWeb(x, y)) }));
      } else if (geomType === 2) {
        if (offset + 44 > buf.byteLength) break;
        offset += 40;
        const nNodes = v.getUint32(offset, true);
        offset += 4;
        if (nNodes === 0 || offset + nNodes * 16 > buf.byteLength) { offset += nNodes * 16; continue; }
        const coords: [number, number][] = [];
        for (let i = 0; i < nNodes; i++) {
          coords.push(toWeb(v.getFloat64(offset, true), v.getFloat64(offset + 8, true)));
          offset += 16;
        }
        features.push(new Feature({ geometry: new OLLineString(coords) }));
      } else {
        if (offset + 48 > buf.byteLength) break;
        offset += 40;
        const nParts = v.getUint32(offset, true);
        const nTotalNodes = v.getUint32(offset + 4, true);
        offset += 8;
        if (nParts === 0 || nTotalNodes === 0 || nParts > 100000 || nTotalNodes > 10_000_000) break;
        const nodeCounts: number[] = [];
        if (nParts > 1) {
          if (offset + nParts * 4 > buf.byteLength) break;
          for (let i = 0; i < nParts; i++) { nodeCounts.push(v.getUint32(offset, true)); offset += 4; }
        } else {
          if (offset + 4 > buf.byteLength) break;
          nodeCounts.push(v.getUint32(offset, true));
          offset += 4;
        }
        if (offset + nTotalNodes * 16 > buf.byteLength) break;
        const rings: [number, number][][] = [];
        for (let p = 0; p < nParts; p++) {
          const ring: [number, number][] = [];
          for (let i = 0; i < nodeCounts[p]; i++) {
            ring.push(toWeb(v.getFloat64(offset, true), v.getFloat64(offset + 8, true)));
            offset += 16;
          }
          rings.push(ring);
        }
        features.push(new Feature({ geometry: new OLPolygon(rings) }));
      }
    }
  } catch { /* truncated */ }
  return features;
}

function getPrefix(key: string) { return key.split("__")[0]; }

/**
 * Syncs a `renderedLayers` map → actual OpenLayers layers on the map.
 * Cross-fades when replacing a layer with same dataset prefix.
 * Returns layerRefs so callers can read pixel values.
 */
export function useS3LayerRenderer(
  renderedLayers: Record<string, RenderedLayer>,
  mapRef: React.MutableRefObject<OLMap | null>,
  prebuiltLayersRef: React.MutableRefObject<Record<string, Record<string, WebGLTileLayer | VectorLayer>>>,
  activeDateRef: React.MutableRefObject<string>,
  sourceCacheRef?: React.MutableRefObject<Map<string, { source: GeoTIFF; ready: boolean }>>,
) {
  const layerRefs = useRef<Record<string, WebGLTileLayer | VectorLayer>>({});
  const pendingReplaceRef = useRef<Record<string, { oldId: string; done: boolean }>>({});

  useEffect(() => {
    const map = mapRef.current;
    console.log("[useS3LayerRenderer] sync", { layers: Object.keys(renderedLayers), mapExists: !!map });
    if (!map) return;
    const safeMap = map;
    const currentLayers = layerRefs.current;
    const pendingReplace = pendingReplaceRef.current;
    const renderedIds = new Set(Object.keys(renderedLayers));
    const activeDate = activeDateRef.current;

    // Build prefix → newId
    const newByPrefix: Record<string, string> = {};
    for (const id of renderedIds) newByPrefix[getPrefix(id)] = id;

    // Phase 1: remove stale or register pending-replace
    for (const id of Object.keys(currentLayers)) {
      if (renderedIds.has(id)) continue;
      const prefix = getPrefix(id);
      if (newByPrefix[prefix]) {
        pendingReplace[prefix] = { oldId: id, done: false };
      } else {
        const layer = currentLayers[id];
        if (layer) {
          const op = layer.getOpacity();
          animateLayer(layer, op, 0, FADE_MS).then(() => {
            removeLayerFromMap(safeMap, layer, currentLayers, id);
            for (const dl of Object.values(prebuiltLayersRef.current)) delete dl[id];
          });
        } else {
          delete currentLayers[id];
        }
      }
    }

    // Phase 2: restore prebuilt cached OL layers
    const cachedLayers = prebuiltLayersRef.current[activeDate];
    if (cachedLayers) {
      for (const [id, layer] of Object.entries(cachedLayers)) {
        if (!renderedIds.has(id) || currentLayers[id]) continue;
        const prefix = getPrefix(id);
        const pending = pendingReplace[prefix];

        // Safety: check if layer is already on the map (e.g. reused from a different ID)
        const mapLayers = safeMap.getLayers().getArray();
        if (!mapLayers.includes(layer)) {
          safeMap.addLayer(layer);
        }

        currentLayers[id] = layer;
        layer.setZIndex(100 + Object.keys(currentLayers).length);

        if (pending && !pending.done && currentLayers[pending.oldId]) {
          const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
          if (old === layer) {
            // Same instance, just claim it
            delete currentLayers[pending.oldId];
            pending.done = true;
            delete pendingReplace[prefix];
          } else {
            layer.setOpacity(0.7);
            animateLayer(old, old.getOpacity(), 0, FADE_MS).then(() => {
              removeLayerFromMap(safeMap, old, currentLayers, pending.oldId);
              for (const dl of Object.values(prebuiltLayersRef.current)) delete dl[pending.oldId];
              pending.done = true;
              delete pendingReplace[prefix];
            });
          }
        }
      }
    }

    let isActive = true;

    // Phase 3: add new layers
    for (const [id, info] of Object.entries(renderedLayers)) {
      if (currentLayers[id]) continue;
      const prefix = getPrefix(id);
      const pending = pendingReplace[prefix];

      if (info.type === "raster") {
        const url = info.proxyUrl.startsWith("http")
          ? info.proxyUrl
          : `${window.location.origin}${info.proxyUrl}`;

        const cachedSrc = sourceCacheRef?.current?.get(id);
        const source = cachedSrc?.ready
          ? cachedSrc.source
          : new GeoTIFF({
              sources: [{ url, nodata: info.nodata }],
              convertToRGB: false,
              normalize: false,
              interpolate: false,
              projection: "EPSG:32648",
            });

        // --- Style Definition Logic ---
        const dsPrefix = getPrefix(id);
        let rasterStyle: any;

        if (dsPrefix.startsWith("hydro-salinity")) {
          // Rule for Salinity: 0.01 to 27. Exactly 0 is transparent (background).
          rasterStyle = {
            color: [
              "case",
              ["==", ["band", 1], 0], [0, 0, 0, 0], // Background is 0
              ["==", ["band", 1], info.nodata], [0, 0, 0, 0],
              ["<", ["band", 1], 0.01], [0, 0, 0, 0],
              [">", ["band", 1], 27], [0, 0, 0, 0],
              ["interpolate", ["linear"], ["band", 1],
                0.01,  [0, 0, 0, 1],     // Black
                6.75,  [0, 0, 255, 1],   // Blue
                13.5,  [0, 255, 0, 1],   // Green
                20.25, [255, 255, 0, 1], // Yellow
                27,    [255, 0, 0, 1],   // Red
              ],
            ],
          };
        } else if (dsPrefix.startsWith("hydro-ph")) {
          // Rule for pH: 4 to 9. Exactly 0 is transparent (background).
          rasterStyle = {
            color: [
              "case",
              ["==", ["band", 1], 0], [0, 0, 0, 0], // Background is 0
              ["==", ["band", 1], info.nodata], [0, 0, 0, 0],
              ["<", ["band", 1], 4], [0, 0, 0, 0],
              [">", ["band", 1], 9], [0, 0, 0, 0],
              ["interpolate", ["linear"], ["band", 1],
                4,    [0, 0, 0, 1],     // Black
                5.25, [0, 0, 255, 1],   // Blue
                6.5,  [0, 255, 0, 1],   // Green
                7.75, [255, 255, 0, 1], // Yellow
                9,    [255, 0, 0, 1],   // Red
              ],
            ],
          };
        } else if (isWater) {
          // Rule for Water Level: -100 to 200. Exactly 0 is transparent (background).
          rasterStyle = {
            color: [
              "case",
              ["==", ["band", 1], 0], [0, 0, 0, 0], // Background is 0
              ["==", ["band", 1], info.nodata], [0, 0, 0, 0],
              ["<", ["band", 1], -100], [0, 0, 0, 0],
              [">", ["band", 1], 200], [0, 0, 0, 0],
              ["interpolate", ["linear"], ["band", 1],
                -100,  [0, 0, 0, 1],     // Black
                -25,   [0, 0, 255, 1],   // Blue
                0.001, [0, 255, 0, 1],   // Green
                100,   [255, 255, 0, 1], // Yellow
                200,   [255, 0, 0, 1],   // Red
              ],
            ],
          };
        } else {
          // Default styling for other datasets
          rasterStyle = {
            color: [
              "case",
              ["<=", ["band", 1], info.nodata], [0, 0, 0, 0],
              ["<=", ["band", 1], 0], [0, 0, 0, 0],
              ["interpolate", ["linear"], ["band", 1],
                0.06, [0, 0, 255, 1],
                21.0, [255, 0, 0, 1],
              ],
            ],
          };
        }

        const rasterLayer = new WebGLTileLayer({
          opacity: 0,
          source,
          style: rasterStyle,
        });

        rasterLayer.setZIndex(100 + Object.keys(currentLayers).length);
        if (!safeMap.getLayers().getArray().includes(rasterLayer)) {
          safeMap.addLayer(rasterLayer);
        }
        currentLayers[id] = rasterLayer;
        const dl = prebuiltLayersRef.current[activeDate] ?? {};
        dl[id] = rasterLayer;
        prebuiltLayersRef.current[activeDate] = dl;

        const onSourceReady = () => {
          if (source.getState() !== "ready" || !isActive) return;
          const targetOp = 0.7;
          
          if (pending && !pending.done && currentLayers[pending.oldId]) {
            const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
            
            // Strict Opacity Sync: new layer controls old layer to keep sum at 0.7
            animateLayer(rasterLayer, 0, targetOp, FADE_MS, old).then(() => {
              // Cleanup only after animation finishes
              removeLayerFromMap(safeMap, old, currentLayers, pending.oldId);
              for (const dlX of Object.values(prebuiltLayersRef.current)) delete dlX[pending.oldId];
              pending.done = true;
              delete pendingReplace[prefix];
            });
          } else {
            animateLayer(rasterLayer, 0, targetOp, FADE_MS);
          }

          if (Object.keys(currentLayers).filter(k => !pendingReplace[getPrefix(k)]).length <= 1) {
            source.getView().then((vo) => {
              if (!mapRef.current || !vo.extent || !vo.projection) return;
              const proj = typeof vo.projection === "string" ? vo.projection : vo.projection.getCode();
              safeMap.getView().fit(transformExtent(vo.extent, proj, "EPSG:3857"), {
                padding: [48, 48, 48, 48], duration: 300, maxZoom: 15,
              });
            }).catch(() => {});
          }
        };
        if (cachedSrc?.ready) {
          onSourceReady();
        } else if (source.getState() === "ready") {
          onSourceReady();
        } else {
          source.once("change", onSourceReady);
        }

      } else if (info.type === "vector") {
        const url = info.proxyUrl.startsWith("http")
          ? info.proxyUrl
          : `${window.location.origin}${info.proxyUrl}`;
        const layerId = id;
        const ext = info.ext;
        const vdcUrl = info.vdcUrl
          ? (info.vdcUrl.startsWith("http") ? info.vdcUrl : `${window.location.origin}${info.vdcUrl}`)
          : null;

        void (async () => {
          try {
            const buf = await (await fetch(url)).arrayBuffer();
            if (!isActive) return;
            const previewText = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 200));
            const fullText = new TextDecoder("utf-8", { fatal: false }).decode(buf);
            const magic = new Uint8Array(buf.slice(0, 4));
            const isPK = magic[0] === 0x50 && magic[1] === 0x4B;
            const isSHP = magic[0] === 0x00 && magic[3] === 0x0F;
            const isSQLite = previewText.startsWith("SQLite");
            const isGeoJSON = previewText.trim().startsWith("{") || previewText.trim().startsWith("[");
            const isXML = previewText.trim().startsWith("<");
            const isWKT = /^(POINT|LINESTRING|POLYGON|MULTI)/i.test(previewText.trim());
            const isIDRISI = ext === ".vct" || ext === ".vdc";

            let vdcText = "";
            if (vdcUrl) {
              try {
                const vr = await fetch(vdcUrl);
                if (vr.ok && isActive) vdcText = new TextDecoder("utf-8", { fatal: false }).decode(await vr.arrayBuffer());
              } catch {}
            }

            let features: Feature[];
            if (isSHP || isPK || isSQLite) { showNotification(`Format not supported`, "error"); return; }
            else if (isXML) features = new KML({ extractStyles: true }).readFeatures(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
            else if (isGeoJSON) {
              const fmt = new GeoJSON();
              try { features = fmt.readFeatures(fullText, { featureProjection: "EPSG:3857" }); }
              catch { features = fmt.readFeatures(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }); }
            } else if (isWKT) features = [new WKT().readFeature(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })].filter(Boolean) as Feature[];
            else if (isIDRISI) features = parseVCT(buf, vdcText);
            else features = [];

            if (!isActive || !features?.length) { showNotification(`Cannot parse "${info.name}"`, "error"); return; }

            const vectorSource = new VectorSource({ features });
            const vectorLayer = new VectorLayer({ source: vectorSource, style: defaultVectorStyle, opacity: 0 });
            vectorLayer.setZIndex(150 + Object.keys(currentLayers).length);

            if (!isActive || !new Set(Object.keys(renderedLayers)).has(layerId) || currentLayers[layerId]) return;
            if (!safeMap.getLayers().getArray().includes(vectorLayer)) {
              safeMap.addLayer(vectorLayer);
            }
            currentLayers[layerId] = vectorLayer;
            const dl2 = prebuiltLayersRef.current[activeDate] ?? {};
            dl2[layerId] = vectorLayer;
            prebuiltLayersRef.current[activeDate] = dl2;

            const targetOp = 0.7;
            if (pending && !pending.done && currentLayers[pending.oldId]) {
              const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
              animateLayer(vectorLayer, 0, targetOp, FADE_MS);
              animateLayer(old, old.getOpacity(), 0, FADE_MS).then(() => {
                removeLayerFromMap(safeMap, old, currentLayers, pending.oldId);
                for (const dl3 of Object.values(prebuiltLayersRef.current)) delete dl3[pending.oldId];
                pending.done = true;
                delete pendingReplace[prefix];
              });
            } else {
              animateLayer(vectorLayer, 0, targetOp, FADE_MS);
            }
            const extent = vectorSource.getExtent();
            if (extent && extent[0] !== Infinity) safeMap.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 16, duration: 300 });
          } catch { showNotification(`Failed to load "${info.name}"`, "error"); }
        })();
      }
    }

    return () => { isActive = false; };
  }, [renderedLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  return layerRefs;
}
