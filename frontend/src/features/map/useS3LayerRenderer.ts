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
import { getRasterStyle, isLandsatBand } from "../../lib/constants/raster-colors";

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

const LAND_NAMES: Record<string, string> = {
  'BHK':'Rural Residential','CLN':'Perennial Crops','LUC':'Rice Paddy','NTS':'Aquaculture',
  'LUA':'Upland Rice','SKC':'Construction Materials','ONT':'Urban Residential','DGD':'Education',
  'DHT':'Mixed Use','DVH':'Cultural','TTN':'Cropland','NTD':'Housing',
  'NKH':'Scientific Aquaculture','CQP':'Government Office','CTS':'Public Works','DRA':'Waterways',
  'DTT':'Special Use','ODT':'Urban Land','CAN':'Fruit Trees','DDT':'Heritage Site',
  'CSD':'Production Facility','DYT':'Healthcare','SKX':'Business','RSX':'Production Forest',
  'RPH':'Auxiliary Border','SKK':'Canal','SON':'River','COC':'Root Crops',
  'DTL':'Tourism','DGT':'Transportation','RSM':'Surface Water','PNK':'Other Non-Agri',
  'BKS':'Alluvial Land','DON':'Defense','TMD':'Commercial Services','TSC':'Non-Agri Production',
  'TIN':'Religious','SHT':'Community','DLT':'Eco-Tourism','DXH':'Social Land',
  'CKH':'Annual Crops','LNK':'Forestry','HNK':'Mixed Agri-Forestry','PHT':'Ancillary',
  'MTC':'Specialized Water','GPC':'Family Land','NHA':'Residential','OTH':'Other',
  'TON':'Canal / River','DCH':'Community Center','RPN':'Boundary Marker','DSH':'Activity Land',
  'DBV':'Cultural Monument','BCS':'Public Works',
};

function landuseStyleFunction(feature: any): Style {
  const geomType = feature.getGeometry()?.getType();
  const color = feature.get('_color');
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
    return new Style({
      stroke: new Stroke({ color: '#333', width: 0.4 }),
      fill: new Fill({ color: (color || '#ccc') + 'cc' }),
    });
  }
  return new Style({
    stroke: new Stroke({ color: '#555', width: 0.7 }),
  });
}

function vctStyleFunction(attrName: string): (feature: any) => Style {
  return (feature: any) => {
    const val = feature.get(attrName || '_vct_attr');
    const num = Number(val);
    const hue = !isNaN(num) ? ((num * 60) % 360) : 0;
    return new Style({
      stroke: new Stroke({ color: `hsl(${hue}, 70%, 50%)`, width: 1.5 }),
    });
  };
}

const FADE_MS = 700;

