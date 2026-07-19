/**
 * TiTiler configuration for XYZ tile serving
 * 
 * When enabled, raster layers use TiTiler XYZ tiles (PNG) instead of 
 * rendering GeoTIFF directly in the browser via WebGLTileLayer.
 * This reduces GPU usage, improves FPS, and accelerates load times.
 */

export interface TitilerConfig {
  /** TiTiler server URL */
  baseUrl: string;
  /** Whether TiTiler is enabled */
  enabled: boolean;
  /** Tile matrix set (default: WebMercatorQuad) */
  tileMatrixSet: string;
  /** Default colormap name for non-classified datasets */
  defaultColormap: string;
  /** Max zoom for tile requests */
  maxZoom: number;
}

export const TITILER_CONFIG: TitilerConfig = {
  baseUrl: process.env.NEXT_PUBLIC_TITILER_URL || 'http://localhost:8001',
  enabled: process.env.NEXT_PUBLIC_USE_TITILER === 'true',
  tileMatrixSet: 'WebMercatorQuad',
  defaultColormap: 'viridis',
  maxZoom: 17,
};

/**
 * Backend URL for TiTiler to fetch GeoTIFF files internally.
 * TiTiler runs on the same server, so it uses localhost to reach the backend directly.
 */
const TITILER_BACKEND_URL = process.env.NEXT_PUBLIC_TITILER_BACKEND_URL || 'http://localhost:8084';

/**
 * Colormap mapping per dataset type.
 * Uses TiTiler built-in colormap names (use `colormap_name` parameter).
 * Valid names: haline, thermal, turbo, dense, viridis, spectral, etc.
 */
export const DATASET_COLORMAPS: Record<string, string> = {
  'landuse':       'paired',          // distinct colors for classification
  'flooding':      'blues',           // sequential blue for water depth
};

/**
 * Rescale ranges per dataset type (min, max).
 * Only needed for continuous data (not classification).
 */
export const DATASET_RESCALE: Record<string, [number, number]> = {
  'flooding':       [0, 100],
};

/**
 * Build a TiTiler tile URL for a given S3 key and dataset.
 * Uses the backend render endpoint directly (TiTiler runs on same server as backend).
 */
export function buildTitilerTileUrl(
  s3Key: string,
  datasetId: string,
): string | null {
  const config = TITILER_CONFIG;
  if (!config.enabled) return null;

  // Backend render URL (TiTiler → Backend, both on localhost)
  const backendUrl = `${TITILER_BACKEND_URL}/api/s3/render?key=${encodeURIComponent(s3Key)}`;
  const encodedUrl = encodeURIComponent(backendUrl);

  // Find matching colormap
  const colormap = findColormap(datasetId);

  // Find matching rescale
  const rescale = findRescale(datasetId);
  const rescaleParam = rescale ? `&rescale=${rescale[0]},${rescale[1]}` : '';

  return `${config.baseUrl}/cog/tiles/${config.tileMatrixSet}/{z}/{x}/{y}.png`
    + `?url=${encodedUrl}`
    + `&colormap_name=${colormap}`
    + rescaleParam;
}

/**
 * Build a point query URL for TiTiler (used by inspector).
 */
export function buildTitilerPointUrl(
  s3Key: string,
  lng: number,
  lat: number,
): string | null {
  const config = TITILER_CONFIG;
  if (!config.enabled) return null;

  const backendUrl = `${TITILER_BACKEND_URL}/api/s3/render?key=${encodeURIComponent(s3Key)}`;
  const encodedUrl = encodeURIComponent(backendUrl);

  return `${config.baseUrl}/cog/point/${lng},${lat}?url=${encodedUrl}`;
}

/**
 * Find colormap for a dataset ID by matching against known patterns.
 */
function findColormap(datasetId: string): string {
  const lower = datasetId.toLowerCase();
  for (const [pattern, colormap] of Object.entries(DATASET_COLORMAPS)) {
    if (lower.includes(pattern)) {
      return colormap;
    }
  }
  return TITILER_CONFIG.defaultColormap;
}

/**
 * Find rescale range for a dataset ID.
 */
function findRescale(datasetId: string): [number, number] | null {
  const lower = datasetId.toLowerCase();
  for (const [pattern, rescale] of Object.entries(DATASET_RESCALE)) {
    if (lower.includes(pattern)) {
      return rescale;
    }
  }
  return null;
}
