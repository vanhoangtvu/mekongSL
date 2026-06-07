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
      { id: "landsat-dry", name: "Dry Season", slug: "dry-season", source: "Download" },
      { id: "landsat-wet", name: "Wet Season", slug: "wet-season", source: "Download" },
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
          { id: "baseline-channel-river", name: "River", slug: "river" },
          { id: "baseline-channel-canal", name: "Canal", slug: "canal" },
          { id: "baseline-channel-sluice", name: "Sluice", slug: "sluice" },
          { id: "baseline-channel-pump-station", name: "Pump Station", slug: "pump-station" },
          { id: "baseline-channel-dike-embankments", name: "Dike & Embankments", slug: "dike-embankments" },
          { id: "baseline-channel-irrigation", name: "Irrigation", slug: "irrigation" },
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
          { id: "1", name: "Aquaculture and Water Surface Lands" },
          { id: "2", name: "Rice-to-shrimp conversion area or Intensive shrimp farming" },
          { id: "3", name: "Perennial crops, Fruit Orchards and Mangrove Forests" },
          { id: "4", name: "Residential Land and Sandy Ridge Land" },
          { id: "5", name: "Coconut Plantation, mix garden" },
          { id: "6", name: "Vegetable and Upland Crop Area" },
          { id: "7", name: "Rice Cultivation Zone" },
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
