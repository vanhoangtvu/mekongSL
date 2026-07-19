export interface WorkerResult {
  id: string;
  geoJSON?: GeoJSONFeatureCollection;
  vctFeatures?: VCTFeature[];
  error?: string;
}

interface GeoJSONFeatureCollection {
  type: string;
  features: Array<{ type: string; geometry: unknown; properties: Record<string, unknown> }>;
}

interface VCTFeature {
  type: number;
  attr: number;
  coords: number[][][] | number[][] | number[];
}

self.onmessage = (e: MessageEvent<{ id: string; type: string; buf: ArrayBuffer }>) => {
  const { id, type, buf } = e.data;

  try {
    if (type === "geojson") {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      const parsed = JSON.parse(text);
      if (parsed?.type === 'FeatureCollection' || parsed?.features) {
        self.postMessage({ id, geoJSON: parsed } as WorkerResult);
      } else {
        self.postMessage({ id, error: "Not a valid GeoJSON FeatureCollection" } as WorkerResult);
      }
      return;
    }

    if (type === "vct") {
      const view = new DataView(buf);
      const geomType = view.getUint8(0);
      if (geomType < 1 || geomType > 3) {
        self.postMessage({ id, error: "Invalid VCT geometry type" } as WorkerResult);
        return;
      }

      const features: VCTFeature[] = [];
      let offset = 0x105;

      while (offset < buf.byteLength) {
        if (geomType === 1) {
          if (offset + 24 > buf.byteLength) break;
          features.push({
            type: 1,
            attr: view.getFloat64(offset, true),
            coords: [view.getFloat64(offset + 8, true), view.getFloat64(offset + 16, true)],
          });
          offset += 24;
        } else if (geomType === 2) {
          if (offset + 44 > buf.byteLength) break;
          const attr = view.getFloat64(offset, true);
          offset += 40;
          const nNodes = view.getUint32(offset, true);
          offset += 4;
          if (nNodes === 0 || offset + nNodes * 16 > buf.byteLength) { offset += nNodes * 16; continue; }
          const coords: number[][] = [];
          for (let i = 0; i < nNodes; i++) {
            coords.push([view.getFloat64(offset, true), view.getFloat64(offset + 8, true)]);
            offset += 16;
          }
          features.push({ type: 2, attr, coords });
        } else {
          if (offset + 48 > buf.byteLength) break;
          const attr = view.getFloat64(offset, true);
          offset += 40;
          const nParts = view.getUint32(offset, true);
          const nTotalNodes = view.getUint32(offset + 4, true);
          offset += 8;
          if (nParts === 0 || nTotalNodes === 0 || nParts > 100000 || nTotalNodes > 10_000_000) break;
          const nodeCounts: number[] = [];
          if (nParts > 1) {
            if (offset + nParts * 4 > buf.byteLength) break;
            for (let i = 0; i < nParts; i++) { nodeCounts.push(view.getUint32(offset, true)); offset += 4; }
          } else {
            if (offset + 4 > buf.byteLength) break;
            nodeCounts.push(view.getUint32(offset, true));
            offset += 4;
          }
          if (offset + nTotalNodes * 16 > buf.byteLength) break;
          const rings: number[][][] = [];
          for (let p = 0; p < nParts; p++) {
            const ring: number[][] = [];
            for (let i = 0; i < nodeCounts[p]; i++) {
              ring.push([view.getFloat64(offset, true), view.getFloat64(offset + 8, true)]);
              offset += 16;
            }
            rings.push(ring);
          }
          features.push({ type: 3, attr, coords: rings });
        }
      }

      self.postMessage({ id, vctFeatures: features } as WorkerResult);
      return;
    }

    self.postMessage({ id, error: `Unknown type: ${type}` } as WorkerResult);
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } as WorkerResult);
  }
};
