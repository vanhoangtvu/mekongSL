import { TIMELAPSE_STOPS } from "../../lib/constants/raster-colors";

const COLOR_STOPS: { value: number; color: [number, number, number] }[] = TIMELAPSE_STOPS.map(s => ({
  value: s.value,
  color: [s.color[0], s.color[1], s.color[2]] as [number, number, number],
}));

function rampColor(value: number, nodata: number): [number, number, number, number] {
  if (value <= nodata || value <= -9999 || value < 0.06) return [0, 0, 0, 0];
  if (value >= 21) return [...COLOR_STOPS[COLOR_STOPS.length - 1].color, 255];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (value <= COLOR_STOPS[i + 1].value) {
      const t = (value - COLOR_STOPS[i].value) / (COLOR_STOPS[i + 1].value - COLOR_STOPS[i].value);
      return [
        Math.round(COLOR_STOPS[i].color[0] + (COLOR_STOPS[i + 1].color[0] - COLOR_STOPS[i].color[0]) * t),
        Math.round(COLOR_STOPS[i].color[1] + (COLOR_STOPS[i + 1].color[1] - COLOR_STOPS[i].color[1]) * t),
        Math.round(COLOR_STOPS[i].color[2] + (COLOR_STOPS[i + 1].color[2] - COLOR_STOPS[i].color[2]) * t),
        255,
      ];
    }
  }

  return [...COLOR_STOPS[COLOR_STOPS.length - 1].color, 255];
}

/**
 * Blend two raster frames at the raw-data level, then apply the color ramp once.
 * Returns ImageData ready to `putImageData()` onto a canvas.
 * v1 = from frame, v2 = to frame, t = 0..1 mix factor.
 */
export function blendRasterData(
  v1: Float32Array,
  v2: Float32Array,
  t: number,
  width: number,
  height: number,
  nodata: number,
): ImageData {
  const total = width * height;
  if (v1.length < total || v2.length < total) return new ImageData(1, 1);
  const imageData = new ImageData(width, height);
  for (let i = 0; i < total; i++) {
    const raw = v1[i] * (1 - t) + v2[i] * t;
    const [r, g, b, a] = rampColor(raw, nodata);
    const offset = i * 4;
    imageData.data[offset] = r;
    imageData.data[offset + 1] = g;
    imageData.data[offset + 2] = b;
    imageData.data[offset + 3] = a;
  }
  return imageData;
}
