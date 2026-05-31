export type RasterLayerFormat = 'GeoTIFF' | 'COG';

export type RasterLayerStyle = {
  min: number;
  max: number;
  palette: string;
  legendLabel: string;
};

export type RasterLayerManifest = {
  id: string;
  name: string;
  description: string;
  format: RasterLayerFormat;
  crs: string;
  bbox: [number, number, number, number];
  nodata: number | null;
  opacity: number;
  style: RasterLayerStyle;
  cloudPath: string;
  previewUrl: string;
  updatedAt: string;
};

export const RASTER_LAYER_MANIFESTS: RasterLayerManifest[] = [
  {
    id: 'salinity-313-900',
    name: 'Độ mặn vùng 313-900',
    description: 'Dữ liệu độ mặn (salinity) từ file GeoTIFF UTM 48N.',
    format: 'GeoTIFF',
    crs: 'EPSG:32648',
    bbox: [594885, 1052655, 688485, 1117455],
    nodata: -9999,
    opacity: 0.8,
    style: {
      min: 0,
      max: 50,
      palette: 'blue-cyan-green-yellow-orange-red',
      legendLabel: 'Độ mặn (ppt)',
    },
    cloudPath: 'gis-data/hydrology/salinity-monitoring/2026/raster/salinity_313_900.tif',
    previewUrl: '/salinity_313_900.tif',
    updatedAt: '2026-05-22T15:07:00.000Z',
  },
];

export function listRasterLayers() {
  return RASTER_LAYER_MANIFESTS;
}

export function getRasterLayerById(layerId: string) {
  return RASTER_LAYER_MANIFESTS.find((layer) => layer.id === layerId) ?? null;
}
