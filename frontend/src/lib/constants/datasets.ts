export type DatasetItem = {
  id: string;
  name: string;
  slug?: string;
  children?: DatasetItem[];
  source?: string;
  scale?: string;
  gisData?: boolean;
};

export const DATASETS: DatasetItem[] = [
  {
    id: "landsat",
    name: "Landsat Imagery",
    slug: "landsat-imagery",
    children: [
      { id: "landsat-dry", name: "Dry Season", slug: "dry-season", source: "Download" },
      { id: "landsat-wet", name: "Wet Season", slug: "wet-season", source: "Download" },
    ],
  },
  {
    id: "admin",
    name: "Administration",
    slug: "administration",
    children: [
      { id: "admin-province", name: "Province", slug: "province", source: "GIS website Vinh Long", scale: "Province scale" },
      { id: "admin-community", name: "Community", slug: "community", scale: "Province scale" },
      { id: "admin-hamlet", name: "Hamlet", slug: "hamlet", scale: "Province scale" },
    ],
  },
  {
    id: "flooding",
    name: "Flooding Modeling",
    slug: "flooding-modeling",
  },
  {
    id: "hydrology",
    name: "Hydrology",
    slug: "hydrology",
    children: [
      { id: "hydro-salinity", name: "Salinity Monitoring", slug: "salinity-monitoring" },
      { id: "hydro-temp", name: "Water Temperature Monitoring", slug: "water-temperature-monitoring" },
      { id: "hydro-ph", name: "pH Monitoring", slug: "ph-monitoring" },
    ],
  },
  {
    id: "baseline",
    name: "Baseline Environment",
    slug: "baseline-environment",
    children: [
      { id: "baseline-landuse-plan", name: "Landuse Planning", slug: "landuse-planning", scale: "Province, Community" },
      { id: "baseline-soil", name: "Soil Type", slug: "soil-type", scale: "Province" },
      { id: "baseline-waterbody", name: "Water Body", slug: "water-body", scale: "Province" },
      { id: "baseline-channel", name: "Channel System", slug: "channel-system", scale: "Province" },
      { id: "baseline-groundwater", name: "Ground Water Storage", slug: "ground-water-storage", scale: "Province" },
      { id: "baseline-road", name: "Road", slug: "road", scale: "Province" },
      { id: "baseline-landuse-class", name: "Landuse Classification", slug: "landuse-classification", source: "Landsat GIS Interpretation" },
      { id: "baseline-mangroves", name: "Mangroves", slug: "mangroves", source: "Landsat GIS Interpretation" },
      { id: "baseline-salinity", name: "Salinity Intrusion", slug: "salinity-intrusion", source: "Province/Other Dataset" },
    ],
  },
  {
    id: "water-quality",
    name: "Water Quality",
    slug: "water-quality",
    children: [
      { id: "wq-surface", name: "Surface Water", slug: "surface-water", scale: "Province scale" },
      { id: "wq-ground", name: "Ground Water", slug: "ground-water", scale: "Province scale" },
    ],
  },
  {
    id: "weather",
    name: "Weather",
    slug: "weather",
    children: [
      { id: "weather-rain", name: "Rain Monitoring", slug: "rain-monitoring", gisData: false },
      { id: "weather-wind", name: "Wind", slug: "wind", gisData: false },
      { id: "weather-humidity", name: "Humidity", slug: "humidity", gisData: false },
      { id: "weather-sun", name: "Sun Radiation", slug: "sun-radiation", gisData: false },
    ],
  },
  {
    id: "ecology",
    name: "Ecology",
    slug: "ecology",
    children: [
      { id: "ecology-biodiversity", name: "Biodiversity", slug: "biodiversity", scale: "Province" },
      { id: "ecology-vegetation", name: "Vegetation Index", slug: "vegetation-index", source: "Landsat GIS Interpretation" },
      { id: "ecology-habitat", name: "Habitat Mapping", slug: "habitat-mapping", scale: "Province" },
      { id: "ecology-species", name: "Species Distribution", slug: "species-distribution" },
    ],
  },
];

export function getDatasetSlug(id: string): string | undefined {
  for (const ds of DATASETS) {
    if (ds.id === id) return ds.slug || ds.id;
    if (ds.children) {
      for (const child of ds.children) {
        if (child.id === id) return child.slug || child.id;
      }
    }
  }
  return undefined;
}

export function getDatasetById(id: string): DatasetItem | undefined {
  for (const ds of DATASETS) {
    if (ds.id === id) return ds;
    if (ds.children) {
      for (const child of ds.children) {
        if (child.id === id) return child;
      }
    }
  }
  return undefined;
}

export function getParentDataset(childId: string): DatasetItem | undefined {
  return DATASETS.find((ds) => ds.children?.some((c) => c.id === childId));
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