function animateLayer(
  layer: WebGLTileLayer | VectorLayer,
  from: number,
  to: number,
  duration: number,
  linkedLayer?: WebGLTileLayer | VectorLayer,
  targetTotal = 0.7,
): Promise<void> {
  if (from === to) return Promise.resolve();
  return new Promise((resolve) => {
    const start = performance.now();

    function step(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      
      const currentOpacity = from + (to - from) * t;
      layer.setOpacity(currentOpacity);

      if (linkedLayer) {
        if (to > from) {
          linkedLayer.setOpacity(Math.max(0, targetTotal - currentOpacity));
        }
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
  if (!map) return;
  map.removeLayer(layer);
  const src = layer.getSource?.();
  if (src && typeof src === "object" && "dispose" in src) {
    try { (src as { dispose: () => void }).dispose(); } catch {}
  }
  delete refs[id];
}

function detectVctUtm(v: DataView, geomType: number): boolean {
  try {
    let coordOff = 0x105;
    if (geomType === 1) {
      coordOff += 8;
    } else {
      coordOff += 40;
      const nParts = v.getUint32(coordOff, true);
      if (geomType === 2) {
        coordOff += 4;
      } else {
        coordOff += 8;
        if (nParts > 1) coordOff += nParts * 4;
        else coordOff += 4;
      }
    }
    if (coordOff + 16 > v.byteLength) return false;
    const x = v.getFloat64(coordOff, true);
    const y = v.getFloat64(coordOff + 8, true);
    return Math.abs(x) > 180 || Math.abs(y) > 90;
  } catch { return false; }
}

function parseVCT(buf: ArrayBuffer, vdcText: string): { features: Feature[]; attrName: string } {
  const v = new DataView(buf);
  const geomType = v.getUint8(0);
  if (geomType < 1 || geomType > 3) return { features: [], attrName: "" };

  let srcProj = "EPSG:4326";
  let attrName = "";
  let attrIsInt = false;
  if (vdcText) {
    const refSys = (vdcText.match(/ref\.\s*system\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    const refUnits = (vdcText.match(/ref\.\s*units\s*[: ]+(\S+)/i)?.[1] ?? "").toLowerCase();
    if (refSys.startsWith("utm-")) {
      const zone = refSys.match(/utm-(\d+)/)?.[1];
      srcProj = zone ? `EPSG:326${zone.padStart(2, "0")}` : "EPSG:32648";
    } else if (refUnits === "m" || refSys === "plane") {
      srcProj = "EPSG:32648";
    }
    // Parse first column definition from VDC
    const colMatch = vdcText.match(/column\s+\d+\s*:\s*(.+)/i);
    if (colMatch) {
      attrName = colMatch[1].trim();
      const typeMatch = vdcText.match(/type\s*:\s*(.+)/i);
      if (typeMatch) attrIsInt = typeMatch[1].trim().toLowerCase() === "integer";
    }
  } else if (detectVctUtm(v, geomType)) {
    srcProj = "EPSG:32648";
  }

  const toWeb = (x: number, y: number): [number, number] =>
    transform([x, y], srcProj, "EPSG:3857") as [number, number];

  const features: Feature[] = [];
  let offset = 0x105;
  const setAttr = (f: Feature) => {
    const raw = v.getFloat64(offset, true);
    if (attrName) {
      f.set(attrName, attrIsInt ? Math.round(raw) : raw);
    } else {
      f.set('_vct_attr', raw);
    }
  };
  try {
    while (offset < buf.byteLength) {
      if (geomType === 1) {
        if (offset + 24 > buf.byteLength) break;
        const f = new Feature({ geometry: new OLPoint(toWeb(v.getFloat64(offset + 8, true), v.getFloat64(offset + 16, true))) });
        setAttr(f);
        features.push(f);
        offset += 24;
      } else if (geomType === 2) {
        if (offset + 44 > buf.byteLength) break;
        const lineF = new Feature();
        setAttr(lineF);
        offset += 40;
        const nNodes = v.getUint32(offset, true);
        offset += 4;
        if (nNodes === 0 || offset + nNodes * 16 > buf.byteLength) { offset += nNodes * 16; continue; }
        const coords: [number, number][] = [];
        for (let i = 0; i < nNodes; i++) {
          coords.push(toWeb(v.getFloat64(offset, true), v.getFloat64(offset + 8, true)));
          offset += 16;
        }
        lineF.setGeometry(new OLLineString(coords));
        features.push(lineF);
      } else {
        if (offset + 48 > buf.byteLength) break;
        const polyF = new Feature();
        setAttr(polyF);
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
        polyF.setGeometry(new OLPolygon(rings));
        features.push(polyF);
      }
    }
  } catch { /* truncated */ }
  return { features, attrName };
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
  targetOpacity = 0.7,
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
      if (newByPrefix[prefix] && !pendingReplace[prefix]) {
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

        const dsPrefix = getPrefix(id);

        const cachedSrc = sourceCacheRef?.current?.get(id);
        const source = cachedSrc?.ready
          ? cachedSrc.source
          : new GeoTIFF({
              sources: [{ url, nodata: info.nodata }],
              convertToRGB: false,
              normalize: isLandsatBand(dsPrefix),
              interpolate: false,
              projection: "EPSG:32648",
            });

        const rasterStyle = getRasterStyle(dsPrefix, url, info.nodata);

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
          
          // Populate source cache for future reuse
          if (sourceCacheRef && !sourceCacheRef.current.has(id)) {
            sourceCacheRef.current.set(id, { source, ready: true });
          }

          const targetOp = targetOpacity;

          if (targetOpacity > 0.7) {
            // Playback: instant opacity, skip fade
            rasterLayer.setOpacity(targetOp);
            if (pending && !pending.done && currentLayers[pending.oldId]) {
              const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;
              removeLayerFromMap(safeMap, old, currentLayers, pending.oldId);
              for (const dlX of Object.values(prebuiltLayersRef.current)) delete dlX[pending.oldId];
              pending.done = true;
              delete pendingReplace[prefix];
            }
          } else if (pending && !pending.done && currentLayers[pending.oldId]) {
            const old = currentLayers[pending.oldId] as WebGLTileLayer | VectorLayer;

            // Strict Opacity Sync: new layer controls old layer to keep sum at targetOpacity
            animateLayer(rasterLayer, 0, targetOp, FADE_MS, old, targetOpacity).then(() => {
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
            let vctAttrName = "";
            if (isSHP || isPK || isSQLite) { showNotification(`Format not supported`, "error"); return; }
            else if (isXML) features = new KML({ extractStyles: true }).readFeatures(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });
            else if (isGeoJSON) {
              const fmt = new GeoJSON();
              const coordMatch = fullText.match(/-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/);
              if (coordMatch) {
                const [x, y] = coordMatch[0].split(',').map(Number);
                const dataProj = Math.abs(x) > 180 || Math.abs(y) > 90 ? "EPSG:32648" : "EPSG:4326";
                features = fmt.readFeatures(fullText, { dataProjection: dataProj, featureProjection: "EPSG:3857" });
              } else {
                features = fmt.readFeatures(fullText, { featureProjection: "EPSG:3857" });
              }
            } else if (isWKT) features = [new WKT().readFeature(fullText, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })].filter(Boolean) as Feature[];
            else if (isIDRISI) {
              const result = parseVCT(buf, vdcText);
              features = result.features;
              vctAttrName = result.attrName;
            }
            else features = [];

            if (!isActive || !features?.length) { showNotification(`Cannot parse "${info.name}"`, "error"); return; }

            const isLanduse = id.startsWith('baseline-landuse-plan');
            const useVctStyle = vctAttrName || features.some(f => f.get('_vct_attr') !== undefined);
            const vectorStyle: any = isLanduse
              ? landuseStyleFunction
              : useVctStyle
                ? vctStyleFunction(vctAttrName || '_vct_attr')
                : defaultVectorStyle;
            const vectorSource = new VectorSource({ features });
            const vectorLayer = new VectorLayer({ source: vectorSource, style: vectorStyle, opacity: 0 });
            if (isLanduse) {
              vectorLayer.set('_landuseLayer', true);
              // Pre-compute per-code area stats for % of Total in popup
              let totalAreaHa = 0;
              const codeAreaHa: Record<string, number> = {};
              const codeColor: Record<string, string> = {};
              const feats = vectorSource.getFeatures();
              for (let fi = 0; fi < feats.length; fi++) {
                const f = feats[fi];
                const g = f.getGeometry();
                if (!g) continue;
                const gt = g.getType();
                if (gt !== 'Polygon' && gt !== 'MultiPolygon') continue;
                const code = f.get('_code') as string;
                if (!code) continue;
                let a = 0;
                try {
                  const gt = g.getType();
                  if (gt === 'Polygon' || gt === 'MultiPolygon') {
                    const poly = g.clone().transform('EPSG:3857', 'EPSG:4326') as any;
                    const coords = poly.getCoordinates();
                    const polys = gt === 'MultiPolygon' ? coords : [coords];
                    for (let p = 0; p < polys.length; p++) {
                      const ring = polys[p][0];
                      for (let i = 0; i < ring.length - 1; i++) {
                        const x1 = ring[i][0] * 111320 * Math.cos(ring[i][1] * Math.PI / 180);
                        const y1 = ring[i][1] * 110540;
                        const x2 = ring[i + 1][0] * 111320 * Math.cos(ring[i + 1][1] * Math.PI / 180);
                        const y2 = ring[i + 1][1] * 110540;
                        a += x1 * y2 - x2 * y1;
                      }
                    }
                    a = Math.abs(a) / 20000;
                  }
                } catch {}
                totalAreaHa += a;
                if (!codeAreaHa[code]) codeAreaHa[code] = 0;
                codeAreaHa[code] += a;
                if (!codeColor[code]) codeColor[code] = (f.get('_color') as string) || '#ccc';
              }
              vectorLayer.set('_luStats', { totalAreaHa, codeAreaHa, codeColor });
            }
            vectorLayer.setZIndex(150 + Object.keys(currentLayers).length);

            if (!isActive || !new Set(Object.keys(renderedLayers)).has(layerId) || currentLayers[layerId]) return;
            if (!safeMap.getLayers().getArray().includes(vectorLayer)) {
              safeMap.addLayer(vectorLayer);
            }
            currentLayers[layerId] = vectorLayer;
            const dl2 = prebuiltLayersRef.current[activeDate] ?? {};
            dl2[layerId] = vectorLayer;
            prebuiltLayersRef.current[activeDate] = dl2;

            const targetOp = targetOpacity;
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
