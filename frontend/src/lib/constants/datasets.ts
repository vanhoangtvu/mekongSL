export type TimeScale = "year" | "day" | "hour";

export type DatasetItem = {
  id: string;
  name: string;
  slug?: string;
  children?: DatasetItem[];
  source?: string;
  scale?: string;
  gisData?: boolean;
  group?: "gis" | "station" | "monitoring";
  type?: string;
  timeScale?: TimeScale;
};

export const DATASETS: DatasetItem[] = [
  // ── GIS Data ──────────────────────────────────────────────
  {
    id: "landsat",
    name: "Landsat Imagery",
    slug: "landsat-imagery",
    group: "gis",
    children: [
      { id: "landsat-b1", name: "Band 1", slug: "band-1", type: "raster", timeScale: "year" },
      { id: "landsat-b2", name: "Band 2", slug: "band-2", type: "raster", timeScale: "year" },
      { id: "landsat-b3", name: "Band 3", slug: "band-3", type: "raster", timeScale: "year" },
      { id: "landsat-b4", name: "Band 4", slug: "band-4", type: "raster", timeScale: "year" },
      { id: "landsat-b5", name: "Band 5", slug: "band-5", type: "raster", timeScale: "year" },
      { id: "landsat-b6", name: "Band 6", slug: "band-6", type: "raster", timeScale: "year" },
      { id: "landsat-b7", name: "Band 7", slug: "band-7", type: "raster", timeScale: "year" },
      { id: "landsat-rgb", name: "Composite (RGB)", slug: "rgb", type: "raster", timeScale: "year" },
    ],
  },
  {
    id: "admin",
    name: "Administration",
    slug: "administration",
    group: "gis",
    children: [
      { id: "admin-province", name: "Province", slug: "province", source: "GIS website Vinh Long", scale: "Province scale", timeScale: "year" },
      { id: "admin-community", name: "Community", slug: "community", scale: "Province scale", timeScale: "year" },
      { id: "admin-hamlet", name: "Hamlet", slug: "hamlet", scale: "Province scale", timeScale: "year" },
    ],
  },
  {
    id: "baseline",
    name: "Baseline Environment",
    slug: "baseline-environment",
    group: "gis",
    children: [
      {
        id: "baseline-landuse-plan",
        name: "Landuse Planning",
        slug: "landuse-planning",
        scale: "Province, Community",
        children: [
          { id: "baseline-landuse-plan/tra-vinh-chau-thanh", name: "Trà Vinh – Châu Thành District", slug: "tra-vinh-chau-thanh", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-cang-long", name: "Trà Vinh – Càng Long District", slug: "tra-vinh-cang-long", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-cau-ke", name: "Trà Vinh – Cầu Kè District", slug: "tra-vinh-cau-ke", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-tieu-can", name: "Trà Vinh – Tiểu Cần District", slug: "tra-vinh-tieu-can", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-cau-ngang", name: "Trà Vinh – Cầu Ngang District", slug: "tra-vinh-cau-ngang", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-tra-cu", name: "Trà Vinh – Trà Cú District", slug: "tra-vinh-tra-cu", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-duyen-hai", name: "Trà Vinh – Duyên Hải District", slug: "tra-vinh-duyen-hai", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-city", name: "Trà Vinh – Trà Vinh City", slug: "tra-vinh-city", timeScale: "year" },
          { id: "baseline-landuse-plan/tra-vinh-duyen-hai-town", name: "Trà Vinh – Duyên Hải Town", slug: "tra-vinh-duyen-hai-town", timeScale: "year" },
        ],
      },
      { id: "baseline-soil", name: "Soil Type", slug: "soil-type", scale: "Province", timeScale: "year" },
      {
        id: "baseline-channel",
        name: "Channel System",
        slug: "channel-system",
        scale: "Province",
        children: [
          { id: "channel-system/main-river", name: "Main River", slug: "main-river", timeScale: "year" },
          {
            id: "channel-system/canal", name: "Canal", slug: "canal",
            children: [
              { id: "channel-system/canal/main", name: "Main Canal", slug: "main-canal", timeScale: "year" },
              { id: "channel-system/canal/field-ditch", name: "Field Ditch", slug: "field-ditch", timeScale: "year" },
            ],
          },
          { id: "channel-system/transport", name: "Transportation", slug: "transport", timeScale: "year" },
          { id: "channel-system/dike", name: "Dike", slug: "dike", timeScale: "year" },
          { id: "channel-system/hydraulic-works", name: "Hydraulic Works", slug: "hydraulic-works", timeScale: "year" },
          { id: "channel-system/bridge", name: "Bridge", slug: "bridge", timeScale: "year" },
          { id: "channel-system/residential", name: "Residential Area", slug: "residential", timeScale: "year" },
          { id: "channel-system/pump-station", name: "Pump Station", slug: "pump-station", timeScale: "year" },
        ],
      },
      { id: "baseline-groundwater", name: "Ground Water Storage", slug: "ground-water-storage", scale: "Province", timeScale: "year" },
      { id: "baseline-road", name: "Road", slug: "road", scale: "Province", timeScale: "year" },
      {
        id: "baseline-landuse-class",
        name: "Landuse Classification",
        slug: "landuse-classification",
        source: "Landsat GIS Interpretation",
        children: [
          { id: "landuse-classification/aquaculture", name: "Aquaculture and Water Surface Lands", timeScale: "year" },
          { id: "landuse-classification/rice-shrimp", name: "Rice-to-shrimp conversion area or Intensive shrimp farming", timeScale: "year" },
          { id: "landuse-classification/perennial-crops", name: "Perennial crops, Fruit Orchards and Mangrove Forests", timeScale: "year" },
          { id: "landuse-classification/residential-land", name: "Residential Land and Sandy Ridge Land", timeScale: "year" },
          { id: "landuse-classification/coconut-garden", name: "Coconut Plantation, mix garden", timeScale: "year" },
          { id: "landuse-classification/vegetable-crops", name: "Vegetable and Upland Crop Area", timeScale: "year" },
          { id: "landuse-classification/rice-cultivation", name: "Rice Cultivation Zone", timeScale: "year" },
        ],
      },
    ],
  },
  {
    id: "ecology",
    name: "Ecology",
    slug: "ecology",
    group: "gis",
    children: [
      { id: "ecology-biodiversity", name: "Biodiversity", slug: "biodiversity", scale: "Province", timeScale: "year" },
      { id: "ecology-vegetation", name: "Vegetation Index", slug: "vegetation-index", source: "Landsat GIS Interpretation", timeScale: "year" },
      { id: "ecology-habitat", name: "Habitat Mapping", slug: "habitat-mapping", scale: "Province", timeScale: "year" },
      { id: "ecology-species", name: "Species Distribution", slug: "species-distribution", timeScale: "year" },
      { id: "ecology-mangroves", name: "Mangroves", slug: "mangroves", source: "Landsat GIS Interpretation", timeScale: "year" },
    ],
  },
  {
    id: "flooding",
    name: "Flooding Modeling",
    slug: "flooding-modeling",
    group: "gis",
    timeScale: "year",
  },
  {
    id: "hydrology",
    name: "Hydrology",
    slug: "hydrology",
    group: "gis",
    children: [
      { id: "hydro-salinity", name: "Salinity", slug: "salinity", type: "raster", timeScale: "hour" },
      { id: "hydro-temp", name: "Tidal", slug: "tidal", type: "raster", timeScale: "hour" },
      { id: "hydro-ph", name: "pH", slug: "ph", type: "raster", timeScale: "hour" },
    ],
  },
  // ── Station Data ──────────────────────────────────────────
  {
    id: "weather",
    name: "Weather",
    slug: "weather",
    group: "station",
    timeScale: "year",
  },
  // ── Monitoring Data ───────────────────────────────────────
  {
    id: "water-quality",
    name: "Water Quality",
    slug: "water-quality",
    group: "monitoring",
    children: [
      { id: "wq-surface", name: "Surface Water", slug: "surface-water", scale: "Province scale", timeScale: "year" },
      { id: "wq-ground", name: "Ground Water", slug: "ground-water", scale: "Province scale", timeScale: "year" },
    ],
  },
];

function findSlug(items: DatasetItem[], id: string): string | undefined {
  for (const ds of items) {
    if (ds.id === id) return ds.slug || ds.id;
    if (ds.children) {
      const found = findSlug(ds.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function getDatasetSlug(id: string): string | undefined {
  return findSlug(DATASETS, id);
}

function findById(items: DatasetItem[], id: string): DatasetItem | undefined {
  for (const ds of items) {
    if (ds.id === id) return ds;
    if (ds.children) {
      const found = findById(ds.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function getDatasetById(id: string): DatasetItem | undefined {
  return findById(DATASETS, id);
}

function findParent(items: DatasetItem[], childId: string): DatasetItem | undefined {
  for (const ds of items) {
    if (ds.children?.some((c) => c.id === childId)) return ds;
    if (ds.children) {
      const found = findParent(ds.children, childId);
      if (found) return found;
    }
  }
  return undefined;
}

export function getParentDataset(childId: string): DatasetItem | undefined {
  return findParent(DATASETS, childId);
}

export function getRootDataset(childId: string): DatasetItem | undefined {
  let current = getDatasetById(childId);
  if (!current) return undefined;
  while (true) {
    const parent = getParentDataset(current.id);
    if (!parent) return current;
    current = parent;
  }
}

export function getTimeScale(datasetId: string): TimeScale {
  return getDatasetById(datasetId)?.timeScale || "year";
}

export function buildGisS3Path(
  datasetId: string,
  categoryId: string,
  year: number,
  dataType: 'raster' | 'vector',
  filename: string,
  month?: number,
  day?: number,
  time?: string
): string {
  const dsSlug = getDatasetSlug(datasetId) || datasetId;
  const catSlug = getDatasetSlug(categoryId) || categoryId;
  let path = `gis-data/${dsSlug}/${catSlug}/${year}`;

  if (month !== undefined) {
    path += `/${String(month).padStart(2, '0')}`;
    if (day !== undefined) {
      path += `/${String(day).padStart(2, '0')}`;
      if (time) {
        path += `/${time.replace(':', '-')}`;
      }
    }
  }

  path += `/${dataType}/${filename}`;
  return path;
}

export function buildStationS3Path(
  stationDataType: string,
  stationCode: string,
  parameter: string,
  year: number,
  month: number,
  day: number,
  time: string,
  filename: string
): string {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const t = time ? time.replace(':', '-') : '00-00';
  return `station-data/${stationDataType}/${stationCode}/${parameter}/${y}/${m}/${d}/${t}/${filename}`;
}

export function buildMonitoringS3Path(
  monitoringCode: string,
  parameter: string,
  year: number,
  month: number,
  day: number,
  time: string,
  filename: string
): string {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const t = time ? time.replace(':', '-') : '00-00';
  return `monitoring-data/${monitoringCode}/${parameter}/${y}/${m}/${d}/${t}/${filename}`;
}

export const AREA_TYPES = ["Point", "Line", "Polygon", "Grid"];
