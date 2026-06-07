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
};

export const DATASETS: DatasetItem[] = [
  // ── GIS Data ──────────────────────────────────────────────
  {
    id: "landsat",
    name: "Landsat Imagery",
    slug: "landsat-imagery",
    group: "gis",
    children: [
      { id: "landsat-b1", name: "Band 1", slug: "band-1", type: "raster" },
      { id: "landsat-b2", name: "Band 2", slug: "band-2", type: "raster" },
      { id: "landsat-b3", name: "Band 3", slug: "band-3", type: "raster" },
      { id: "landsat-b4", name: "Band 4", slug: "band-4", type: "raster" },
      { id: "landsat-b5", name: "Band 5", slug: "band-5", type: "raster" },
      { id: "landsat-b6", name: "Band 6", slug: "band-6", type: "raster" },
      { id: "landsat-b7", name: "Band 7", slug: "band-7", type: "raster" },
      { id: "landsat-rgb", name: "Composite (RGB)", slug: "rgb", type: "raster" },
    ],
  },
  {
    id: "admin",
    name: "Administration",
    slug: "administration",
    group: "gis",
    children: [
      { id: "admin-province", name: "Province", slug: "province", source: "GIS website Vinh Long", scale: "Province scale" },
      { id: "admin-community", name: "Community", slug: "community", scale: "Province scale" },
      { id: "admin-hamlet", name: "Hamlet", slug: "hamlet", scale: "Province scale" },
    ],
  },
  {
    id: "baseline",
    name: "Baseline Environment",
    slug: "baseline-environment",
    group: "gis",
    children: [
      { id: "baseline-landuse-plan", name: "Landuse Planning", slug: "landuse-planning", scale: "Province, Community" },
      { id: "baseline-soil", name: "Soil Type", slug: "soil-type", scale: "Province" },
      { id: "baseline-waterbody", name: "Water Body", slug: "water-body", scale: "Province" },
      {
        id: "baseline-channel",
        name: "Channel System",
        slug: "channel-system",
        scale: "Province",
        children: [
          { id: "channel-system/river", name: "River", slug: "river" },
          { id: "channel-system/canal", name: "Canal", slug: "canal" },
          { id: "channel-system/sluice", name: "Sluice", slug: "sluice" },
          { id: "channel-system/pump-station", name: "Pump Station", slug: "pump-station" },
          { id: "channel-system/dike-embankments", name: "Dike & Embankments", slug: "dike-embankments" },
          { id: "channel-system/irrigation", name: "Irrigation", slug: "irrigation" },
        ],
      },
      { id: "baseline-groundwater", name: "Ground Water Storage", slug: "ground-water-storage", scale: "Province" },
      { id: "baseline-road", name: "Road", slug: "road", scale: "Province" },
      {
        id: "baseline-landuse-class",
        name: "Landuse Classification",
        slug: "landuse-classification",
        source: "Landsat GIS Interpretation",
        children: [
          { id: "landuse-classification/aquaculture", name: "Aquaculture and Water Surface Lands" },
          { id: "landuse-classification/rice-shrimp", name: "Rice-to-shrimp conversion area or Intensive shrimp farming" },
          { id: "landuse-classification/perennial-crops", name: "Perennial crops, Fruit Orchards and Mangrove Forests" },
          { id: "landuse-classification/residential-land", name: "Residential Land and Sandy Ridge Land" },
          { id: "landuse-classification/coconut-garden", name: "Coconut Plantation, mix garden" },
          { id: "landuse-classification/vegetable-crops", name: "Vegetable and Upland Crop Area" },
          { id: "landuse-classification/rice-cultivation", name: "Rice Cultivation Zone" },
        ],
      },
      { id: "baseline-salinity", name: "Salinity Intrusion", slug: "salinity-intrusion", source: "Province/Other Dataset" },
    ],
  },
  {
    id: "ecology",
    name: "Ecology",
    slug: "ecology",
    group: "gis",
    children: [
      { id: "ecology-biodiversity", name: "Biodiversity", slug: "biodiversity", scale: "Province" },
      { id: "ecology-vegetation", name: "Vegetation Index", slug: "vegetation-index", source: "Landsat GIS Interpretation" },
      { id: "ecology-habitat", name: "Habitat Mapping", slug: "habitat-mapping", scale: "Province" },
      { id: "ecology-species", name: "Species Distribution", slug: "species-distribution" },
      { id: "ecology-mangroves", name: "Mangroves", slug: "mangroves", source: "Landsat GIS Interpretation" },
    ],
  },
  {
    id: "flooding",
    name: "Flooding Modeling",
    slug: "flooding-modeling",
    group: "gis",
  },
  {
    id: "hydrology",
    name: "Hydrology",
    slug: "hydrology",
    group: "gis",
    children: [
      { id: "hydro-salinity", name: "Salinity", slug: "salinity", type: "raster" },
      { id: "hydro-temp", name: "Tidal", slug: "tidal", type: "raster" },
      { id: "hydro-ph", name: "pH", slug: "ph", type: "raster" },
    ],
  },
  // ── Station Data ──────────────────────────────────────────
  {
    id: "weather",
    name: "Weather",
    slug: "weather",
    group: "station",
  },
  // ── Monitoring Data ───────────────────────────────────────
  {
    id: "water-quality",
    name: "Water Quality",
    slug: "water-quality",
    group: "monitoring",
    children: [
      { id: "wq-surface", name: "Surface Water", slug: "surface-water", scale: "Province scale" },
      { id: "wq-ground", name: "Ground Water", slug: "ground-water", scale: "Province scale" },
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
