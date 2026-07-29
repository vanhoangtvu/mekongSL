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
  { value: 0.01, color: [20, 20, 80, 1] },          // 0: xanh đậm
  { value: 1.5,  color: [80, 220, 255, 1] },        // 1.5: xanh lam sáng
  { value: 3,    color: [50, 240, 255, 1] },         // 3: xanh lam sáng hơn
  { value: 6,    color: [80, 255, 80, 1] },          // 6: xanh lá sáng
  { value: 10,   color: [255, 255, 50, 1] },         // 10: vàng
  { value: 15,   color: [255, 180, 50, 1] },         // 15: cam
  { value: 18,   color: [220, 50, 50, 1] },          // 18: đỏ đậm
  { value: 25,   color: [255, 255, 255, 1] },        // 25: trắng
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

export const FLOODING_STOPS: ColorStop[] = [
  { value: 0,    color: [255, 255, 255, 0] },
  { value: 0.1,  color: [215, 235, 250, 1] },
  { value: 1,    color: [170, 210, 240, 1] },
  { value: 3,    color: [100, 175, 220, 1] },
  { value: 5,    color: [50, 140, 200, 1] },
  { value: 10,   color: [20, 100, 180, 1] },
  { value: 30,   color: [10, 60, 140, 1] },
  { value: 100,  color: [5, 25, 80, 1] },
];

export const DEFAULT_STOPS: ColorStop[] = [
  { value: 0.06, color: [0, 0, 255, 1] },
  { value: 21.0, color: [255, 0, 0, 1] },
];

export const LANDSAT_STOPS: ColorStop[] = [
  { value: 0,     color: [0, 0, 0, 1] },
  { value: 0.12,  color: [128, 0, 255, 1] },
  { value: 0.24,  color: [0, 0, 255, 1] },
  { value: 0.35,  color: [0, 128, 255, 1] },
  { value: 0.47,  color: [0, 255, 255, 1] },
  { value: 0.59,  color: [0, 255, 0, 1] },
  { value: 0.71,  color: [255, 255, 0, 1] },
  { value: 0.82,  color: [255, 128, 0, 1] },
  { value: 1,     color: [255, 0, 0, 1] },
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function interpolateColor(stops: ColorStop[], value: number): RgbaColor {
  if (value <= stops[0].value) return stops[0].color;
  if (value >= stops[stops.length - 1].value) return stops[stops.length - 1].color;

  for (let i = 0; i < stops.length - 1; i++) {
    if (value >= stops[i].value && value <= stops[i + 1].value) {
      const t = (value - stops[i].value) / (stops[i + 1].value - stops[i].value);
      return [
        Math.round(lerp(stops[i].color[0], stops[i + 1].color[0], t)),
        Math.round(lerp(stops[i].color[1], stops[i + 1].color[1], t)),
        Math.round(lerp(stops[i].color[2], stops[i + 1].color[2], t)),
        lerp(stops[i].color[3], stops[i + 1].color[3], t),
      ];
    }
  }
  return stops[stops.length - 1].color;
}

export function buildQuantizedStyle(
  stops: ColorStop[],
  nodata: number,
  minVal: number,
  maxVal: number,
  numSteps = 256,
): Record<string, unknown> {
  const conditions: unknown[] = [
    ["==", ["band", 1], 0], [0, 0, 0, 0],
    ["==", ["band", 1], nodata], [0, 0, 0, 0],
  ];
  conditions.push(["<", ["band", 1], minVal], [0, 0, 0, 0]);
  conditions.push([">", ["band", 1], maxVal], [0, 0, 0, 0]);

  const scale = numSteps / (maxVal - minVal);
  const invScale = 1 / scale;

  const quantized = [
    "clamp",
    ["floor", ["*", ["-", ["band", 1], minVal], scale]],
    0,
    numSteps,
  ];

  const stepped = ["+", ["*", quantized, invScale], minVal];

  const interpolateArgs: unknown[] = ["interpolate", ["linear"], stepped];
  for (const s of stops) {
    interpolateArgs.push(s.value, s.color);
  }

  return {
    color: ["case", ...conditions, interpolateArgs],
  };
}

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

export function isLandsatBand(datasetId: string): boolean {
  const lower = datasetId.toLowerCase();
  return lower.startsWith("landsat-b") || lower === "landsat-rgb" || /^band-[1-7]$/.test(lower) || lower === "rgb";
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
    return buildQuantizedStyle(SALINITY_STOPS, nodata, 0.01, 25);
  }
  if (lowerId.includes("ph") || lowerUrl.includes("ph")) {
    return buildInterpolateStyle(PH_STOPS, nodata, 4, 9);
  }
  if (lowerId.includes("tidal") || lowerUrl.includes("tidal") || lowerId.includes("temp") || lowerUrl.includes("water-level")) {
    return buildInterpolateStyle(WATER_LEVEL_STOPS, nodata, -100, 200);
  }

  if (lowerId.includes("flooding")) {
    return buildInterpolateStyle(FLOODING_STOPS, nodata, 0, 100);
  }

  if (isLandsatBand(lowerId)) {
    return buildInterpolateStyle(LANDSAT_STOPS, nodata);
  }

  return buildInterpolateStyle(DEFAULT_STOPS, nodata);
}
