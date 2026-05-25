export type DatasetItem = {
  id: string;
  name: string;
  children?: DatasetItem[];
  source?: string;
  scale?: string;
};

export const DATASETS: DatasetItem[] = [
  {
    id: "landsat",
    name: "Landsat Imagery",
    children: [
      { id: "landsat-dry", name: "Dry Season", source: "Download" },
      { id: "landsat-wet", name: "Wet Season", source: "Download" },
    ],
  },
  {
    id: "admin",
    name: "Administration",
    children: [
      { id: "admin-province", name: "Province", source: "GIS website Vinh Long", scale: "Province scale" },
      { id: "admin-community", name: "Community", scale: "Province scale" },
      { id: "admin-hamlet", name: "Hamlet", scale: "Province scale" },
    ],
  },
  {
    id: "flooding",
    name: "Flooding Modeling (RGB)",
  },
  {
    id: "hydrology",
    name: "Hydrology",
    children: [
      { id: "hydro-salinity", name: "Salinity Monitoring" },
      { id: "hydro-temp", name: "Water Temperature Monitoring" },
      { id: "hydro-ph", name: "pH Monitoring" },
    ],
  },
  {
    id: "water-quality",
    name: "Water Quality",
    children: [
      { id: "wq-surface", name: "Surface Water", scale: "Province scale" },
      { id: "wq-ground", name: "Ground Water", scale: "Province scale" },
    ],
  },
  {
    id: "climate",
    name: "Climate",
    children: [
      { id: "climate-rain", name: "Rain Monitoring" },
      { id: "climate-wind", name: "Wind" },
      { id: "climate-humidity", name: "Humidity" },
      { id: "climate-sun", name: "Sun Radiation" },
    ],
  },
  {
    id: "baseline",
    name: "Baseline Environment",
    children: [
      { id: "baseline-landuse-plan", name: "Landuse Planning", scale: "Province, Community" },
      { id: "baseline-soil", name: "Soil Type", scale: "Province" },
      { id: "baseline-waterbody", name: "Water Body", scale: "Province" },
      { id: "baseline-channel", name: "Channel System", scale: "Province" },
      { id: "baseline-groundwater", name: "Ground Water Storage", scale: "Province" },
      { id: "baseline-road", name: "Road", scale: "Province" },
      { id: "baseline-landuse-class", name: "Landuse Classification", source: "Landsat GIS Interpretation" },
      { id: "baseline-mangroves", name: "Mangroves", source: "Landsat GIS Interpretation" },
      { id: "baseline-salinity", name: "Salinity Intrusion", source: "Province/Other Dataset" },
    ],
  },
];

export const AREA_TYPES = ["Point", "Line", "Polygon", "Grid"];
