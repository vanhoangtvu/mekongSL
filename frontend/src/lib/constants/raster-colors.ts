export type RgbaColor = [number, number, number, number];

export type ColorStop = {
  value: number;
  color: RgbaColor;
};

// ── Classified (name-based) dataset colors ──

export type ClassifiedColorEntry = {
  idPattern: string;
  color: RgbaColor;
  name: string;
};

export const LANDUSE_COLORS: ClassifiedColorEntry[] = [
  { idPattern: "aquaculture",     color: [0, 0, 255, 1],     name: "Blue" },
  { idPattern: "rice-shrimp",     color: [128, 128, 128, 1], name: "Gray" },
  { idPattern: "perennial-crops", color: [0, 128, 0, 1],     name: "Green" },
  { idPattern: "residential-land",color: [255, 0, 0, 1],     name: "Red" },
  { idPattern: "coconut-garden",  color: [128, 0, 128, 1],   name: "Purple" },
  { idPattern: "vegetable-crops", color: [0, 0, 0, 1],       name: "Black" },
  { idPattern: "rice-cultivation",color: [255, 255, 0, 1],   name: "Yellow" },
];

// ── Continuous (value-based) color ramps ──

export const SALINITY_STOPS: ColorStop[] = [
  { value: 0.01, color: [3, 1, 15, 1] },         // gần đen
  { value: 0.5,  color: [15, 8, 45, 1] },         // xanh dương tím đậm
  { value: 1.5,  color: [35, 20, 90, 1] },        // xanh dương tím
  { value: 6,    color: [0, 130, 60, 1] },         // xanh lá đậm
  { value: 12,   color: [255, 230, 0, 1] },        // vàng tươi
  { value: 17,   color: [255, 140, 0, 1] },        // cam
  { value: 20,   color: [255, 30, 30, 1] },        // đỏ tươi
  { value: 23,   color: [180, 0, 20, 1] },         // đỏ sẫm
  { value: 25,   color: [200, 30, 100, 1] },       // đỏ hồng
];

export const PH_STOPS: ColorStop[] = [
  { value: 4,    color: [0, 0, 0, 1] },
  { value: 5.25, color: [0, 0, 255, 1] },
  { value: 6.5,  color: [0, 255, 0, 1] },
  { value: 7.75, color: [255, 255, 0, 1] },
  { value: 9,    color: [255, 0, 0, 1] },
];

export const WATER_LEVEL_STOPS: ColorStop[] = [
  { value: -100,  color: [0, 0, 0, 1] },
  { value: -25,   color: [0, 0, 255, 1] },
  { value: 0.001, color: [0, 255, 0, 1] },
  { value: 100,   color: [255, 255, 0, 1] },
  { value: 200,   color: [255, 0, 0, 1] },
];

export const DEFAULT_STOPS: ColorStop[] = [
  { value: 0.06, color: [0, 0, 255, 1] },
  { value: 21.0, color: [255, 0, 0, 1] },
];

export const TIMELAPSE_STOPS: ColorStop[] = [
  { value: 0.06, color: [0, 0, 255, 1] },
  { value: 5,   color: [0, 255, 255, 1] },
  { value: 10,  color: [0, 255, 0, 1] },
  { value: 15,  color: [255, 255, 0, 1] },
  { value: 20,  color: [255, 165, 0, 1] },
  { value: 21,  color: [255, 0, 0, 1] },
];

// ── Helper: build WebGL style expressions ──

export function buildInterpolateStyle(
  stops: ColorStop[],
  nodata: number,
  minVal?: number,
  maxVal?: number,
): Record<string, unknown> {
  const conditions: unknown[] = [
    ["==", ["band", 1], 0], [0, 0, 0, 0],
    ["==", ["band", 1], nodata], [0, 0, 0, 0],
  ];
  if (minVal !== undefined) {
    conditions.push(["<", ["band", 1], minVal], [0, 0, 0, 0]);
  }
  if (maxVal !== undefined) {
    conditions.push([">", ["band", 1], maxVal], [0, 0, 0, 0]);
  }

  const interpolateArgs: unknown[] = ["interpolate", ["linear"], ["band", 1]];
  for (const s of stops) {
    interpolateArgs.push(s.value, s.color);
  }

  return {
    color: ["case", ...conditions, interpolateArgs],
  };
}

export function buildClassifiedStyle(
  color: RgbaColor,
  nodata: number,
): Record<string, unknown> {
  return {
    color: [
      "case",
      ["==", ["band", 1], 0], [0, 0, 0, 0],
      ["==", ["band", 1], nodata], [0, 0, 0, 0],
      color,
    ],
  };
}

export function getLanduseColor(datasetId: string): RgbaColor | null {
  const lower = datasetId.toLowerCase();
  for (const entry of LANDUSE_COLORS) {
    if (lower.includes(entry.idPattern)) {
      return entry.color;
    }
  }
  return null;
}

export function getRasterStyle(
  datasetId: string,
  url: string,
  nodata: number,
): Record<string, unknown> {
  const lowerId = datasetId.toLowerCase();
  const lowerUrl = url.toLowerCase();

  for (const entry of LANDUSE_COLORS) {
    if (lowerId.includes(entry.idPattern) || lowerUrl.includes(entry.idPattern)) {
      return buildClassifiedStyle(entry.color, nodata);
    }
  }

  if (lowerId.includes("salinity") || lowerUrl.includes("salinity")) {
    return buildInterpolateStyle(SALINITY_STOPS, nodata, 0.01, 25);
  }
  if (lowerId.includes("ph") || lowerUrl.includes("ph")) {
    return buildInterpolateStyle(PH_STOPS, nodata, 4, 9);
  }
  if (lowerId.includes("tidal") || lowerUrl.includes("tidal") || lowerId.includes("temp") || lowerUrl.includes("water-level")) {
    return buildInterpolateStyle(WATER_LEVEL_STOPS, nodata, -100, 200);
  }

  return buildInterpolateStyle(DEFAULT_STOPS, nodata);
}
