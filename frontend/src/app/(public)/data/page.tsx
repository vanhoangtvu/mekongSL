'use client';

import { useCallback, useEffect, useMemo, useState, useRef, Fragment, type DragEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../../lib/auth';
import { DATA_SOURCE_OPTIONS, DEFAULT_DATA_SOURCE, type DataSourceKey } from '../../../lib/constants/data-sources';
import { collectRecordKeys, formatRecordValue, truncatePath, getParentPath, type DataRecord } from '../../../lib/utils/record-utils';
import { loadDataDevices, loadDataRows, loadDataTimeframes, uploadS3File, listS3Files, deleteS3File, downloadS3File, renameS3File, createS3Folder, listManualStations, createManualStation, updateManualStation, deleteManualStation, importManualStations, previewWaterQualityExcel, importWaterQuality, listWaterQualitySamples, listRecentWaterQualitySamples, getWaterQualitySample, getBackendAdminUrl, deleteWaterQualitySample, type ManualStation, type WaterQualityPreviewResult, type WaterQualitySampleDto } from '../../../lib/admin-api';
import DataExportModal from '../../../components/DataExportModal';
import S3Explorer from '../../../components/S3Explorer';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import GeoTIFF from 'ol/source/GeoTIFF';
import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import { fromLonLat, toLonLat, transformExtent, transform } from 'ol/proj';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

// Register UTM 48N projection for local coordinates
if (typeof window !== 'undefined') {
  proj4.defs("EPSG:32648", "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs");
  register(proj4);
}
import { 
  RefreshCw, Server, 
  Search, MapPin, User, Lock, Key, Activity, AlertCircle, Download, Calendar, FileSpreadsheet, BarChart3,
  UploadCloud, FileCode, Trash2, CheckCircle2, XCircle,
  Layers, Tag, Clock, Folder, Copy,
  ChevronRight, Plus, Move, Check, FolderPlus, ArrowLeft, CheckSquare, Square, Filter, Pencil, X
} from 'lucide-react';

interface MekongData {
  id: number;
  _id?: string;
  SensorNodeCode: string;
  Longitude: number | string;
  Latitude: number | string;
  ProvinceName: string;
  ProvinceCode: string;
  SNShortName: string;
  SNDescription: string;
  SNShortNameEN: string;
  SNDescriptionEN: string;
  SerialNumber: string;
  NameLine_1: string;
  NameLine_2: string;
  Salinity: number | string;
  PH: number | string | null;
  WaterLevel: number | string;
  Alkalinity: number | string | null;
  fetched_at?: string;
  fetch_run_id?: string;
  is_active?: number | boolean;
  last_seen_at?: string;
  inactive_at?: string | null;
}

type ProvinceFilter = 'all' | 'TV' | 'BT' | 'VL';

type S3FileEntry = {
  key: string;
  size: number;
  lastModified: string;
};

type FolderPalette = {
  accent: string;
  tint: string;
  border: string;
};

const FOLDER_PALETTES: FolderPalette[] = [
  { accent: '#2563a8', tint: 'rgba(37, 99, 168, 0.12)', border: 'rgba(37, 99, 168, 0.2)' },
  { accent: '#198754', tint: 'rgba(25, 135, 84, 0.12)', border: 'rgba(25, 135, 84, 0.2)' },
  { accent: '#fd7e14', tint: 'rgba(253, 126, 20, 0.12)', border: 'rgba(253, 126, 20, 0.2)' },
  { accent: '#0f766e', tint: 'rgba(15, 118, 110, 0.12)', border: 'rgba(15, 118, 110, 0.2)' },
  { accent: '#d63384', tint: 'rgba(214, 51, 132, 0.12)', border: 'rgba(214, 51, 132, 0.2)' },
  { accent: '#6f42c1', tint: 'rgba(111, 66, 193, 0.12)', border: 'rgba(111, 66, 193, 0.2)' },
];

function hashString(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function getFolderPalette(folderPath: string) {
  return FOLDER_PALETTES[hashString(folderPath) % FOLDER_PALETTES.length];
}

function splitFolderPath(folderPath: string) {
  if (!folderPath || folderPath === '/') {
    return [];
  }

  return folderPath.split('/').filter(Boolean);
}

function getLocalDateString(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed) || trimmed.includes('T');
    const directDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directDateMatch && !hasTimezone) {
      return directDateMatch[1];
    }

    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
    }

    return '';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }

    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  return '';
}

function getLocalDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDecimalDisplay(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

type ColumnDefinition = {
  key: string;
  label: string;
};

const ECOWITT_DISPLAY_COLUMNS: ColumnDefinition[] = [
  { key: 'device_id', label: 'Thiết bị' },
  { key: 'record_time', label: 'Thời gian' },
  { key: 'tempf_tempf', label: 'Nhiệt độ (°F)' },
  { key: 'humidity_humidity', label: 'Độ ẩm ngoài trời (%)' },
  { key: 'vpd_vpd', label: 'VPD' },
  { key: 'so_uv_solarradiation', label: 'Bức xạ mặt trời' },
  { key: 'rain_rainratein', label: 'Cường độ mưa (in/h)' },
  { key: 'rain_dailyrainin', label: 'Mưa hôm nay (in)' },
  { key: 'wind_speed_windspeedmph', label: 'Tốc độ gió (mph)' },
  { key: 'wind_speed_windgustmph', label: 'Gió giật (mph)' },
  { key: 'winddir_winddir', label: 'Hướng gió (°)' },
  { key: 'pressure_baromrelin', label: 'Áp suất tương đối (inHg)' },
  { key: 'pressure_baromabsin', label: 'Áp suất tuyệt đối (inHg)' },
];

function getEcowittDisplayColumns(records: DataRecord[]): ColumnDefinition[] {
  const availableKeys = new Set(collectRecordKeys(records));
  return ECOWITT_DISPLAY_COLUMNS.filter((column) => availableKeys.has(column.key));
}

type GisCategoryNode = {
  key: string;
  label: string;
  children?: GisCategoryNode[];
};

type GisDatasetConfig = {
  label: string;
  categories: GisCategoryNode[];
};

function renderGisCategoryOptions(categories: GisCategoryNode[]) {
  return categories.flatMap((category) => {
    if (category.children?.length) {
      return [
        <optgroup key={category.key} label={category.label}>
          {category.children.flatMap((child) => {
            if (child.children?.length) {
              return child.children.map((sub) => (
                <option key={sub.key} value={sub.key}>{child.label} — {sub.label}</option>
              ));
            }
            return [<option key={child.key} value={child.key}>{child.label}</option>];
          })}
        </optgroup>,
      ];
    }

    return [
      <option key={category.key} value={category.key}>{category.label}</option>,
    ];
  });
}

const GIS_DATASETS = {
  'landsat-imagery': {
    label: 'Landsat Imagery',
    categories: [
      { key: 'band-1', label: 'Band 1' },
      { key: 'band-2', label: 'Band 2' },
      { key: 'band-3', label: 'Band 3' },
      { key: 'band-4', label: 'Band 4' },
      { key: 'band-5', label: 'Band 5' },
      { key: 'band-6', label: 'Band 6' },
      { key: 'band-7', label: 'Band 7' },
      { key: 'rgb', label: 'Composite (RGB)' }
    ]
  },
  'administration': {
    label: 'Administration',
    categories: [
      { key: 'province', label: 'Province' },
      { key: 'community', label: 'Community' },
      { key: 'hamlet', label: 'Hamlet' }
    ]
  },
  'flooding-modeling': {
    label: 'Flooding Modeling',
    categories: [
      { key: 'flooding-modeling', label: 'Flooding Modeling' }
    ]
  },
  'hydrology': {
    label: 'Hydrology',
    categories: [
      { key: 'salinity', label: 'Salinity' },
      { key: 'tidal', label: 'Tidal' },
      { key: 'ph', label: 'pH' }
    ]
  },
  'baseline-environment': {
    label: 'Baseline Environment',
    categories: [
      { key: 'landuse-planning', label: 'Landuse Planning',
        children: [
          { key: 'tra-vinh-chau-thanh', label: 'Trà Vinh – Châu Thành District' },
          { key: 'tra-vinh-cang-long', label: 'Trà Vinh – Càng Long District' },
          { key: 'tra-vinh-cau-ke', label: 'Trà Vinh – Cầu Kè District' },
          { key: 'tra-vinh-tieu-can', label: 'Trà Vinh – Tiểu Cần District' },
          { key: 'tra-vinh-cau-ngang', label: 'Trà Vinh – Cầu Ngang District' },
          { key: 'tra-vinh-tra-cu', label: 'Trà Vinh – Trà Cú District' },
          { key: 'tra-vinh-duyen-hai', label: 'Trà Vinh – Duyên Hải District' },
          { key: 'tra-vinh-city', label: 'Trà Vinh – Trà Vinh City' },
          { key: 'tra-vinh-duyen-hai-town', label: 'Trà Vinh – Duyên Hải Town' },
        ],
      },
      { key: 'soil-type', label: 'Soil Type' },
      {
        key: 'channel-system',
        label: 'Channel System',
        children: [
          { key: 'main-river', label: 'Main River' },
          { key: 'canal', label: 'Canal',
            children: [
              { key: 'main-canal', label: 'Main Canal' },
              { key: 'field-ditch', label: 'Field Ditch' },
            ],
          },
          { key: 'transport', label: 'Transportation' },
          { key: 'dike', label: 'Dike' },
          { key: 'hydraulic-works', label: 'Hydraulic Works' },
          { key: 'bridge', label: 'Bridge' },
          { key: 'residential', label: 'Residential Area' },
          { key: 'pump-station', label: 'Pump Station' },
        ],
      },
      { key: 'ground-water-storage', label: 'Ground Water Storage' },
      { key: 'road', label: 'Road' },
      {
        key: 'landuse-classification',
        label: 'Landuse Classification',
        children: [
          { key: 'landuse-classification/aquaculture', label: 'Aquaculture and Water Surface Lands' },
          { key: 'landuse-classification/rice-shrimp', label: 'Rice-to-shrimp conversion area or Intensive shrimp farming' },
          { key: 'landuse-classification/perennial-crops', label: 'Perennial crops, Fruit Orchards and Mangrove Forests' },
          { key: 'landuse-classification/residential-land', label: 'Residential Land and Sandy Ridge Land' },
          { key: 'landuse-classification/coconut-garden', label: 'Coconut Plantation, mix garden' },
          { key: 'landuse-classification/vegetable-crops', label: 'Vegetable and Upland Crop Area' },
          { key: 'landuse-classification/rice-cultivation', label: 'Rice Cultivation Zone' },
        ],
      },
    ]
  },
  'ecology': {
    label: 'Ecology',
    categories: [
      { key: 'biodiversity', label: 'Biodiversity' },
      { key: 'vegetation-index', label: 'Vegetation Index' },
      { key: 'habitat-mapping', label: 'Habitat Mapping' },
      { key: 'species-distribution', label: 'Species Distribution' },
      { key: 'mangroves', label: 'Mangroves' }
    ]
  }
} satisfies Record<string, GisDatasetConfig>;

const STATION_DATA_TYPES = [
  { key: 'water-quality', label: 'Chất lượng nước' },
  { key: 'ecology', label: 'Sinh thái' }
];

const STATION_PARAMETERS = [
  { key: 'ph', label: 'pH' },
  { key: 'salinity', label: 'Độ mặn' },
  { key: 'tidal', label: 'Thủy triều' },
  { key: 'do', label: 'DO' },
  { key: 'water-level', label: 'Mực nước' },
  { key: 'flow', label: 'Lưu lượng' }
];

const MONITORING_PARAMETERS = [
  { key: 'salinity', label: 'Độ mặn' },
  { key: 'tidal', label: 'Thủy triều' },
  { key: 'ph', label: 'pH' },
  { key: 'water-level', label: 'Mực nước' }
];

const TIME_SLOTS = ['05:00', '10:00', '15:00', '20:00', '00:00'];

function getNearestTimeSlot(): string {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = TIME_SLOTS.map(t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  });
  let nearestIdx = 0;
  let minDiff = Infinity;
  slotMinutes.forEach((sm, idx) => {
    let diff = Math.abs(totalMinutes - sm);
    if (diff > 720) diff = 1440 - diff;
    if (diff < minDiff) {
      minDiff = diff;
      nearestIdx = idx;
    }
  });
  return TIME_SLOTS[nearestIdx];
}

// S3 Folder Explorer Component
// S3 Flat File List component has been moved to src/components/S3Explorer.tsx

function parseCSV(text: string, limit = 100): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  for (let i = 0; i < Math.min(lines.length, limit); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row: string[] = [];
    let inQuotes = false;
    let current = '';
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  return result;
}

interface FilePreviewModalProps {
  fileKey: string;
  onClose: () => void;
}

const getBackendUrl = (path: string) => {
  const base = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8084/api');
  return `${base}${path}`;
};

function FilePreviewModal({ fileKey, onClose }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvSearch, setCsvSearch] = useState('');
  
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const rasterLayerRef = useRef<WebGLTileLayer | null>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [hoverCoords, setHoverCoords] = useState<[number, number] | null>(null);

  const ext = fileKey.substring(fileKey.lastIndexOf('.')).toLowerCase();
  const isCSV = ext === '.csv';
  const isImage = ['.png', '.jpg', '.jpeg', '.gif'].includes(ext);
  const isVector = ['.geojson', '.kml'].includes(ext);
  const isRaster = ['.tif', '.tiff'].includes(ext);
  const isMap = isVector || isRaster;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!fileKey) return;

    if (isRaster) {
      setLoading(false);
      setError('');
      // Encode the full key as a query param (encodeURIComponent encodes slashes too)
      // Add cache-bust ts to prevent browser from returning stale file
      const ts = Date.now();
      setBlobUrl(`/api/tif?key=${encodeURIComponent(fileKey)}&_t=${ts}`);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    setBlobUrl('');
    setCsvData([]);

    const token = authService.getToken();
    fetch(getBackendUrl(`/s3/download?key=${encodeURIComponent(fileKey)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Lỗi tải file: ${res.statusText}`);
        }
        return res.blob();
      })
      .then(async (blob) => {
        if (!active) return;
        
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        if (ext === '.csv') {
          const text = await blob.text();
          if (active) {
            const parsed = parseCSV(text, 100);
            setCsvData(parsed);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (active) {
          console.error("Error loading preview:", err);
          setError(err.message || 'Không thể tải tệp tin để xem trước.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileKey, ext]);

  useEffect(() => {
    if (!isMap || loading || !blobUrl || !mapElement.current) return;

    const view = new View({
      center: fromLonLat([106.3, 10.0]),
      zoom: 9,
      projection: 'EPSG:3857'
    });

    const map = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({
          source: new OSM()
        })
      ],
      view: view
    });
    mapRef.current = map;

    if (isVector) {
      const loadVector = async () => {
        try {
          const response = await fetch(blobUrl);
          const text = await response.text();
          
          let features;
          if (ext === '.kml') {
            const kmlFormat = new KML({ extractStyles: true });
            features = kmlFormat.readFeatures(text, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857'
            });
          } else {
            const geojsonFormat = new GeoJSON();
            try {
              features = geojsonFormat.readFeatures(text, {
                featureProjection: 'EPSG:3857'
              });
            } catch {
              features = geojsonFormat.readFeatures(text, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
              });
            }
          }

          const vectorSource = new VectorSource({ features });
          const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: new Style({
              stroke: new Stroke({
                color: '#2563eb',
                width: 2.5
              }),
              fill: new Fill({
                color: 'rgba(37, 99, 168, 0.25)'
              }),
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: '#2563eb' }),
                stroke: new Stroke({ color: '#ffffff', width: 1.5 })
              })
            })
          });

          map.addLayer(vectorLayer);

          const extent = vectorSource.getExtent();
          if (extent && extent.length === 4 && extent[0] !== Infinity) {
            view.fit(extent, {
              padding: [50, 50, 50, 50],
              maxZoom: 16,
              duration: 500
            });
          }
        } catch (err) {
          console.error("Error loading vector layer:", err);
        }
      };
      void loadVector();
    }

    if (isRaster) {
      const isSalinity = fileKey.toLowerCase().includes('salinity') || fileKey.toLowerCase().includes('salt');
      const isPh = fileKey.toLowerCase().includes('/ph/') || fileKey.toLowerCase().includes('ph_') || fileKey.toLowerCase().includes('_ph_');
      const isTidal = fileKey.toLowerCase().includes('tidal');
      const isWaterLevel = fileKey.toLowerCase().includes('water-level') || fileKey.toLowerCase().includes('waterlevel');
      const isSingleBand = isSalinity || isPh || isTidal || isWaterLevel
        || fileKey.toLowerCase().includes('station')
        || fileKey.toLowerCase().includes('monitoring');

      const geoTiffSource = new GeoTIFF({
        sources: [
          {
            url: blobUrl,
            nodata: -9999
          }
        ],
        convertToRGB: !isSingleBand,
        normalize: false,
        interpolate: false,
        projection: 'EPSG:32648'
      });

      let layerStyle;
      if (isSingleBand) {
        if (isPh) {
          layerStyle = {
            color: [
              'interpolate',
              ['linear'],
              ['band', 1],
              0, [0, 0, 0, 0],
              3, [255, 0, 0, 1],
              7, [0, 255, 0, 1],
              11, [0, 0, 255, 1],
              14, [128, 0, 128, 1]
            ]
          };
        } else if (isTidal || isWaterLevel) {
          // Tidal / water-level: blue-to-red gradient
          layerStyle = {
            color: [
              'case',
              ['==', ['band', 1], 0], [0, 0, 0, 0],
              ['==', ['band', 1], -9999], [0, 0, 0, 0],
              ['<', ['band', 1], -100], [0, 0, 0, 0],
              ['>', ['band', 1], 200], [0, 0, 0, 0],
              [
                'interpolate',
                ['linear'],
                ['band', 1],
                -100,  [0, 0, 0, 1],
                -25,   [0, 0, 255, 1],
                0.001, [0, 255, 0, 1],
                100,   [255, 255, 0, 1],
                200,   [255, 0, 0, 1]
              ]
            ]
          };
        } else {
          // Salinity and others: blue-to-red gradient — same as map render
          layerStyle = {
            color: [
              'case',
              ['<=', ['band', 1], -9999], [0, 0, 0, 0],
              ['<=', ['band', 1], 0], [0, 0, 0, 0],
              ['<', ['band', 1], 0.06], [0, 0, 0, 0],
              [
                'interpolate',
                ['linear'],
                ['band', 1],
                0.06, [0, 0, 255, 1],
                5,    [0, 255, 255, 1],
                10,   [0, 255, 0, 1],
                15,   [255, 255, 0, 1],
                20,   [255, 165, 0, 1],
                21,   [255, 0, 0, 1],
              ]
            ]
          };
        }
      }

      const rasterLayer = new WebGLTileLayer({
        source: geoTiffSource,
        opacity: 0.7,
        style: layerStyle
      });

      map.addLayer(rasterLayer);
      rasterLayerRef.current = rasterLayer;

      map.on("pointermove", (evt) => {
        try {
          const buf = rasterLayer.getData(evt.pixel);
          if (buf && !(buf instanceof DataView) && buf.length > 0 && buf[0] > 0) {
            setHoverValue(buf[0]);
          } else {
            setHoverValue(null);
          }
        } catch { setHoverValue(null); }
        const lonlat = toLonLat(evt.coordinate);
        setHoverCoords([lonlat[1], lonlat[0]]);
      });

      geoTiffSource.getView().then((viewOptions) => {
        if (viewOptions.extent && viewOptions.projection) {
          const sourceProj = typeof viewOptions.projection === 'string'
            ? viewOptions.projection
            : viewOptions.projection.getCode();

          try {
            let extentToFit = viewOptions.extent;
            if (extentToFit[0] === 0 && extentToFit[1] === 0) {
              extentToFit = [594885, 1052655, 688485, 1117455];
            }
            const transformedExtent = transformExtent(extentToFit, sourceProj, 'EPSG:3857');
            view.fit(transformedExtent, {
              padding: [50, 50, 50, 50],
              maxZoom: 16,
              duration: 500
            });
          } catch (err) {
            console.error("Error transforming raster extent:", err);
          }
        }
      }).catch((err) => {
        console.error("Error reading raster metadata:", err);
      });
    }

    const timer = setTimeout(() => {
      map.updateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [isMap, loading, blobUrl, ext, isVector, isRaster]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileKey.split('/').pop() || 'download';
    link.click();
  };

  const filteredCsvRows = useMemo(() => {
    if (!csvData || csvData.length <= 1) return csvData;
    const headers = csvData[0];
    const rows = csvData.slice(1);
    const query = csvSearch.trim().toLowerCase();
    if (!query) return csvData;

    const filtered = rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(query))
    );
    return [headers, ...filtered];
  }, [csvData, csvSearch]);

  const filename = fileKey.split('/').pop() || fileKey;

  // File type color + icon theming
  const fileTheme = isCSV
    ? { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'CSV Table', icon: <FileSpreadsheet size={22} /> }
    : isImage
    ? { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Image', icon: <FileCode size={22} /> }
    : isRaster
    ? { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'GeoTIFF', icon: <MapPin size={22} /> }
    : isVector
    ? { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'Vector Layer', icon: <Layers size={22} /> }
    : { color: 'var(--accent)', bg: 'rgba(37,99,168,0.12)', label: ext.toUpperCase().replace('.',''), icon: <FileCode size={22} /> };

  const pathParts = fileKey.split('/');
  const dirPath = pathParts.slice(0, -1).join('/');

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: 'rgba(6, 8, 16, 0.82)',
        backdropFilter: 'blur(18px) saturate(1.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'modalOverlayIn 0.25s ease'
      }}
    >
      <div style={{
        background: 'linear-gradient(160deg, rgba(22,27,46,0.98) 0%, rgba(13,17,33,0.99) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px -12px rgba(0,0,0,0.8), 0 0 80px -20px ${fileTheme.color}33`,
        width: '100%',
        maxWidth: isCSV ? '1160px' : '980px',
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalPanelIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: `linear-gradient(135deg, ${fileTheme.bg} 0%, transparent 60%)`,
          display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: fileTheme.bg, border: `1px solid ${fileTheme.color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: fileTheme.color, flexShrink: 0,
            boxShadow: `0 4px 16px ${fileTheme.color}22`
          }}>
            {fileTheme.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{
                margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#f1f5f9',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px'
              }}>
                {filename}
              </h3>
              <span style={{
                padding: '2px 10px', borderRadius: '999px',
                background: fileTheme.bg, border: `1px solid ${fileTheme.color}44`,
                color: fileTheme.color, fontSize: '0.72rem', fontWeight: '700',
                letterSpacing: '0.04em', textTransform: 'uppercase' as const, flexShrink: 0
              }}>
                {fileTheme.label}
              </span>
            </div>
            <p style={{
              margin: '5px 0 0', fontSize: '0.76rem',
              color: 'rgba(148,163,184,0.7)',
              fontFamily: '"JetBrains Mono","Fira Code",monospace',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '600px'
            }} title={fileKey}>
              📁 {dirPath}/
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleDownload}
              style={{
                background: `linear-gradient(135deg, ${fileTheme.color}22, ${fileTheme.color}11)`,
                border: `1px solid ${fileTheme.color}44`,
                color: fileTheme.color, padding: '9px 16px', borderRadius: '10px',
                fontSize: '0.83rem', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.18s ease'
              }}
              title="Tải tệp này xuống"
            >
              <Download size={14} /> Tải xuống
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(148,163,184,0.8)', cursor: 'pointer',
                padding: '9px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s ease'
              }}
              title="Đóng (Esc)"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto',
          background: 'rgba(8,12,24,0.6)',
          display: 'flex', flexDirection: 'column', minHeight: 0
        }} className="custom-scrollbar">

          {loading ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '20px', padding: '80px 24px', flex: 1
            }}>
              <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `3px solid ${fileTheme.color}22`
                }} />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: `3px solid transparent`, borderTopColor: fileTheme.color,
                  animation: 'spinLoader 0.9s linear infinite'
                }} />
                <div style={{
                  position: 'absolute', inset: '16px', borderRadius: '50%',
                  border: `2px solid transparent`, borderTopColor: `${fileTheme.color}88`,
                  animation: 'spinLoader 1.4s linear infinite reverse'
                }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#f1f5f9', fontWeight: '600', fontSize: '0.95rem' }}>
                  Đang tải tệp tin...
                </p>
                <p style={{ margin: '6px 0 0', color: 'rgba(148,163,184,0.6)', fontSize: '0.82rem' }}>
                  Chuẩn bị xem trước · {ext.toUpperCase().replace('.', '')}
                </p>
              </div>
            </div>

          ) : error ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '16px', padding: '80px 24px',
              flex: 1, textAlign: 'center'
            }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <AlertCircle size={34} color="#f87171" />
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#f1f5f9', fontWeight: '700', fontSize: '1rem' }}>
                  Không thể xem trước
                </h4>
                <p style={{ margin: '8px 0 0', color: 'rgba(148,163,184,0.7)', fontSize: '0.84rem', lineHeight: '1.6', maxWidth: '400px' }}>
                  {error}
                </p>
              </div>
              <button onClick={handleDownload} style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', padding: '9px 20px', borderRadius: '10px',
                fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px'
              }}>
                <Download size={14} /> Tải xuống để xem cục bộ
              </button>
            </div>

          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

              {/* CSV Table */}
              {isCSV && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: '10px', padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '999px',
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                        color: '#34d399', fontSize: '0.75rem', fontWeight: '600'
                      }}>
                        {csvData.length > 0 ? csvData.length - 1 : 0} hàng
                      </span>
                      <span style={{
                        padding: '3px 10px', borderRadius: '999px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(148,163,184,0.8)', fontSize: '0.75rem', fontWeight: '500'
                      }}>
                        {csvData[0]?.length || 0} cột · tối đa 100 dòng
                      </span>
                    </div>
                    <div style={{ position: 'relative', width: '280px' }}>
                      <Search size={13} style={{
                        position: 'absolute', left: '11px', top: '50%',
                        transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.5)', pointerEvents: 'none'
                      }} />
                      <input
                        type="text"
                        placeholder="Tìm kiếm trong bảng..."
                        value={csvSearch}
                        onChange={(e) => setCsvSearch(e.target.value)}
                        style={{
                          width: '100%', boxSizing: 'border-box' as const,
                          padding: '8px 12px 8px 32px',
                          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#f1f5f9', fontSize: '0.83rem', outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', minHeight: '300px' }} className="custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.81rem' }}>
                      <thead>
                        <tr style={{
                          background: 'rgba(16,185,129,0.08)',
                          borderBottom: '1px solid rgba(16,185,129,0.2)',
                          position: 'sticky', top: 0, zIndex: 2
                        }}>
                          {csvData[0]?.map((cell, idx) => (
                            <th key={idx} style={{
                              padding: '11px 16px', color: '#34d399', fontWeight: '700',
                              borderRight: '1px solid rgba(255,255,255,0.05)',
                              textAlign: 'left' as const, whiteSpace: 'nowrap' as const,
                              fontSize: '0.78rem', letterSpacing: '0.03em', textTransform: 'uppercase' as const
                            }}>
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCsvRows.slice(1).map((row, rowIdx) => (
                          <tr key={rowIdx} style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                          }}>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} style={{
                                padding: '9px 16px', color: 'rgba(203,213,225,0.85)',
                                borderRight: '1px solid rgba(255,255,255,0.04)',
                                whiteSpace: 'nowrap' as const
                              }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {filteredCsvRows.length <= 1 && (
                          <tr>
                            <td colSpan={csvData[0]?.length || 1} style={{
                              padding: '40px', textAlign: 'center',
                              color: 'rgba(148,163,184,0.5)', fontSize: '0.85rem'
                            }}>
                              Không tìm thấy kết quả nào
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Image */}
              {isImage && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flex: 1, padding: '32px',
                  background: 'repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px'
                }}>
                  <img src={blobUrl} alt={filename} style={{
                    maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain',
                    borderRadius: '14px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }} />
                </div>
              )}

              {/* Map */}
              {isMap && (
                <div style={{ position: 'relative', width: '100%', height: '580px', flexShrink: 0 }}>
                  <div ref={mapElement} style={{ width: '100%', height: '100%', background: '#0d1117' }} />
                  <div style={{
                    position: 'absolute', bottom: '16px', left: '16px',
                    background: 'rgba(6,8,16,0.88)', backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                    padding: '12px 16px', fontSize: '0.78rem', color: '#f1f5f9',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 10,
                    display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '210px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: fileTheme.color }}>
                      {isVector ? <Layers size={13} /> : <MapPin size={13} />}
                      {isVector ? 'Vector Layer' : 'Raster GeoTIFF'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: 'rgba(148,163,184,0.8)' }}>
                      <span>📐 {isVector ? 'EPSG:4326 / 3857' : 'Auto-detected CRS'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '200px' }}>
                        🗂 {filename}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: 'rgba(6,8,16,0.75)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                    padding: '6px 10px', fontSize: '0.71rem',
                    color: 'rgba(148,163,184,0.6)', zIndex: 10
                  }}>
                    🖱 Scroll để zoom · Kéo để di chuyển
                  </div>
                  {isRaster && hoverCoords && (
                    <div style={{
                      position: 'absolute', top: '12px', left: '12px',
                      background: 'rgba(6,8,16,0.88)', backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                      padding: '7px 12px', fontSize: '0.75rem', color: '#f1f5f9',
                      zIndex: 10, display: 'flex', flexDirection: 'column', gap: '3px'
                    }}>
                      {hoverValue !== null
                        ? <span style={{ fontWeight: '700', color: '#38bdf8' }}>Giá trị: <b>{hoverValue.toFixed(3)}</b></span>
                        : <span style={{ color: 'rgba(148,163,184,0.5)' }}>—</span>
                      }
                      <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.68rem' }}>
                        {hoverCoords[0].toFixed(5)}°N, {hoverCoords[1].toFixed(5)}°E
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Unsupported */}
              {!isCSV && !isImage && !isMap && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '18px', padding: '80px 24px',
                  flex: 1, textAlign: 'center'
                }}>
                  <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <FileCode size={36} color="rgba(148,163,184,0.5)" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: '#f1f5f9', fontWeight: '700', fontSize: '1rem' }}>
                      Chưa hỗ trợ xem trước
                    </h4>
                    <p style={{ margin: '8px 0 0', color: 'rgba(148,163,184,0.6)', fontSize: '0.84rem', lineHeight: '1.6', maxWidth: '380px' }}>
                      Định dạng{' '}
                      <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {ext}
                      </code>{' '}
                      chưa được hỗ trợ xem trực tiếp.
                    </p>
                  </div>
                  <button onClick={handleDownload} style={{
                    background: 'linear-gradient(135deg, rgba(37,99,168,0.3), rgba(37,99,168,0.15))',
                    border: '1px solid rgba(37,99,168,0.4)', color: '#93c5fd',
                    padding: '11px 24px', borderRadius: '11px',
                    fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 20px rgba(37,99,168,0.2)'
                  }}>
                    <Download size={15} /> Tải xuống tệp tin
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <span style={{ fontSize: '0.74rem', color: 'rgba(148,163,184,0.4)', fontFamily: 'monospace' }}>
            Nhấn{' '}
            <kbd style={{
              padding: '1px 6px', background: 'rgba(255,255,255,0.07)',
              borderRadius: '4px', fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.12)'
            }}>Esc</kbd>
            {' '}hoặc click nền để đóng
          </span>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: '9px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(148,163,184,0.7)', fontSize: '0.84rem', fontWeight: '500', cursor: 'pointer'
          }}>
            Đóng
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalPanelIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spinLoader {
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}

function StationImage({ imageKey }: { imageKey: string }) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const token = authService.getToken();
    fetch(getBackendUrl(`/s3/download?key=${encodeURIComponent(imageKey)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Image load failed");
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const objUrl = URL.createObjectURL(blob);
        setUrl(objUrl);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [imageKey]);

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '140px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed var(--border)',
        color: 'var(--text-muted)',
        fontSize: '0.8rem'
      }}>
        Đang tải ảnh...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '140px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border)',
        color: 'var(--red)',
        fontSize: '0.8rem'
      }}>
        Lỗi tải ảnh
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Ảnh hiện trường"
      style={{
        width: '100%',
        height: '140px',
        objectFit: 'cover',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}
    />
  );
}

interface WaterQualityDetailModalProps {
  sample: WaterQualitySampleDto;
  onClose: () => void;
}

function WaterQualityDetailModal({ sample, onClose }: WaterQualityDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isGroundwater = sample.stationType === 'groundwater';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'modalOverlayIn 0.25s ease'
      }}
    >
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.02)',
        width: '100%',
        maxWidth: '1050px',
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalPanelIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: `linear-gradient(135deg, ${isGroundwater ? 'rgba(111,66,193,0.06)' : 'rgba(13,202,240,0.06)'} 0%, #ffffff 100%)`,
          display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: isGroundwater ? 'rgba(111, 66, 193, 0.08)' : 'rgba(13, 202, 240, 0.08)',
            border: `1px solid ${isGroundwater ? 'rgba(111, 66, 193, 0.2)' : 'rgba(13, 202, 240, 0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isGroundwater ? '#6f42c1' : '#0ea5e9', flexShrink: 0,
            boxShadow: `0 4px 16px ${isGroundwater ? 'rgba(111, 66, 193, 0.15)' : 'rgba(13, 202, 240, 0.15)'}`
          }}>
            <FileSpreadsheet size={26} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{
                margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#0f172a',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '600px',
                lineHeight: 1.2
              }}>
                {sample.stationLocation || 'Trạm đo chưa rõ tên'}
              </h3>
              <span style={{
                padding: '4px 14px', borderRadius: '999px',
                background: isGroundwater ? 'rgba(111, 66, 193, 0.08)' : 'rgba(13, 202, 240, 0.08)',
                border: `1px solid ${isGroundwater ? 'rgba(111, 66, 193, 0.2)' : 'rgba(13, 202, 240, 0.2)'}`,
                color: isGroundwater ? '#6f42c1' : '#0974a6', fontSize: '0.82rem', fontWeight: '700',
                letterSpacing: '0.04em', textTransform: 'uppercase' as const, flexShrink: 0
              }}>
                {isGroundwater ? 'Nước ngầm' : 'Nước mặt'}
              </span>
              {sample.stationId && (
                <span style={{
                  padding: '4px 10px', borderRadius: '8px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#334155', fontSize: '0.82rem', fontWeight: '700', flexShrink: 0
                }}>
                  {sample.stationId}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '8px', flexWrap: 'wrap', color: '#475569', fontSize: '0.88rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="var(--accent)" />
                Ngày lấy mẫu: <strong style={{ color: '#0f172a' }}>{sample.sampleDate}</strong>
              </span>
              {sample.zoneDescription && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="#10b981" />
                  Khu vực: <strong style={{ color: '#0f172a' }}>{sample.zoneDescription}</strong>
                </span>
              )}
              {sample.qcvnStandard && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="#f59e0b" />
                  Tiêu chuẩn: <strong style={{ color: '#0f172a' }}>{sample.qcvnStandard}</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569', padding: '10px 18px', borderRadius: '12px',
                fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.18s ease'
              }}
              title="Đóng cửa sổ"
            >
              <X size={16} /> Đóng
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {sample.notes && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px 20px',
              marginBottom: '20px',
              fontSize: '0.9rem',
              color: '#334155'
            }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.04em', marginBottom: '6px' }}>Ghi chú đợt nhập</div>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{sample.notes}</p>
            </div>
          )}

          <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  {['Thông số', 'Đơn vị', 'Giá trị', 'Tiêu chuẩn'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', color: '#334155', fontWeight: '700' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.parameters && sample.parameters.length > 0 ? (
                  sample.parameters.map((p, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: idx === sample.parameters!.length - 1 ? 'none' : '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#ffffff' : '#fcfdfe'
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: '600', color: '#0f172a' }}>{p.parameterName}</td>
                      <td style={{ padding: '14px 20px', color: '#475569' }}>{p.unit || '—'}</td>
                      <td style={{ padding: '14px 20px', fontFamily: '"JetBrains Mono",monospace', color: '#0f172a', fontWeight: '700' }}>{p.valueRaw || '—'}</td>
                      <td style={{ padding: '14px 20px', color: '#475569', fontSize: '0.88rem' }}>{p.referenceStandard || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      Không có thông số nào được tìm thấy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexShrink: 0,
          fontSize: '0.85rem', color: '#475569'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            Thời gian import: <strong>{new Date(sample.importedAt).toLocaleString('vi-VN')}</strong>
          </span>
          {sample.importedBy && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} />
              Người import: <strong>{sample.importedBy}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface MapPreviewModalProps {
  station: ManualStation;
  onClose: () => void;
}

function MapPreviewModal({ station, onClose }: MapPreviewModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const { x, y, location, stationType, stationId, hydroChar, isActive } = station;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!mapRef.current || x == null || y == null) return;

    // Detect coordinate projection system
    const isWgs84 = Math.abs(x) <= 180 && Math.abs(y) <= 90;
    const sourceProj = isWgs84 ? 'EPSG:4326' : 'EPSG:32648';

    let coords3857: [number, number];
    try {
      coords3857 = transform([x, y], sourceProj, 'EPSG:3857') as [number, number];
    } catch (err) {
      console.error("Coordinate projection transformation failed:", err);
      coords3857 = fromLonLat([106.12, 9.87]) as [number, number];
    }

    const marker = new Feature({
      geometry: new Point(coords3857)
    });

    const markerStyle = new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({
          color: stationType === 'groundwater' ? '#0d6efd' : '#198754'
        }),
        stroke: new Stroke({
          color: '#ffffff',
          width: 2
        })
      })
    });
    marker.setStyle(markerStyle);

    const vectorSource = new VectorSource({
      features: [marker]
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource
    });

    const tileLayer = new TileLayer({
      source: new OSM()
    });

    const map = new Map({
      target: mapRef.current,
      layers: [tileLayer, vectorLayer],
      view: new View({
        center: coords3857,
        zoom: 11,
        maxZoom: 19
      })
    });

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, [x, y, stationType]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10000,
        background: 'rgba(6, 8, 16, 0.4)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'modalOverlayIn 0.25s ease'
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-xl)',
        width: '100%',
        maxWidth: '900px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'modalPanelIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text)' }}>
              Xem trước Trạm đo thủ công
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {stationId ? `Mã trạm: ${stationId} - ` : ''}{location}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            className="hover-bg-muted"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body: Chia 2 cột */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '100%', minHeight: '450px' }}>
          {/* Cột trái: Bản đồ */}
          <div style={{ flex: '1 1 500px', position: 'relative', height: '450px', background: 'var(--background-soft)' }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Cột phải: Thông tin chi tiết + Ảnh */}
          <div style={{
            flex: '1 1 300px',
            padding: '24px',
            borderLeft: '1px solid var(--border)',
            background: 'var(--surface-strong)',
            maxHeight: '450px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="custom-scrollbar">
            {/* Mục thông tin trạm */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                Thông tin chi tiết
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Mã trạm:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text)' }}>{stationId || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Địa điểm:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text)', textAlign: 'right' }}>{location}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Loại nguồn nước:</span>
                  <span style={{ fontWeight: '600', color: stationType === 'groundwater' ? '#0d6efd' : '#198754' }}>
                    {stationType === 'groundwater' ? 'Nước ngầm' : 'Nước mặt'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Đặc tính thủy vực:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text)', textAlign: 'right' }}>{hydroChar || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tọa độ X:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'var(--text)' }}>{x}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tọa độ Y:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'var(--text)' }}>{y}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Trạng thái:</span>
                  <span style={{
                    fontWeight: '700',
                    color: isActive ? '#198754' : '#ef4444'
                  }}>
                    {isActive ? 'Hoạt động' : 'Không hoạt động'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mục ảnh hiện trường (chỉ nước mặt mới có) */}
            {stationType === 'surface_water' && (
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                  Ảnh hiện trường
                </h4>
                {station.imageCode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {station.imageCode.split(',').map((key, idx) => {
                      const trimmed = key.trim();
                      if (!trimmed) return null;
                      return <StationImage key={idx} imageKey={trimmed} />;
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Không có ảnh hiện trường.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'var(--background)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-strong)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            className="hover-bg-muted"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function DeviceItem({ device, onRefresh }: { device: { id: string; name: string }; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(device.name);

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === device.name) {
      setEditing(false);
      return;
    }
    try {
      const token = authService.getToken();
      const res = await fetch('/api/ecowitt/devices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deviceId: device.id, name: trimmed }),
      });
      if (res.ok) {
        setEditing(false);
        onRefresh();
      } else {
        const err = await res.json();
        alert('Lỗi: ' + (err.error || 'Không thể đổi tên'));
      }
    } catch {
      alert('Lỗi kết nối đến server');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <Server size={16} color="var(--accent)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditing(false); setNewName(device.name); } }}
                style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
                autoFocus
              />
              <button onClick={handleRename} style={{ border: 'none', background: 'var(--accent)', color: '#fff', padding: '4px 10px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}>Lưu</button>
              <button onClick={() => { setEditing(false); setNewName(device.name); }} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', cursor: 'pointer' }}>Hủy</button>
            </div>
          ) : (
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text)', cursor: 'pointer' }} onClick={() => { setNewName(device.name); setEditing(true); }}>{device.name}</span>
          )}
          <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {device.id}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          onClick={() => { setNewName(device.name); setEditing(true); }}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
          title="Đổi tên"
        >
          ✏️
        </button>
        <button
          onClick={async () => {
            if (!window.confirm(`Xóa thiết bị ${device.name} (${device.id})?`)) return;
            try {
              const token = authService.getToken();
              const res = await fetch(`/api/ecowitt/devices?id=${encodeURIComponent(device.id)}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (res.ok) onRefresh();
              else {
                const err = await res.json();
                alert('Lỗi: ' + (err.error || 'Không thể xóa thiết bị'));
              }
            } catch {
              alert('Lỗi kết nối đến server');
            }
          }}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc3545', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
          title="Xóa thiết bị"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function DataPage() {
  const router = useRouter();
  const hasValue = (val: unknown) => {
    return val !== null && val !== undefined && val !== '';
  };
  const [selectedSource, setSelectedSource] = useState<DataSourceKey>(DEFAULT_DATA_SOURCE);
  const [data, setData] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState<'ingest' | 'browse' | 'upload'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dataPage:activeTab');
      if (saved === 'ingest' || saved === 'browse' || saved === 'upload') return saved;
    }
    return 'browse';
  });
  const [previewFile, setPreviewFile] = useState<S3FileEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [provinceFilter, setProvinceFilter] = useState<ProvinceFilter>('all');
  const [dateFilter, setDateFilter] = useState(() => getLocalDateInputValue());
  const [timeframes, setTimeframes] = useState<Array<{ fetch_run_id: string; fetched_at: string; device_id?: string }>>([]);
  const [timeframesLoading, setTimeframesLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [ecowittAccount, setEcowittAccount] = useState('lethuy2026n@gmail.com');
  const [ecowittPassword, setEcowittPassword] = useState('200417a@');
  const [ecowittAuthorize, setEcowittAuthorize] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);
  const [addDeviceError, setAddDeviceError] = useState('');
  const [addDeviceSuccess, setAddDeviceSuccess] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const canManageData = useMemo(() => authService.canAccess('DATA_MANAGER'), []);
  const [showExportModal, setShowExportModal] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [ecowittDevices, setEcowittDevices] = useState<Array<{ id: string; name: string }>>([]);

  // Form state for Upload Data Tab
  const [uploadGroup, setUploadGroup] = useState<'gis' | 'station' | 'monitoring'>('gis');
  
  // GIS Data Form States
  const [gisDataset, setGisDataset] = useState<string>('');
  const [gisCategory, setGisCategory] = useState<string>('');
  const [gisYear, setGisYear] = useState<string>(String(new Date().getFullYear()));
  const [gisMonth, setGisMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [gisDay, setGisDay] = useState<string>(String(new Date().getDate()));
  const [gisTime, setGisTime] = useState<string>(() => getNearestTimeSlot());
  const [gisDataType, setGisDataType] = useState<string>('');
  const [gisDescription, setGisDescription] = useState<string>('');
  
  // Station & Monitoring Form States
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedParam, setSelectedParam] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>(() => getNearestTimeSlot());
  const [uploadDescription, setUploadDescription] = useState<string>('');
  const [stationDataType, setStationDataType] = useState<string>('');
  
  // File Upload States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>('');
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [recentUploads, setRecentUploads] = useState<S3FileEntry[]>([]);
  const [s3RefreshTrigger, setS3RefreshTrigger] = useState<number>(0);
  const [selectedRecentKeys, setSelectedRecentKeys] = useState<string[]>([]);
  const [visibleRecentCount, setVisibleRecentCount] = useState<number>(15);
  const [isDeletingRecent, setIsDeletingRecent] = useState<boolean>(false);
  const [stationTab, setStationTab] = useState<'stations' | 'import'>('stations');

  // Manual Station CRUD States
  const [manualStations, setManualStations] = useState<ManualStation[]>([]);
  const [manualStationsLoading, setManualStationsLoading] = useState(false);
  const [manualStationTypeFilter, setManualStationTypeFilter] = useState<'all' | 'groundwater' | 'surface_water'>('all');
  const [showManualStationForm, setShowManualStationForm] = useState(false);
  const [editingManualStation, setEditingManualStation] = useState<ManualStation | null>(null);
  const [mapPreviewStation, setMapPreviewStation] = useState<ManualStation | null>(null);

  // Form states for manual station
  const [manualStationType, setManualStationType] = useState<'groundwater' | 'surface_water'>('groundwater');
  const [manualLocation, setManualLocation] = useState('');
  const [manualStationId, setManualStationId] = useState('');
  const [manualHydroChar, setManualHydroChar] = useState('');
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');
  const [manualImageCode, setManualImageCode] = useState('');
  const [manualIsActive, setManualIsActive] = useState(true);
  const [manualImageFiles, setManualImageFiles] = useState<File[]>([]);
  const [currentImages, setCurrentImages] = useState<Array<{ key: string, blobUrl: string }>>([]);

  // Excel Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStationType, setImportStationType] = useState<'groundwater' | 'surface_water'>('groundwater');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ successCount: number; duplicateCount?: number; failCount: number; errors: string[]; message: string } | null>(null);
  const [isImportDragActive, setIsImportDragActive] = useState(false);

  // Water Quality Import States
  const [wqFile, setWqFile] = useState<File | null>(null);
  const [wqSampleDate, setWqSampleDate] = useState('');
  const [wqNotes, setWqNotes] = useState('');
  const [wqPreviewing, setWqPreviewing] = useState(false);
  const [wqImporting, setWqImporting] = useState(false);
  const [wqPreview, setWqPreview] = useState<WaterQualityPreviewResult | null>(null);
  const [wqPreviewError, setWqPreviewError] = useState('');
  const [wqDuplicateAction, setWqDuplicateAction] = useState<'overwrite' | 'add' | null>(null);
  const [wqImportSuccess, setWqImportSuccess] = useState('');
  const [selectedStationForSamples, setSelectedStationForSamples] = useState<ManualStation | null>(null);
  const [stationSamples, setStationSamples] = useState<WaterQualitySampleDto[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [selectedSampleDetail, setSelectedSampleDetail] = useState<WaterQualitySampleDto | null>(null);
  const [isWqDragActive, setIsWqDragActive] = useState(false);

  // Standalone Water Quality Import States
  const [wqImportStationType, setWqImportStationType] = useState<'all' | 'groundwater' | 'surface_water'>('all');
  const [wqImportStationId, setWqImportStationId] = useState<number | null>(null);

  // WQ Import History States
  const [wqHistorySamples, setWqHistorySamples] = useState<WaterQualitySampleDto[]>([]);
  const [wqHistorySampleDate, setWqHistorySampleDate] = useState<string>('');
  const [wqHistorySample, setWqHistorySample] = useState<WaterQualitySampleDto | null>(null);
  const [wqHistoryLoading, setWqHistoryLoading] = useState(false);
  const [wqHistoryRefresh, setWqHistoryRefresh] = useState(0);

  // Global Recent Samples States
  const [recentSamples, setRecentSamples] = useState<WaterQualitySampleDto[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const fetchRecentSamples = useCallback(async () => {
    setRecentLoading(true);
    try {
      const data = await listRecentWaterQualitySamples();
      setRecentSamples(data || []);
    } catch (err) {
      console.error("Failed to load recent water quality samples:", err);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  // Fetch recent samples when view loads or updates
  useEffect(() => {
    if (activeTab === 'upload' && uploadGroup === 'station') {
      void fetchRecentSamples();
    }
  }, [activeTab, uploadGroup, wqHistoryRefresh, fetchRecentSamples]);

  // Reset WQ import states when switching to station tab
  useEffect(() => {
    if (uploadGroup !== 'station') {
      setWqFile(null); setWqPreview(null); setWqPreviewError('');
      setWqImportSuccess(''); setWqDuplicateAction(null);
      setWqImportStationType('all'); setWqImportStationId(null);
    }
  }, [uploadGroup]);

  const fetchManualStations = useCallback(async () => {
    setManualStationsLoading(true);
    try {
      const data = await listManualStations();
      setManualStations(data || []);
    } catch (err) {
      console.error("Failed to load manual stations:", err);
    } finally {
      setManualStationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'upload' && uploadGroup === 'station') {
      void fetchManualStations();
    }
  }, [activeTab, uploadGroup, fetchManualStations]);

  // Fetch WQ history when station changes in import tab
  useEffect(() => {
    if (!wqImportStationId) {
      setWqHistorySamples([]);
      setWqHistorySampleDate('');
      setWqHistorySample(null);
      return;
    }
    setWqHistoryLoading(true);
    console.log("[WQ History] Fetching samples for station ID:", wqImportStationId, "URL:", getBackendAdminUrl(`/gis/water-quality/station/${wqImportStationId}`));
    listWaterQualitySamples(wqImportStationId).then(samples => {
      console.log("[WQ History] Samples received:", samples, "count:", samples?.length);
      const sorted = (samples || []).sort((a, b) => b.sampleDate.localeCompare(a.sampleDate));
      setWqHistorySamples(sorted);
      if (sorted.length > 0) {
        setWqHistorySampleDate(sorted[0].sampleDate);
        getWaterQualitySample(sorted[0].id).then(detail => setWqHistorySample(detail)).catch(() => setWqHistorySample(null));
      } else {
        setWqHistorySampleDate('');
        setWqHistorySample(null);
      }
    }).catch(() => {
      setWqHistorySamples([]);
      setWqHistorySampleDate('');
      setWqHistorySample(null);
    }).finally(() => setWqHistoryLoading(false));
  }, [wqImportStationId, wqHistoryRefresh]);

  // Fetch WQ history detail when date changes

  // Fetch WQ history detail when date changes
  useEffect(() => {
    if (!wqImportStationId || !wqHistorySampleDate) return;
    const sample = wqHistorySamples.find(s => s.sampleDate === wqHistorySampleDate);
    if (sample) {
      if (sample.parameters) {
        setWqHistorySample(sample);
      } else {
        getWaterQualitySample(sample.id).then(detail => setWqHistorySample(detail)).catch(() => setWqHistorySample(null));
      }
    }
  }, [wqHistorySampleDate, wqImportStationId]);

  const handleOpenManualStationForm = (station: ManualStation | null = null) => {
    setManualImageFiles([]);
    setCurrentImages([]);
    if (station) {
      setEditingManualStation(station);
      setManualStationType(station.stationType);
      setManualLocation(station.location);
      setManualStationId(station.stationId || '');
      setManualHydroChar(station.hydroChar || '');
      setManualX(station.x != null ? String(station.x) : '');
      setManualY(station.y != null ? String(station.y) : '');
      setManualImageCode(station.imageCode || '');
      setManualIsActive(station.isActive !== false);

      if (station.imageCode && station.stationType === 'surface_water') {
        const keys = station.imageCode.split(',').map(k => k.trim()).filter(Boolean);
        const token = authService.getToken();
        
        keys.forEach((key) => {
          fetch(getBackendUrl(`/s3/download?key=${encodeURIComponent(key)}`), {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          })
            .then((res) => {
              if (res.ok) return res.blob();
              throw new Error();
            })
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              setCurrentImages((prev) => [...prev, { key, blobUrl: url }]);
            })
            .catch(() => {
              console.error("Failed to load station image preview blob for: " + key);
            });
        });
      }
    } else {
      setEditingManualStation(null);
      setManualStationType('groundwater');
      setManualLocation('');
      setManualStationId('');
      setManualHydroChar('');
      setManualX('');
      setManualY('');
      setManualImageCode('');
      setManualIsActive(true);
    }
    setShowManualStationForm(true);
  };

  useEffect(() => {
    if (!showManualStationForm) {
      currentImages.forEach((img) => {
        if (img.blobUrl && img.blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.blobUrl);
        }
      });
      setCurrentImages([]);
      setManualImageFiles([]);
    }
  }, [showManualStationForm]);

  const handleSaveManualStation = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualLocation.trim()) {
      alert("Vui lòng nhập Địa điểm!");
      return;
    }
    const xVal = parseFloat(manualX);
    const yVal = parseFloat(manualY);
    if (isNaN(xVal) || isNaN(yVal)) {
      alert("Vui lòng nhập toạ độ X và Y hợp lệ!");
      return;
    }

    let uploadedKeys: string[] = [];

    // Upload selected image files to S3 concurrently
    if (manualStationType === 'surface_water' && manualImageFiles.length > 0) {
      try {
        const uploadPromises = manualImageFiles.map(async (file, idx) => {
          const ext = file.name.substring(file.name.lastIndexOf('.'));
          const s3Key = `station-data/manual-stations/station_${Date.now()}_${idx}${ext}`;
          const uploadRes = await uploadS3File(file, s3Key);
          return uploadRes.key;
        });
        uploadedKeys = await Promise.all(uploadPromises);
      } catch (err: any) {
        alert("Lỗi khi tải ảnh hiện trường lên máy chủ S3: " + (err.message || err));
        return;
      }
    }

    // Combine kept existing S3 keys and newly uploaded keys
    const keptKeys = currentImages.map(img => img.key);
    const allKeys = [...keptKeys, ...uploadedKeys].map(k => k.trim()).filter(Boolean);
    const finalImageCode = allKeys.join(',');

    const payload: ManualStation = {
      stationId: manualStationId.trim() || undefined,
      stationType: manualStationType,
      location: manualLocation.trim(),
      hydroChar: manualHydroChar.trim() || undefined,
      x: xVal,
      y: yVal,
      imageCode: manualStationType === 'surface_water' ? finalImageCode || undefined : undefined,
      isActive: manualIsActive
    };

    try {
      if (editingManualStation && editingManualStation.id) {
        await updateManualStation(editingManualStation.id, payload);
        alert("Cập nhật trạm thành công!");
      } else {
        await createManualStation(payload);
        alert("Thêm trạm thành công!");
      }
      setShowManualStationForm(false);
      void fetchManualStations();
    } catch (err: any) {
      alert("Lỗi khi lưu trạm: " + (err.message || err));
    }
  };

  const handleDeleteManualStation = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa trạm này?")) return;
    try {
      await deleteManualStation(id);
      alert("Xóa trạm thành công!");
      void fetchManualStations();
    } catch (err: any) {
      alert("Lỗi khi xóa trạm: " + (err.message || err));
    }
  };

  const handleExcelFileChange = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      alert("Vui lòng chọn tệp Excel (.xlsx hoặc .xls)!");
      return;
    }
    setImportFile(file);
    setImportResult(null);
  };

  const handleImportExcel = async (e: FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      alert("Vui lòng chọn tệp Excel!");
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await importManualStations(importFile, importStationType);
      setImportResult(res);
      if (res.successCount > 0) {
        void fetchManualStations();
      }
    } catch (err: any) {
      alert("Lỗi khi nhập trạm từ Excel: " + (err.message || err));
    } finally {
      setImportLoading(false);
    }
  };

  // Persist active tab across page reloads
  useEffect(() => {
    localStorage.setItem('dataPage:activeTab', activeTab);
  }, [activeTab]);

  const fetchAndSetRecentUploads = async () => {
    try {
      const { files: allFiles, _error } = await listS3Files('');
      const files = _error ? [] : allFiles;
      const filtered = files.filter((file) => {
        const keyLower = file.key.toLowerCase();
        return !keyLower.startsWith('backups/') && !keyLower.endsWith('.sql') && !keyLower.endsWith('.sql.gz');
      });
      const sorted = filtered.sort((a, b) => {
        const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return timeB - timeA;
      });
      const entries: S3FileEntry[] = sorted.map((file) => ({
        key: file.key,
        size: file.size ?? 0,
        lastModified: file.lastModified || new Date().toISOString(),
      }));
      setRecentUploads(entries);
    } catch {
      setRecentUploads([]);
    }
  };

  // Load recent uploads when switching to upload tab
  useEffect(() => {
    if (activeTab === 'upload') {
      void fetchAndSetRecentUploads();
      setVisibleRecentCount(15);
      setSelectedRecentKeys([]);
    }
  }, [activeTab]);

  const handleRecentScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setVisibleRecentCount(prev => Math.min(prev + 10, recentUploads.length));
    }
  };

  // Synchronize GIS Category when GIS Dataset changes
  useEffect(() => {
    if (!gisDataset) {
      setGisCategory('');
      return;
    }
    const datasetConfig = GIS_DATASETS[gisDataset as keyof typeof GIS_DATASETS];
    if (datasetConfig && datasetConfig.categories.length > 0) {
      setGisCategory(datasetConfig.categories[0].key);
    }
  }, [gisDataset]);



  const selectedSourceConfig = DATA_SOURCE_OPTIONS.find((option) => option.key === selectedSource) ?? DATA_SOURCE_OPTIONS[0];
  const selectedTimeframe = useMemo(
    () => timeframes.find((timeframe) => timeframe.fetch_run_id === selectedRunId) || null,
    [selectedRunId, timeframes],
  );

  const loadData = useCallback(
    async (source: DataSourceKey, date?: string, runId?: string) => {
      setLoading(true);
      try {
        setData(await loadDataRows(source, date, runId, deviceId || undefined));
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unauthorized')) {
          authService.logout();
          router.replace('/auth');
          return;
        }

        console.error('loadData error:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [router, deviceId],
  );

  const loadTimeframes = useCallback(async (source: DataSourceKey, date: string) => {
    setTimeframesLoading(true);
    try {
      const fetchedTimeframes = await loadDataTimeframes(source, date, deviceId || undefined);
      setTimeframes(fetchedTimeframes);
      setSelectedRunId((currentRunId) =>
        fetchedTimeframes.some((timeframe) => timeframe.fetch_run_id === currentRunId)
          ? currentRunId
          : fetchedTimeframes[0]?.fetch_run_id || '',
      );
    } catch (error) {
      console.error('loadTimeframes error:', error);
      setTimeframes([]);
      setSelectedRunId('');
    } finally {
      setTimeframesLoading(false);
    }
  }, [deviceId]);

  // Combined auth check and data loading
  useEffect(() => {
    // Check auth first
    const checkAuth = () => {
      if (!authService.isAuthenticated()) {
        router.replace('/auth');
        return false;
      }
      if (!authService.isTokenValid()) {
        authService.logout();
        router.replace('/auth');
        return false;
      }
    return true;
    };

    if (checkAuth()) {
      setAuthChecked(true);
      // Reset filters and load data
      setSearchTerm('');
      setProvinceFilter('all');
      setDateFilter(getLocalDateInputValue());
      setTimeframes([]);
      setSelectedRunId('');
      setData([]);
      void loadData(selectedSource);
    }
  }, [loadData, router, selectedSource]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    if (dateFilter) {
      void loadTimeframes(selectedSource, dateFilter);
    } else {
      setTimeframes([]);
      setSelectedRunId('');
    }
  }, [authChecked, dateFilter, loadTimeframes, selectedSource]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    void loadData(
      selectedSource,
      dateFilter || undefined,
      dateFilter ? selectedRunId || undefined : undefined,
    );
  }, [authChecked, dateFilter, loadData, selectedRunId, selectedSource]);

  // Load device list from API for ecowitt
  useEffect(() => {
    if (!authChecked || selectedSource !== 'ecowitt') return;

    const fetchDevices = async () => {
      try {
        const res = await fetch('/api/ecowitt/devices');
        const data = await res.json();
        if (data.devices && Array.isArray(data.devices) && data.devices.length > 0) {
          setEcowittDevices(data.devices);
        } else {
          const devices = await loadDataDevices('ecowitt');
          if (devices.length > 0) {
            setEcowittDevices(devices.map((d) => ({ id: d.device_id, name: `Trạm ${d.device_id}` })));
          } else {
            setEcowittDevices([]);
          }
        }
      } catch {
        try {
          const devices = await loadDataDevices('ecowitt');
          if (devices.length > 0) {
            setEcowittDevices(devices.map((d) => ({ id: d.device_id, name: `Trạm ${d.device_id}` })));
          }
        } catch {
          setEcowittDevices([]);
        }
      }
    };

    fetchDevices();
  }, [authChecked, selectedSource]);

  // Auto-refresh every 30s for ecowitt to pick up new fetch runs
  useEffect(() => {
    if (!authChecked || selectedSource !== 'ecowitt') return;

    const intervalId = setInterval(() => {
      if (fetching) return;
      if (dateFilter) {
        void loadTimeframes(selectedSource, dateFilter);
      }
      void loadData(
        selectedSource,
        dateFilter || undefined,
        dateFilter ? selectedRunId || undefined : undefined,
      );
    }, 30000);

    return () => clearInterval(intervalId);
  }, [authChecked, selectedSource, dateFilter, loadTimeframes, loadData, selectedRunId, fetching]);

  // Don't render anything until auth is verified
  if (!authChecked) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontSize: '16px',
        color: '#64748b'
      }}>
        Đang xác thực quyền truy cập...
    </div>
  );
}

// ── Lịch tự động thu thập dữ liệu ──
const SCHEDULE_OPTIONS: Record<string, { cron: string; label: string }[]> = {
  ecowitt: [
    { cron: '*/5 * * * *', label: 'Mỗi 5 phút' },
    { cron: '*/15 * * * *', label: 'Mỗi 15 phút' },
    { cron: '*/30 * * * *', label: 'Mỗi 30 phút' },
    { cron: '0 * * * *', label: 'Mỗi 1 giờ' },
    { cron: '0 */3 * * *', label: 'Mỗi 3 giờ' },
    { cron: '0 */6 * * *', label: 'Mỗi 6 giờ' },
  ],
  mekong: [
    { cron: '0 */2 * * *', label: 'Mỗi 2 giờ (12 lần/ngày)' },
    { cron: '0 0,6,12,18 * * *', label: '4 lần/ngày (0, 6, 12, 18)' },
    { cron: '0 0,5,10,15,20 * * *', label: '5 lần/ngày (0, 5, 10, 15, 20)' },
    { cron: '0 0,8,16 * * *', label: '3 lần/ngày (0, 8, 16)' },
    { cron: '0 0,12 * * *', label: '2 lần/ngày (0, 12)' },
    { cron: '0 0 * * *', label: '1 lần/ngày (0h)' },
  ],
};
const CUSTOM_LABEL = '✏️ Tùy chỉnh...';

function ScheduleConfig({ source }: { source: string }) {
  const isAdmin = useMemo(() => authService.hasRole('ADMIN'), []);
  const key = source === 'mekong' ? 'mekong' : 'ecowitt';
  const options = SCHEDULE_OPTIONS[key];

  const [config, setConfig] = useState<{ ecowitt: { cron: string; label: string }; mekong: { cron: string; label: string } } | null>(null);
  const [sel, setSel] = useState('');
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings/fetch-schedule')
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        const current = key === 'ecowitt' ? data.ecowitt?.cron : data.mekong?.cron;
        const matched = options.find((o) => o.cron === current);
        if (matched) {
          setSel(matched.cron);
        } else {
          setSel('__custom__');
          setCustom(current || '');
        }
      })
      .catch(() => setConfig(null));
  }, [key]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMsg('');
    const cronVal = sel === '__custom__' ? custom : sel;
    const labelVal = sel === '__custom__' ? custom : (options.find((o) => o.cron === sel)?.label || sel);
    try {
      const body = key === 'ecowitt'
        ? { ecowitt: { cron: cronVal, label: labelVal }, mekong: config.mekong }
        : { ecowitt: config.ecowitt, mekong: { cron: cronVal, label: labelVal } };
      const res = await fetch('/api/settings/fetch-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        setMsg('Đã lưu thành công!');
      } else {
        setMsg(data.error || 'Lỗi không xác định');
      }
    } catch {
      setMsg('Không thể kết nối server');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin || !config) return null;

  const label = key === 'ecowitt' ? 'Ecowitt' : 'Mekong';

  return (
    <div style={{
      marginTop: '16px',
      padding: '12px 16px',
      background: 'rgba(13, 110, 253, 0.03)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid rgba(13, 110, 253, 0.1)',
    }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)' }}>
        ⏰ Lịch tự động thu thập · {label}
      </h4>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '180px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Chu kỳ</label>
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            style={{
              padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none',
            }}
          >
            {options.map((opt) => (
              <option key={opt.cron} value={opt.cron}>{opt.label}</option>
            ))}
            <option value="__custom__">{CUSTOM_LABEL}</option>
          </select>
        </div>
        {sel === '__custom__' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Cron expression</label>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="VD: */15 * * * *"
              style={{
                padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem',
                fontFamily: 'monospace', outline: 'none',
              }}
            />
          </div>
        )}
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '6px 16px', borderRadius: 'var(--radius-md)', border: 'none',
            background: saving ? 'var(--text-muted)' : 'var(--accent)', color: '#fff',
            fontSize: '0.82rem', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {saving ? '⏳' : 'Lưu'}
        </button>
        {msg && <span style={{ fontSize: '0.78rem', color: msg.includes('thành công') ? '#28a745' : '#dc3545' }}>{msg}</span>}
      </div>
    </div>
  );
}

  const handleFetchData = async () => {
    setFetching(true);
    try {
      const token = authService.getToken();
      const requestInit: RequestInit = selectedSource === 'ecowitt'
        ? {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              account: ecowittAccount,
              password: ecowittPassword,
              authorize: ecowittAuthorize,
            }),
          }
        : {
            method: 'POST',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          };

      const res = await fetch(`/api/fetch?source=${selectedSource}`, requestInit);
      const result = await res.json();

      if (res.ok) {
        if (dateFilter) {
          await loadTimeframes(selectedSource, dateFilter);
        } else {
          await loadData(selectedSource);
        }
        alert('Thành công: ' + result.message + '\\nDữ liệu mới đã được cập nhật vào CSDL và đồng bộ!');
      } else {
        alert('Lỗi: ' + result.message);
      }
    } catch {
      alert('Lỗi: Lỗi kết nối đến server');
    }
    setFetching(false);
  };

  const handleAddDevice = async () => {
    const deviceId = newDeviceId.trim();
    if (!deviceId) return;

    setAddingDevice(true);
    setAddDeviceError('');
    setAddDeviceSuccess('');

    try {
      const token = authService.getToken();
      const res = await fetch(`/api/fetch?source=ecowitt&deviceId=${encodeURIComponent(deviceId)}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await res.json();

      if (res.ok) {
        // Register device into ecowitt_device table
        try {
          const token = authService.getToken();
          await fetch('/api/ecowitt/devices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ deviceId }),
          });
        } catch { /* non-critical */ }

        setAddDeviceSuccess(`✓ Đã fetch dữ liệu cho device ${deviceId} thành công!`);
        setNewDeviceId('');
        setTimeout(() => setAddDeviceSuccess(''), 5000);
        // Refresh devices list & current data
        if (dateFilter) {
          await loadTimeframes(selectedSource, dateFilter);
        }
        await loadData(selectedSource, dateFilter || undefined, selectedRunId || undefined);
        // Refresh device list from API
        try {
          const token = authService.getToken();
          const devRes = await fetch('/api/ecowitt/devices', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const devData = await devRes.json();
          if (devData.devices && Array.isArray(devData.devices)) {
            setEcowittDevices(devData.devices);
          }
        } catch { /* keep current list */ }
      } else {
        setAddDeviceError(result.message || 'Lỗi không xác định');
      }
    } catch {
      setAddDeviceError('Lỗi kết nối đến server');
    }

    setAddingDevice(false);
  };

  const filteredData = data.filter((item) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      Object.values(item).some((value) => formatRecordValue(value).toLowerCase().includes(normalizedSearch));

    const mekongItem = item as Partial<MekongData> & DataRecord;
    const matchesProvince =
      selectedSource !== 'mekong' ||
      provinceFilter === 'all' ||
      mekongItem.SNShortName?.toUpperCase().includes(`- ${provinceFilter}`) ||
      mekongItem.SNDescription?.toUpperCase().includes(`- ${provinceFilter}`) ||
      mekongItem.SNShortNameEN?.toUpperCase().includes(`- ${provinceFilter}`) ||
      mekongItem.SNDescriptionEN?.toUpperCase().includes(`- ${provinceFilter}`);

    // Filter by date
    const matchesDate = !dateFilter || (() => {
      const fetchedAt = item.fetched_at || item.record_time;
      if (!fetchedAt) return false;
      const itemDate = getLocalDateString(fetchedAt);
      return itemDate === dateFilter;
    })();

    return Boolean(matchesSearch) && Boolean(matchesProvince) && Boolean(matchesDate);
  });

  const handleExportExcel = async (metric: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const token = authService.getToken();
    
    try {
      const res = await fetch(`/api/mekong-monthly/export?year=${year}&month=${month}&metric=${metric}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mekong-${metric}-${year}-${String(month).padStart(2, '0')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        alert('✓ Đã tải file Excel thành công!');
      } else {
        const errorData = await res.json();
        alert('Lỗi: ' + (errorData.error || 'Không thể export Excel'));
      }
    } catch (error) {
      alert('Lỗi kết nối: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const getS3PrefixForSelection = (): string => {
    if (uploadGroup === 'gis') {
      let prefix = 'gis-data/';
      if (gisDataset) {
        prefix += `${gisDataset}/`;
        if (gisCategory) {
          prefix += `${gisCategory}/`;
          if (gisYear) {
            prefix += `${gisYear}/`;
          }
        }
      }
      return prefix;
    } else if (uploadGroup === 'station') {
      let prefix = 'station-data/';
      if (stationDataType) {
        prefix += `${stationDataType}/`;
        if (selectedStation) {
          prefix += `${selectedStation}/`;
          if (selectedParam) {
            prefix += `${selectedParam}/`;
          }
        }
      }
      return prefix;
    } else {
      let prefix = 'monitoring-data/';
      if (selectedStation) {
        prefix += `${selectedStation}/`;
        if (selectedParam) {
          prefix += `${selectedParam}/`;
        }
      }
      return prefix;
    }
  };

  const sanitizeFilename = (filename: string): string => {
    return filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  };

  const getExpectedStoragePath = (filename: string): string => {
    if (!filename) return '';
    const cleanFilename = sanitizeFilename(filename);
    
    if (uploadGroup === 'gis') {
      const parts = ['gis-data', gisDataset, gisCategory, gisYear];
      if (gisMonth) parts.push(gisMonth.padStart(2, '0'));
      if (gisDay) parts.push(gisDay.padStart(2, '0'));
      if (gisTime) parts.push(gisTime.replace(':', '-'));
      parts.push(gisDataType);
      parts.push(cleanFilename);
      return parts.join('/');
    } else {
      const prefix = uploadGroup === 'station' ? 'station-data' : 'monitoring-data';
      const station = selectedStation || 'unknown-station';
      const param = selectedParam || 'unknown-param';
      
      let year = '2026';
      let month = '01';
      let day = '01';
      if (selectedDate) {
        const d = new Date(selectedDate);
        if (!Number.isNaN(d.getTime())) {
          year = String(d.getFullYear());
          month = String(d.getMonth() + 1).padStart(2, '0');
          day = String(d.getDate()).padStart(2, '0');
        }
      }
      
      const timePart = selectedTime ? selectedTime.replace(':', '-') : '00-00';
      const subpath = uploadGroup === 'station' ? `${stationDataType}/${station}` : station;
      return `${prefix}/${subpath}/${param}/${year}/${month}/${day}/${timePart}/${cleanFilename}`;
    }
  };

  const autoDetectType = (fileName: string) => {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    const rasterExts = ['.tif', '.tiff', '.cog', '.png', '.jpg', '.jpeg', '.rst'];
    const vectorExts = ['.geojson', '.shp', '.kml', '.gpkg', '.zip', '.vtc', '.vct', '.vdc'];
    
    if (uploadGroup === 'gis') {
      if (rasterExts.includes(ext)) {
        setGisDataType('raster');
      } else if (vectorExts.includes(ext)) {
        setGisDataType('vector');
      }
    }
  };

  const validateFile = (file: File): { valid: boolean; message?: string } => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (uploadGroup === 'gis') {
      if (gisDataType === 'raster') {
        const allowed = ['.tif', '.tiff', '.cog', '.png', '.jpg', '.jpeg', '.rst'];
        if (!allowed.includes(ext)) {
          return { valid: false, message: `File Raster không hợp lệ. Chỉ cho phép các định dạng: ${allowed.join(', ')}` };
        }
      } else if (gisDataType === 'vector') {
        const allowed = ['.geojson', '.shp', '.kml', '.gpkg', '.zip', '.vtc', '.vct', '.vdc'];
        if (!allowed.includes(ext)) {
          return { valid: false, message: `File Vector không hợp lệ. Chỉ cho phép các định dạng: ${allowed.join(', ')}` };
        }
      } else {
        const allowed = ['.tif', '.tiff', '.cog', '.png', '.jpg', '.jpeg', '.rst', '.geojson', '.shp', '.kml', '.gpkg', '.zip', '.vtc', '.vct', '.vdc'];
        if (!allowed.includes(ext)) {
          return { valid: false, message: `File GIS không hợp lệ. Chỉ cho phép các định dạng: ${allowed.join(', ')}` };
        }
      }
    } else {
      if (ext !== '.csv') {
        return { valid: false, message: 'File dữ liệu trạm không hợp lệ. Chỉ cho phép định dạng: .csv' };
      }
    }
    
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, message: 'Dung lượng file vượt quá giới hạn cho phép (tối đa 100MB)' };
    }
    
    return { valid: true };
  };

  const handleUploadData = async () => {
    if (!uploadFile) {
      alert('Vui lòng chọn file để tải lên!');
      return;
    }
    
    const valResult = validateFile(uploadFile);
    if (!valResult.valid) {
      alert(valResult.message);
      return;
    }
    
    if (uploadGroup === 'station' || uploadGroup === 'monitoring') {
      if (!selectedStation) {
        alert('Vui lòng chọn trạm dữ liệu!');
        return;
      }
      if (!selectedParam) {
        alert('Vui lòng chọn tham số đo lường!');
        return;
      }
      if (!selectedDate) {
        alert('Vui lòng chọn ngày!');
        return;
      }
      if (!selectedTime) {
        alert('Vui lòng chọn thời gian!');
        return;
      }
    }
    
    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadErrorMessage('');
    
    const key = getExpectedStoragePath(uploadFile.name);
    
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 150);
      
      const response = await uploadS3File(uploadFile, key, true);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('completed');
      
      setTimeout(async () => {
        setUploadFile(null);
        setUploadStatus('idle');
        setUploadProgress(0);
        
        await fetchAndSetRecentUploads();
        setVisibleRecentCount(15);
        setSelectedRecentKeys([]);
        setS3RefreshTrigger(prev => prev + 1);
      }, 5000);
      
      alert(`✓ Tải lên thành công!\n${response.key.split('/').pop()} → ${truncatePath(getParentPath(response.key) || '/', 50)}`);
    } catch (error) {
      setUploadStatus('failed');
      setUploadErrorMessage(error instanceof Error ? error.message : 'Lỗi không xác định khi tải lên S3');
      alert(`Lỗi tải lên: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteSelectedRecent = async () => {
    if (selectedRecentKeys.length === 0) return;
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa ${selectedRecentKeys.length} tệp đã chọn? Hành động này không thể hoàn tác.`);
    if (!confirmDelete) return;

    setIsDeletingRecent(true);
    try {
      for (const key of selectedRecentKeys) {
        await deleteS3File(key);
      }
      alert("Đã xóa thành công các tệp tin đã chọn!");
      setSelectedRecentKeys([]);
      setS3RefreshTrigger(prev => prev + 1);
      
      await fetchAndSetRecentUploads();
    } catch (err: any) {
      alert("Lỗi khi xóa tệp: " + (err.message || err));
    } finally {
      setIsDeletingRecent(false);
    }
  };

  const handleDeleteSingleRecent = async (key: string) => {
    try {
      await deleteS3File(key);
      alert("Đã xóa tệp tin thành công!");
      setSelectedRecentKeys(prev => prev.filter(k => k !== key));
      setS3RefreshTrigger(prev => prev + 1);
      
      await fetchAndSetRecentUploads();
    } catch (err: any) {
      alert("Lỗi khi xóa tệp: " + (err.message || err));
    }
  };

  const showProvinceFilter = selectedSource === 'mekong';
  const showTimeframePicker = Boolean(dateFilter);
  const ecowittColumns = selectedSource === 'ecowitt' ? getEcowittDisplayColumns(filteredData.length > 0 ? filteredData : data) : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Section */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '24px 0' }}>
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '48px', height: '48px', 
              background: 'linear-gradient(135deg, rgba(13, 110, 253, 0.15), rgba(13, 202, 240, 0.15))', 
              borderRadius: 'var(--radius-lg)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)',
              boxShadow: '0 2px 8px rgba(13, 110, 253, 0.2)'
            }}>
              <BarChart3 size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text)', margin: '0 0 4px 0' }}>Quản Lý Dữ Liệu Quan Trắc</h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0' }}>
                {selectedSourceConfig.label} • Dữ liệu thời gian thực từ cơ sở dữ liệu
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {activeTab === 'ingest' && (
              <button
                onClick={handleFetchData}
                disabled={fetching}
                style={{
                  padding: '10px 16px',
                  background: fetching ? 'var(--text-muted)' : 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: fetching ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <RefreshCw size={18} className={fetching ? 'animate-spin' : ''} style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
                {fetching ? 'Đang gọi API & ghi DB...' : `Quét dữ liệu mới: ${selectedSourceConfig.label}`}
              </button>
            )}

            {activeTab === 'browse' && (
              <>
                <button
                  onClick={() =>
                    loadData(
                      selectedSource,
                      dateFilter || undefined,
                      dateFilter ? selectedRunId || undefined : undefined,
                    )
                  }
                  disabled={loading}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--surface-strong)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                  Tải lại bảng DB
                </button>

                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={loading}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                  }}
                >
                  <FileSpreadsheet size={16} /> Tải Excel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {showExportModal && (
        <DataExportModal open={showExportModal} onClose={() => setShowExportModal(false)} timeframes={timeframes} date={dateFilter} />
      )}
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '24px', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Controls Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            {[
              { key: 'browse', label: 'Tra cứu dữ liệu', icon: Search, accent: '#2563a8', tint: 'rgba(37, 99, 168, 0.12)', activeTint: 'rgba(37, 99, 168, 0.18)' },
              ...(canManageData ? [{ key: 'ingest', label: 'Nhận dữ liệu', icon: Download, accent: '#198754', tint: 'rgba(25, 135, 84, 0.12)', activeTint: 'rgba(25, 135, 84, 0.18)' }] : []),
              ...(canManageData ? [{ key: 'upload', label: 'Nhập dữ liệu', icon: UploadCloud, accent: '#fd7e14', tint: 'rgba(253, 126, 20, 0.12)', activeTint: 'rgba(253, 126, 20, 0.18)' }] : []),
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'browse' | 'ingest' | 'upload')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '999px',
                    border: `1px solid ${isActive ? tab.accent : 'var(--border)'}`,
                    background: isActive
                      ? `linear-gradient(135deg, ${tab.accent} 0%, ${tab.accent} 70%, ${tab.accent} 100%)`
                      : `linear-gradient(180deg, ${tab.tint} 0%, var(--surface) 100%)`,
                    color: isActive ? '#fff' : tab.accent,
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease',
                    boxShadow: isActive
                      ? `0 8px 18px ${tab.activeTint}`
                      : '0 1px 2px rgba(15, 23, 42, 0.04)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <TabIcon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab !== 'upload' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)' }}>
                  <Server size={16} /> Nguồn dữ liệu
                </label>
                <select
                  value={selectedSource}
                  onChange={(event) => {
                    const nextSource = event.target.value as DataSourceKey;
                    setSelectedSource(nextSource);
                    setSelectedRunId('');
                    setTimeframes([]);
                  }}
                  style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                >
                  {DATA_SOURCE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>

              {selectedSource === 'ecowitt' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)' }}>
                    <Server size={16} /> Thiết bị
                  </label>
                  <select
                    value={deviceId}
                    onChange={(event) => setDeviceId(event.target.value)}
                    style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                  >
                    <option value="">Tất cả</option>
                    {ecowittDevices.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'browse' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)' }}>
                      <Search size={16} /> Tìm kiếm
                    </label>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)' }}>
                      <Calendar size={16} /> Lọc theo ngày
                    </label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        setDateFilter(nextDate);
                        setSelectedRunId('');
                        setTimeframes([]);
                      }}
                      style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>

                  {showTimeframePicker && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)' }}>
                        <Activity size={16} /> Khung giờ đã lưu
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedRunId('')}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '999px',
                            border: `1px solid ${selectedRunId ? 'var(--border)' : 'var(--accent)'}`,
                            background: selectedRunId ? 'var(--surface)' : 'var(--accent)',
                            color: selectedRunId ? 'var(--text-muted)' : '#fff',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Mới nhất trong ngày
                        </button>
                        {timeframesLoading ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>Đang tải khung giờ...</span>
                        ) : timeframes.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>Chưa có snapshot trong ngày này</span>
                        ) : (
                          timeframes.map((timeframe) => {
                            const active = selectedRunId === timeframe.fetch_run_id;
                            return (
                              <button
                                key={timeframe.fetch_run_id}
                                type="button"
                                onClick={() => setSelectedRunId(timeframe.fetch_run_id)}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '999px',
                                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                                  background: active ? 'var(--accent)' : 'var(--surface)',
                                  color: active ? '#fff' : 'var(--text-muted)',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                              >
                                {new Date(timeframe.fetched_at).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </button>
                            );
                          })
                        )}
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {selectedTimeframe
                          ? `Đang xem snapshot lúc ${new Date(selectedTimeframe.fetched_at).toLocaleTimeString('vi-VN')}`
                          : 'Chọn một khung giờ để xem đúng dữ liệu đã lưu trong ngày'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'browse' && showProvinceFilter && (
            <>
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)', marginBottom: '12px' }}>
                  <MapPin size={16} /> Lọc tỉnh
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { value: 'all' as const, label: 'Tất cả' },
                    { value: 'TV' as const, label: 'Trà Vinh (TV)' },
                    { value: 'BT' as const, label: 'Bến Tre (BT)' },
                    { value: 'VL' as const, label: 'Vĩnh Long (VL)' },
                  ].map((item) => {
                    const active = provinceFilter === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => setProvinceFilter(item.value)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-xl)',
                          border: '1px solid',
                          borderColor: active ? 'var(--accent)' : 'var(--border)',
                          background: active ? 'var(--accent)' : 'var(--surface)',
                          color: active ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
              </>
            )}

          {activeTab === 'ingest' && selectedSource === 'ecowitt' && (
            <>
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <User size={14} /> Account
                  </label>
                  <input
                    type="text"
                    value={ecowittAccount}
                    onChange={(event) => setEcowittAccount(event.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <Lock size={14} /> Password
                  </label>
                  <input
                    type="password"
                    value={ecowittPassword}
                    onChange={(event) => setEcowittPassword(event.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <Key size={14} /> Authorize (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={ecowittAuthorize}
                    onChange={(event) => setEcowittAuthorize(event.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(13, 110, 253, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(13, 110, 253, 0.1)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '600', color: 'var(--text)' }}>📡 Thêm thiết bị mới</h4>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value)}
                    placeholder="Nhập Device ID..."
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none' }}
                  />
                  <button
                    onClick={handleAddDevice}
                    disabled={addingDevice || !newDeviceId.trim()}
                    style={{
                      padding: '8px 20px', borderRadius: 'var(--radius-md)', border: 'none',
                      background: addingDevice ? 'var(--text-muted)' : 'var(--accent)', color: '#fff',
                      fontSize: '0.9rem', fontWeight: '600', cursor: addingDevice ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {addingDevice ? 'Đang thêm...' : 'Fetch & Thêm'}
                  </button>
                </div>
                {addDeviceError && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#dc3545' }}>{addDeviceError}</p>
                )}
                {addDeviceSuccess && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#28a745' }}>{addDeviceSuccess}</p>
                )}
              </div>

              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(220, 53, 69, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(220, 53, 69, 0.15)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '600', color: 'var(--text)' }}>📋 Danh sách thiết bị đã đăng ký</h4>
                {ecowittDevices.length === 0 ? (
                  <p style={{ margin: '8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Chưa có thiết bị nào được đăng ký.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ecowittDevices.map((dev) => (
                      <DeviceItem
                        key={dev.id}
                        device={dev}
                        onRefresh={() => {
                          const token = authService.getToken();
                          fetch('/api/ecowitt/devices', {
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                          }).then(r => r.json()).then(data => {
                            if (data.devices && Array.isArray(data.devices)) setEcowittDevices(data.devices);
                          }).catch(() => {});
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'ingest' && <ScheduleConfig source={selectedSource} />}

          {activeTab === 'browse' && !loading && (
            <div style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(13, 110, 253, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(13, 110, 253, 0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={20} color="var(--accent)" />
              <div>
                <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text)', fontWeight: '500' }}>
                  Trạng thái: <strong>MySQL Database</strong> ({filteredData.length} kết quả)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Data Display */}
        {activeTab === 'browse' && loading ? (
          <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', border: '1px solid var(--border)' }}>
            <RefreshCw size={32} color="var(--text-muted)" className="animate-spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>
              Đang truy vấn MySQL ({selectedSource}{showTimeframePicker && selectedRunId ? ` · ${selectedRunId}` : ''})...
            </p>
          </div>
        ) : activeTab === 'browse' && filteredData.length === 0 ? (
          <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', border: '1px solid var(--border)' }}>
            <AlertCircle size={48} color="var(--border)" style={{ marginBottom: '16px' }} />
            <p style={{ color: 'var(--text)', fontSize: '1.1rem', fontWeight: '500', margin: '0 0 4px 0' }}>Không kết quả</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              {showTimeframePicker
                ? 'Chưa có dữ liệu trong khung giờ đã chọn hoặc chưa có snapshot trong ngày này.'
                : 'Không có dữ liệu trong DB hoặc không khớp bộ lọc.'}
            </p>
          </div>
        ) : activeTab === 'browse' && selectedSource === 'mekong' ? (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--surface-strong)' }}><tr>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}># ID</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>Mã cảm biến</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>Tên trạm</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>Tỉnh</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>Mã tỉnh</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>Trạng thái</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>Cập nhật cuối</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', textAlign: 'right' }}>Độ mặn</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', textAlign: 'right' }}>pH</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', textAlign: 'right' }}>Mực nước</th>
                    <th style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', textAlign: 'right' }}>Kiềm tính</th>
                  </tr></thead>
                <tbody>
                  {filteredData.map((item, idx) => {
                    const row = item as Partial<MekongData> & DataRecord;
                    const isActive = Number(row.is_active ?? 1) === 1;
                    return (
                      <tr key={String(row.id || row._id || idx)} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.id || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--accent)', fontWeight: '500' }}>{row.SensorNodeCode || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text)' }}>{row.SNShortName || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.ProvinceName || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.ProvinceCode || '-'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: isActive ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                          {isActive ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {row.fetched_at || row.last_seen_at || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#0369a1', fontWeight: '500', textAlign: 'right' }}>
                          {formatDecimalDisplay(row.Salinity)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#15803d', fontWeight: '500', textAlign: 'right' }}>
                          {formatDecimalDisplay(row.PH)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#4338ca', fontWeight: '500', textAlign: 'right' }}>
                          {formatDecimalDisplay(row.WaterLevel)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#c2410c', fontWeight: '500', textAlign: 'right' }}>
                          {formatDecimalDisplay(row.Alkalinity)}
                        </td>
                        </tr>                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'browse' ? (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--surface-strong)' }}><tr>
                    {ecowittColumns.map((col) => (
                      <th key={col.key} style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {col.label}
                      </th>
                    ))}
                  </tr></thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr key={String(item.id || item._id || idx)} style={{ borderBottom: '1px solid var(--border)' }}>
                      {ecowittColumns.map((col) => (
                        <td key={col.key} style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {formatRecordValue(item[col.key]) || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {canManageData && activeTab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '10px' }}>
            
            {/* 1. Data Group Selection (Always visible at the top of the upload tab) */}
            <div className="glass-panel" style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--shadow-md)', width: '100%' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="var(--accent)" /> Chọn Nhóm Dữ Liệu
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { key: 'gis', label: 'GIS Data' },
                  { key: 'station', label: 'Station Data' },
                  { key: 'monitoring', label: 'Monitoring Data' }
                ].map((group) => {
                  const active = uploadGroup === group.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => {
                        setUploadGroup(group.key as any);
                        setUploadFile(null);
                        setUploadStatus('idle');
                      }}
                      className={`group-btn ${active ? 'active' : ''}`}
                      style={{
                        padding: '10px 20px',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Server size={16} /> {group.label}
                    </button>
                  );
                })}
              </div>
            </div>

{uploadGroup === 'station' ? (
              /* --- CRUD MANUAL STATIONS + WATER QUALITY IMPORT --- */
              <div className="glass-panel fade-in" style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: 'var(--shadow-md)', width: '100%' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: 'rgba(25, 135, 84, 0.12)', border: '1px solid rgba(25, 135, 84, 0.2)', color: '#198754', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Server size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)' }}>
                        Quản Lý Trạm Dữ Liệu Thủ Công (Manual Stations)
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Thêm, sửa, xóa các điểm trạm thu thập thủ công (nước ngầm & nước mặt)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs: Stations / Import */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  {[
                    { key: 'stations', label: 'Quản lý trạm', icon: <Server size={16} /> },
                    { key: 'import', label: 'Nhập dữ liệu', icon: <FileSpreadsheet size={16} /> }
                  ].map(tab => {
                    const active = stationTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStationTab(tab.key as any)}
                        style={{
                          padding: '8px 18px',
                          border: 'none',
                          background: active ? 'var(--accent)' : 'transparent',
                          color: active ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    );
                  })}
                </div>

                {stationTab === 'stations' ? (
                  <>
                    {/* Filter + Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '999px', overflow: 'hidden', background: 'var(--background-soft)' }}>
                        {[
                          { key: 'all', label: 'Tất cả' },
                          { key: 'groundwater', label: 'Trạm nước ngầm' },
                          { key: 'surface_water', label: 'Trạm nước mặt' }
                        ].map(opt => {
                          const active = manualStationTypeFilter === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setManualStationTypeFilter(opt.key as any)}
                              style={{
                                padding: '6px 16px', border: 'none',
                                background: active ? 'var(--accent)' : 'transparent',
                                color: active ? '#fff' : 'var(--text-muted)',
                                fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderRadius: active ? '999px' : '0'
                              }}
                            >{opt.label}</button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => { setImportFile(null); setImportResult(null); setImportStationType('groundwater'); setShowImportModal(true); }}
                          style={{ padding: '8px 16px', background: 'rgba(25, 135, 84, 0.12)', border: '1px solid rgba(25, 135, 84, 0.2)', color: '#198754', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileSpreadsheet size={16} /> Nhập từ Excel
                        </button>
                        <button type="button" onClick={() => handleOpenManualStationForm(null)}
                          style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(13, 110, 253, 0.2)' }}>
                          <Plus size={16} /> Thêm trạm mới
                        </button>
                      </div>
                    </div>

                    {/* Bảng dữ liệu */}
                    {manualStationsLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px', color: 'var(--text-muted)' }}>
                        <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
                        <span style={{ fontSize: '0.9rem' }}>Đang tải danh sách trạm...</span>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--background-soft)', borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>ID</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>Mã trạm</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>Loại trạm</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>Địa điểm</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>Đặc tính thủy vực</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>X (Kinh độ)</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>Y (Vĩ độ)</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>Hiện trường (Pics)</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)' }}>Trạng thái</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text)', textAlign: 'center' }}>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const filtered = manualStations.filter(st => {
                                if (manualStationTypeFilter === 'all') return true;
                                return st.stationType === manualStationTypeFilter;
                              });
                              if (filtered.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                      Không tìm thấy trạm nào. Click nút "Thêm trạm mới" để bắt đầu!
                                    </td>
                                  </tr>
                                );
                              }
                              return filtered.map(st => (
                                <tr key={st.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-bg-surface-strong">
                                  <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-muted)' }}>{st.id}</td>
                                  <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text)' }}>{st.stationId || '—'}</td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <span style={{
                                      display: 'inline-block', whiteSpace: 'nowrap', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                                      background: st.stationType === 'groundwater' ? 'rgba(13, 110, 253, 0.12)' : 'rgba(25, 135, 84, 0.12)',
                                      color: st.stationType === 'groundwater' ? '#0d6efd' : '#198754',
                                      border: st.stationType === 'groundwater' ? '1px solid rgba(13, 110, 253, 0.2)' : '1px solid rgba(25, 135, 84, 0.2)'
                                    }}>
                                      {st.stationType === 'groundwater' ? 'Nước ngầm' : 'Nước mặt'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: '500', color: 'var(--text)' }}>
                                    <button onClick={() => setMapPreviewStation(st)} type="button"
                                      style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: 'var(--text)', fontWeight: '500', cursor: 'pointer', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                      className="hover-underline text-accent-hover" title="Xem vị trí trên bản đồ">
                                      <MapPin size={12} color="var(--accent)" /> {st.location}
                                    </button>
                                  </td>
                                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{st.hydroChar || '—'}</td>
                                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                    {st.x != null ? (
                                      <button onClick={() => setMapPreviewStation(st)} type="button"
                                        style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontFamily: 'monospace', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        className="hover-underline text-accent-hover" title="Xem vị trí trên bản đồ">
                                        {parseFloat(st.x.toFixed(6))}
                                      </button>
                                    ) : '—'}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                    {st.y != null ? (
                                      <button onClick={() => setMapPreviewStation(st)} type="button"
                                        style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontFamily: 'monospace', color: 'var(--text-muted)', cursor: 'pointer' }}
                                        className="hover-underline text-accent-hover" title="Xem vị trí trên bản đồ">
                                        {parseFloat(st.y.toFixed(6))}
                                      </button>
                                    ) : '—'}
                                  </td>
                                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                                    {st.stationType === 'surface_water' ? (
                                      st.imageCode ? (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                                          {st.imageCode.split(',').map((key, idx) => {
                                            const trimmed = key.trim();
                                            if (!trimmed) return null;
                                            return (
                                              <button key={idx} onClick={() => setPreviewFile({ key: trimmed, size: 0, lastModified: '' })}
                                                className="hover-bg-muted" type="button"
                                                style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', gap: '4px', background: 'var(--surface-strong)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '6px', color: 'var(--accent)', fontWeight: '600', fontSize: '0.74rem', cursor: 'pointer' }}
                                                title={trimmed.split('/').pop()}>
                                                🖼️ Ảnh {idx + 1}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Chưa có</span>
                                    ) : <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>—</span>}
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <span style={{
                                      display: 'inline-block', whiteSpace: 'nowrap', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700',
                                      background: st.isActive !== false ? 'rgba(25, 135, 84, 0.12)' : 'rgba(220, 53, 69, 0.12)',
                                      color: st.isActive !== false ? '#198754' : '#dc3545',
                                      border: st.isActive !== false ? '1px solid rgba(25, 135, 84, 0.2)' : '1px solid rgba(220, 53, 69, 0.2)'
                                    }}>
                                      {st.isActive !== false ? 'Hoạt động' : 'Tạm dừng'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                      <button onClick={() => handleOpenManualStationForm(st)} type="button" title="Sửa thông tin"
                                        style={{ border: '1px solid var(--border)', background: 'var(--surface-strong)', color: 'var(--accent)', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Pencil size={14} />
                                      </button>
                                      <button onClick={() => st.id && handleDeleteManualStation(st.id)} type="button" title="Xóa trạm"
                                        style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  /* ─── Import Tab ─── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', background: 'rgba(13, 110, 253, 0.12)', border: '1px solid rgba(13, 110, 253, 0.2)', color: '#0d6efd', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BarChart3 size={18} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text)' }}>Nhập Dữ Liệu Chất Lượng Nước</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chọn trạm và tải lên file Excel chất lượng nước</p>
                      </div>
                    </div>

                    {/* Station Type + Station Selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={14} color="var(--accent)" /> Loại trạm
                        </label>
                        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '999px', overflow: 'hidden', background: 'var(--background-soft)' }}>
                          {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'groundwater', label: 'Nước ngầm' },
                            { key: 'surface_water', label: 'Nước mặt' }
                          ].map(opt => {
                            const active = wqImportStationType === opt.key;
                            return (
                              <button
                                key={opt.key} type="button"
                                onClick={() => { setWqImportStationType(opt.key as any); setWqImportStationId(null); }}
                                style={{
                                  padding: '6px 12px', border: 'none',
                                  background: active ? 'var(--accent)' : 'transparent',
                                  color: active ? '#fff' : 'var(--text-muted)',
                                  fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', flex: 1,
                                  transition: 'all 0.2s', borderRadius: active ? '999px' : '0'
                                }}
                              >{opt.label}</button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} color="var(--accent)" /> Chọn trạm <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <select
                          value={wqImportStationId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWqImportStationId(val ? Number(val) : null);
                            setWqFile(null); setWqPreview(null); setWqPreviewError(''); setWqImportSuccess(''); setWqDuplicateAction(null);
                            setWqSampleDate(new Date().toISOString().slice(0, 10));
                          }}
                          style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontSize: '0.88rem', cursor: 'pointer' }}
                        >
                          <option value="">-- Chọn trạm --</option>
                          {manualStations
                            .filter(st => wqImportStationType === 'all' || st.stationType === wqImportStationType)
                            .map(st => (
                              <option key={st.id} value={st.id}>
                                {st.stationId ? `${st.stationId} — ` : ''}{st.location} ({st.stationType === 'groundwater' ? 'Nước ngầm' : 'Nước mặt'})
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>

                    {/* Import Form */}
                    {wqImportStationId && wqSampleDate !== '' && !wqPreview && !wqImportSuccess && (
                      <div style={{ background: 'var(--background-soft)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UploadCloud size={16} color="var(--accent)" /> Import dữ liệu từ file Excel
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={14} color="var(--text-muted)" /> Ngày lấy mẫu <span style={{ color: '#dc3545' }}>*</span>
                            </label>
                            <input type="date" value={wqSampleDate} onChange={e => setWqSampleDate(e.target.value)}
                              style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.85rem' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Pencil size={14} color="var(--text-muted)" /> Ghi chú (tuỳ chọn)
                            </label>
                            <input type="text" value={wqNotes} onChange={e => setWqNotes(e.target.value)}
                              placeholder="Ví dụ: Đợt lấy mẫu tháng 6..."
                              style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.85rem' }} />
                          </div>
                        </div>
                        <div
                          onDrop={e => { e.preventDefault(); setIsWqDragActive(false); const f = e.dataTransfer.files[0]; if(f) setWqFile(f); }}
                          onDragOver={e => { e.preventDefault(); setIsWqDragActive(true); }}
                          onDragLeave={() => setIsWqDragActive(false)}
                          onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls'; inp.onchange=e => { const f = (e.target as HTMLInputElement).files?.[0]; if(f) setWqFile(f); }; inp.click(); }}
                          style={{
                            border: `2px dashed ${isWqDragActive ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer',
                            background: isWqDragActive ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent', transition: 'all 0.2s'
                          }}
                        >
                          {wqFile ? (
                            <p style={{ margin: 0, fontWeight: '600', color: 'var(--accent)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <Check size={16} color="#198754" /> {wqFile.name}
                            </p>
                          ) : (
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              <FileSpreadsheet size={20} style={{ marginBottom: '4px', display: 'block', margin: '0 auto 6px' }} />
                              Kéo thả file Excel vào đây hoặc <strong style={{ color: 'var(--accent)' }}>bấm để chọn file</strong>
                            </p>
                          )}
                        </div>
                        {wqPreviewError && (
                          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} color="#ef4444" /> {wqPreviewError}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button" disabled={!wqFile || !wqSampleDate || wqPreviewing}
                            onClick={async () => {
                              if (!wqFile || !wqSampleDate) return;
                              setWqPreviewing(true); setWqPreviewError(''); setWqPreview(null);
                              try {
                                const result = await previewWaterQualityExcel(wqFile, wqSampleDate);
                                if (!result.stationFound) { setWqPreviewError(result.errorMessage || 'Không tìm thấy trạm.'); }
                                else {
                                  const selected = manualStations.find(st => st.id === wqImportStationId);
                                  if (selected?.stationId && result.recognizedStationId
                                    && selected.stationId.toUpperCase() !== result.recognizedStationId.toUpperCase()) {
                                    setWqPreviewError(`Mã trạm trong file Excel ("${result.recognizedStationId}") không khớp với trạm đã chọn ("${selected.stationId}"). Vui lòng chọn đúng trạm hoặc kiểm tra lại file Excel.`);
                                  } else {
                                    setWqPreview(result);
                                  }
                                }
                              } catch { setWqPreviewError('Lỗi kết nối máy chủ. Vui lòng thử lại.'); }
                              finally { setWqPreviewing(false); }
                            }}
                            style={{ flex: 1, padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: (!wqFile || !wqSampleDate || wqPreviewing) ? 'not-allowed' : 'pointer', opacity: (!wqFile || !wqSampleDate || wqPreviewing) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {wqPreviewing ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Đang phân tích...
                              </>
                            ) : (
                              <>
                                <Search size={14} /> Xem trước dữ liệu
                              </>
                            )}
                          </button>
                          <button type="button" onClick={() => { setWqSampleDate(''); setWqFile(null); }} style={{ padding: '9px 14px', background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }}>Hủy</button>
                        </div>
                      </div>
                    )}

                    {/* Preview Panel */}
                    {wqPreview && !wqImportSuccess && (
                      <div style={{ background: 'var(--background-soft)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'modalPanelIn 0.3s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileSpreadsheet size={16} color="var(--accent)" /> Xem trước dữ liệu nhập
                            </h5>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Trạm nhận diện: <strong style={{ color: 'var(--accent)' }}>{wqPreview.recognizedStationId}</strong>
                              {wqPreview.stationLocation && ` — ${wqPreview.stationLocation}`}
                              {wqPreview.zoneDescription && ` · Zone: ${wqPreview.zoneDescription}`}
                              {wqPreview.qcvnStandard && ` · ${wqPreview.qcvnStandard}`}
                            </p>
                          </div>
                          {wqPreview.duplicateExists && !wqDuplicateAction && (
                            <div style={{ padding: '8px 14px', background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#c67c00', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertCircle size={14} color="#c67c00" /> Đã có dữ liệu cho ngày <strong>{wqSampleDate}</strong>. Chọn:
                              </div>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                                <button onClick={() => setWqDuplicateAction('overwrite')} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem' }}>Ghi đè</button>
                                <button onClick={() => setWqDuplicateAction('add')} style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem' }}>Thêm mới</button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--surface-strong)' }}>
                                {['Thông số', 'Đơn vị', 'Giá trị', 'Tiêu chuẩn'].map(h => (
                                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(wqPreview.parameters || []).map((p, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '7px 12px', fontWeight: '600', color: 'var(--text)' }}>{p.parameterName}</td>
                                  <td style={{ padding: '7px 12px', color: 'var(--text-muted)' }}>{p.unit || '—'}</td>
                                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: 'var(--text)' }}>{p.valueRaw || '—'}</td>
                                  <td style={{ padding: '7px 12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{p.referenceStandard || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button" disabled={wqImporting || (wqPreview.duplicateExists && !wqDuplicateAction)}
                            onClick={async () => {
                              if (!wqFile || !wqSampleDate || !wqPreview) return;
                              setWqImporting(true);
                              try {
                                const overwrite = wqDuplicateAction === 'overwrite';
                                await importWaterQuality(wqFile, wqSampleDate, overwrite, wqNotes || undefined, undefined, wqImportStationId ?? undefined);
                                setWqImportSuccess(`Đã import thành công ${wqPreview.parameters?.length || 0} thông số cho trạm ${wqPreview.recognizedStationId}.`);
                                setWqPreview(null);
                                setWqHistoryRefresh(prev => prev + 1);
                              } catch { setWqPreviewError('Lỗi khi import. Vui lòng thử lại.'); }
                              finally { setWqImporting(false); }
                            }}
                            style={{ flex: 1, padding: '9px 18px', background: '#198754', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: (wqImporting || (wqPreview.duplicateExists && !wqDuplicateAction)) ? 'not-allowed' : 'pointer', opacity: (wqImporting || (wqPreview.duplicateExists && !wqDuplicateAction)) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            {wqImporting ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Đang lưu...
                              </>
                            ) : (
                              <>
                                <Check size={16} /> Xác nhận Import
                              </>
                            )}
                          </button>
                          <button type="button" onClick={() => { setWqPreview(null); setWqDuplicateAction(null); }} style={{ padding: '9px 14px', background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }}>Quay lại</button>
                        </div>
                      </div>
                    )}

                    {/* Success Message */}
                    {wqImportSuccess && (
                      <div style={{ padding: '12px 16px', background: 'rgba(25,135,84,0.1)', border: '1px solid rgba(25,135,84,0.25)', borderRadius: '8px', color: '#198754', fontWeight: '600', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={16} color="#198754" />
                          <span>{wqImportSuccess}</span>
                        </div>
                        <button onClick={() => { setWqImportSuccess(''); setWqSampleDate(new Date().toISOString().slice(0, 10)); setWqFile(null); setWqNotes(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#198754', fontWeight: '700' }}>Nhập thêm</button>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Lịch sử dữ liệu đã import ─── */}
                {wqImportStationId ? (
                  <div style={{ borderTop: '2px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart3 size={16} color="var(--accent)" />
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>Lịch sử dữ liệu đã import</strong>
                      {wqHistoryLoading && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Đang tải...</span>}
                    </div>

                    {!wqHistoryLoading && wqHistorySamples.length === 0 && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0' }}>Chưa có dữ liệu import cho trạm này.</p>
                    )}

                    {wqHistorySamples.length > 0 && (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)' }}>Ngày lấy mẫu:</label>
                        <select
                          value={wqHistorySampleDate} onChange={e => setWqHistorySampleDate(e.target.value)}
                          style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          {wqHistorySamples.map(s => (
                            <option key={s.id} value={s.sampleDate}>{s.sampleDate} {s.notes ? `— ${s.notes}` : ''}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({wqHistorySamples.length} lần)</span>
                        {canManageData && wqHistorySample && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đợt nhập ngày ${wqHistorySample.sampleDate} của trạm này?`)) {
                                try {
                                  await deleteWaterQualitySample(wqHistorySample.id);
                                  alert("Xóa dữ liệu đợt này thành công!");
                                  setWqHistoryRefresh(prev => prev + 1);
                                  void fetchRecentSamples();
                                } catch (err: any) {
                                  alert("Lỗi khi xóa: " + (err.message || err));
                                }
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginLeft: '8px'
                            }}
                            title="Xóa vĩnh viễn đợt dữ liệu này"
                          >
                            <Trash2 size={13} /> Xóa đợt này
                          </button>
                        )}
                      </div>
                    )}

                    {wqHistorySample && wqHistorySample.parameters && wqHistorySample.parameters.length > 0 && (
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--surface-strong)' }}>
                              {['Thông số', 'Đơn vị', 'Giá trị', 'Tiêu chuẩn'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {wqHistorySample.parameters.map((p, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '7px 12px', fontWeight: '600', color: 'var(--text)' }}>{p.parameterName}</td>
                                <td style={{ padding: '7px 12px', color: 'var(--text-muted)' }}>{p.unit || '—'}</td>
                                <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: 'var(--text)' }}>{p.valueRaw || '—'}</td>
                                <td style={{ padding: '7px 12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{p.referenceStandard || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ borderTop: '2px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart3 size={16} color="var(--accent)" />
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>Các đợt nhập dữ liệu gần đây nhất (Hệ thống)</strong>
                        {recentLoading && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Đang tải...</span>}
                      </div>
                      <button 
                        onClick={() => void fetchRecentSamples()} 
                        type="button"
                        style={{ padding: '6px 12px', background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <RefreshCw size={12} /> Làm mới
                      </button>
                    </div>

                    {!recentLoading && recentSamples.length === 0 && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0' }}>Chưa có dữ liệu nào được import gần đây.</p>
                    )}

                    {recentSamples.length > 0 && (
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--surface-strong)' }}>
                              {['Trạm đo', 'Loại nguồn nước', 'Ngày lấy mẫu', 'Số thông số', 'Thời gian import', 'Ghi chú', 'Thao tác'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', borderBottom: '1px solid var(--border)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {recentSamples.slice(0, 15).map((s, idx) => (
                              <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--text)' }}>
                                  {s.stationId ? <span style={{ background: 'rgba(13, 110, 253, 0.1)', color: '#0d6efd', padding: '2px 6px', borderRadius: '4px', marginRight: '6px', fontSize: '0.75rem' }}>{s.stationId}</span> : null}
                                  {s.stationLocation || '—'}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    background: s.stationType === 'groundwater' ? 'rgba(111, 66, 193, 0.1)' : 'rgba(13, 202, 240, 0.1)',
                                    color: s.stationType === 'groundwater' ? '#6f42c1' : '#0dcaf0'
                                  }}>
                                    {s.stationType === 'groundwater' ? 'Nước ngầm' : 'Nước mặt'}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: '700', color: 'var(--text)' }}>{s.sampleDate}</td>
                                <td style={{ padding: '8px 12px', fontWeight: '600' }}>{s.parameterCount}</td>
                                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                  {s.importedAt ? new Date(s.importedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}
                                </td>
                                <td style={{ padding: '8px 12px', fontStyle: 'italic', color: 'var(--text-muted)' }}>{s.notes || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const detail = await getWaterQualitySample(s.id);
                                          setSelectedSampleDetail(detail);
                                        } catch { /* ignore */ }
                                      }}
                                      style={{
                                        padding: '4px 10px',
                                        background: 'var(--accent)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <Search size={12} /> Xem chi tiết
                                    </button>
                                    {canManageData && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (window.confirm(`Bạn có chắc chắn muốn xóa đợt nhập dữ liệu ngày ${s.sampleDate} của trạm ${s.stationLocation}?`)) {
                                            try {
                                              await deleteWaterQualitySample(s.id);
                                              alert("Xóa dữ liệu thành công!");
                                              void fetchRecentSamples();
                                              if (wqImportStationId) setWqHistoryRefresh(prev => prev + 1);
                                            } catch (err: any) {
                                              alert("Lỗi khi xóa: " + (err.message || err));
                                            }
                                          }
                                        }}
                                        style={{
                                          padding: '4px 10px',
                                          background: 'rgba(239, 68, 68, 0.1)',
                                          color: '#ef4444',
                                          border: '1px solid rgba(239, 68, 68, 0.2)',
                                          borderRadius: '8px',
                                          fontSize: '0.78rem',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                        title="Xóa đợt nhập này"
                                      >
                                        <Trash2 size={12} /> Xóa
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* --- STANDARD S3 UPLOAD FLOW FOR GIS & MONITORING --- */
              <div className="upload-tab-container fade-in" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Cột trái: Form nhập liệu */}
                <div className="glass-panel" style={{ flex: '1 1 550px', background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: 'var(--shadow-md)' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
                    <UploadCloud size={22} color="var(--accent)" /> Nhập Dữ Liệu Lên Hệ Thống
                  </h3>
                  
                  {/* The Group Selector has been moved to the top of the upload tab */}

                  {/* 2. Dynamic Form Fields */}
                  <div className="dynamic-form-fields" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {uploadGroup === 'gis' && (
                      <div className="slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Section 1: Phân loại dữ liệu GIS */}
                        <div className="form-section">
                          <div className="form-section-title">
                            <Layers size={16} color="var(--accent)" /> Cấu hình phân loại GIS
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <Layers size={14} color={hasValue(gisDataset) ? "var(--accent)" : "var(--text-muted)"} /> Dataset <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <select
                                value={gisDataset}
                                onChange={(e) => setGisDataset(e.target.value)}
                                className={`form-input ${hasValue(gisDataset) ? 'has-value' : ''}`}
                              >
                                <option value="">-- Chọn Dataset --</option>
                                {Object.entries(GIS_DATASETS).map(([key, val]) => (
                                  <option key={key} value={key}>{val.label}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <Tag size={14} color={hasValue(gisCategory) ? "var(--accent)" : "var(--text-muted)"} /> Category <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <select
                                value={gisCategory}
                                onChange={(e) => setGisCategory(e.target.value)}
                                className={`form-input ${hasValue(gisCategory) ? 'has-value' : ''}`}
                              >
                                <option value="">-- Chọn Category --</option>
                                {renderGisCategoryOptions(
                                  (GIS_DATASETS[gisDataset as keyof typeof GIS_DATASETS]?.categories || []) as GisCategoryNode[],
                                )}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <Activity size={14} color={hasValue(gisDataType) ? "var(--accent)" : "var(--text-muted)"} /> Kiểu dữ liệu GIS <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <select
                                value={gisDataType}
                                onChange={(e) => setGisDataType(e.target.value)}
                                className={`form-input ${hasValue(gisDataType) ? 'has-value' : ''}`}
                              >
                                <option value="">-- Chọn Kiểu --</option>
                                <option value="raster">Raster (Ảnh vệ tinh, TIF...)</option>
                                <option value="vector">Vector (Bản đồ, GeoJSON...)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Thời gian thu thập */}
                        <div className="form-section">
                          <div className="form-section-title">
                            <Calendar size={16} color="var(--accent)" /> Thời gian thu thập dữ liệu
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                Năm <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <select
                                value={gisYear}
                                onChange={(e) => setGisYear(e.target.value)}
                                className={`form-input ${hasValue(gisYear) ? 'has-value' : ''}`}
                              >
                                <option value="">-- Chọn Năm --</option>
                                {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => String(1900 + i)).map((yr) => (
                                  <option key={yr} value={yr}>{yr}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                Tháng (Tùy chọn)
                              </label>
                              <select
                                value={gisMonth}
                                onChange={(e) => setGisMonth(e.target.value)}
                                className={`form-input ${hasValue(gisMonth) ? 'has-value' : ''}`}
                              >
                                <option value="">--</option>
                                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                                  <option key={m} value={m}>Tháng {m}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                Ngày (Tùy chọn)
                              </label>
                              <select
                                value={gisDay}
                                onChange={(e) => setGisDay(e.target.value)}
                                className={`form-input ${hasValue(gisDay) ? 'has-value' : ''}`}
                              >
                                <option value="">--</option>
                                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                                  <option key={d} value={d}>Ngày {d}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <Clock size={14} color={hasValue(gisTime) ? "var(--accent)" : "var(--text-muted)"} /> Giờ (Tùy chọn)
                              </label>
                              <select
                                value={gisTime}
                                onChange={(e) => setGisTime(e.target.value)}
                                className={`form-input ${hasValue(gisTime) ? 'has-value' : ''}`}
                              >
                                <option value="">--</option>
                                {TIME_SLOTS.map(slot => (
                                  <option key={slot} value={slot}>{slot}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Thông tin mô tả */}
                        <div className="form-section">
                          <div className="form-section-title">
                            <FileSpreadsheet size={16} color="var(--accent)" /> Mô tả thông tin
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                              rows={2}
                              value={gisDescription}
                              onChange={(e) => setGisDescription(e.target.value)}
                              placeholder="Nhập mô tả thêm cho tệp tin GIS..."
                              className={`form-input ${hasValue(gisDescription) ? 'has-value' : ''}`}
                              style={{ resize: 'vertical' }}
                            />
                          </div>
                        </div>

                      </div>
                    )}

                    {uploadGroup === 'monitoring' && (
                      <div className="slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Section 1: Cấu hình trạm và Tham số */}
                        <div className="form-section">
                          <div className="form-section-title">
                            <Layers size={16} color="var(--accent)" /> Cấu hình trạm và Tham số
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <MapPin size={14} color={hasValue(selectedStation) ? "var(--accent)" : "var(--text-muted)"} /> Trạm quan trắc <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <input
                                type="text"
                                value={selectedStation}
                                onChange={(e) => setSelectedStation(e.target.value)}
                                placeholder="Nhập mã trạm tự do..."
                                className={`form-input ${hasValue(selectedStation) ? 'has-value' : ''}`}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <Activity size={14} color={hasValue(selectedParam) ? "var(--accent)" : "var(--text-muted)"} /> Tham số quan trắc <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <select
                                value={selectedParam}
                                onChange={(e) => setSelectedParam(e.target.value)}
                                className={`form-input ${hasValue(selectedParam) ? 'has-value' : ''}`}
                              >
                                <option value="">-- Chọn tham số --</option>
                                {MONITORING_PARAMETERS.map((param) => (
                                  <option key={param.key} value={param.key}>{param.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Thời gian ghi nhận */}
                        <div className="form-section">
                          <div className="form-section-title">
                            <Calendar size={16} color="var(--accent)" /> Thời gian ghi nhận dữ liệu
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <Calendar size={14} color={hasValue(selectedDate) ? "var(--accent)" : "var(--text-muted)"} /> Ngày ghi nhận <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className={`form-input ${hasValue(selectedDate) ? 'has-value' : ''}`}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                                <Clock size={14} color={hasValue(selectedTime) ? "var(--accent)" : "var(--text-muted)"} /> Giờ ghi nhận <span style={{ color: '#dc3545' }}>*</span>
                              </label>
                              <select
                                value={selectedTime}
                                onChange={(e) => setSelectedTime(e.target.value)}
                                className={`form-input ${hasValue(selectedTime) ? 'has-value' : ''}`}
                              >
                                {TIME_SLOTS.map(slot => (
                                  <option key={slot} value={slot}>{slot}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Mô tả thông tin */}
                        <div className="form-section">
                          <div className="form-section-title">
                            <FileSpreadsheet size={16} color="var(--accent)" /> Mô tả thông tin
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                              rows={2}
                              value={uploadDescription}
                              onChange={(e) => setUploadDescription(e.target.value)}
                              placeholder="Nhập mô tả thêm cho tệp tin quan trắc..."
                              className={`form-input ${hasValue(uploadDescription) ? 'has-value' : ''}`}
                              style={{ resize: 'vertical' }}
                            />
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* 3. Drag & Drop File Upload Component */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileCode size={14} /> Tệp dữ liệu tải lên <span style={{ color: '#dc3545' }}>*</span>
                    </label>
                    
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                      onDragLeave={() => setIsDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragActive(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const file = e.dataTransfer.files[0];
                          const val = validateFile(file);
                          if (val.valid) {
                            autoDetectType(file.name);
                            setUploadFile(file);
                            setUploadStatus('idle');
                          } else {
                            alert(val.message);
                          }
                        }
                      }}
                      onClick={() => document.getElementById('manual-file-input')?.click()}
                      className={`drag-drop-zone ${isDragActive ? 'active' : ''}`}
                    >
                      <input
                        id="manual-file-input"
                        type="file"
                        style={{ display: 'none' }}
                        accept={
                          uploadGroup === 'gis'
                            ? gisDataType === 'raster'
                              ? '.tif,.tiff,.cog,.png,.jpg,.jpeg,.rst'
                              : gisDataType === 'vector'
                                ? '.geojson,.shp,.kml,.gpkg,.zip,.vtc,.vct,.vdc'
                                : '.tif,.tiff,.cog,.png,.jpg,.jpeg,.rst,.geojson,.shp,.kml,.gpkg,.zip,.vtc,.vct'
                            : '.csv'
                        }
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            const val = validateFile(file);
                            if (val.valid) {
                              autoDetectType(file.name);
                              setUploadFile(file);
                              setUploadStatus('idle');
                            } else {
                              alert(val.message);
                            }
                          }
                        }}
                      />
                      
                      <UploadCloud 
                        size={44} 
                        color={isDragActive ? 'var(--accent)' : 'var(--text-muted)'} 
                        className="drag-drop-zone-icon"
                        style={{ transition: 'all 0.25s', transform: isDragActive ? 'scale(1.15)' : 'none' }} 
                      />
                      <div>
                        <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--text)', fontSize: '0.95rem' }}>
                          Kéo thả file vào đây hoặc click để duyệt
                        </p>
                        <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {uploadGroup === 'gis'
                            ? gisDataType === 'raster'
                              ? 'Raster: .tif, .tiff, .cog, .png, .jpg, .jpeg, .rst (Tối đa 100MB)'
                              : gisDataType === 'vector'
                                ? 'Vector: .geojson, .shp, .kml, .gpkg, .zip, .vtc, .vct, .vdc (Tối đa 100MB)'
                                : 'Hỗ trợ: Raster (.tif, .rst...) và Vector (.geojson, .vtc, .vct, .vdc...) (Tối đa 100MB)'
                            : 'Bảng dữ liệu: .csv (Tối đa 100MB)'}
                        </p>
                      </div>
                    </div>

                    {/* Selected File Details & Progress */}
                    {uploadFile && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                            <FileCode size={22} color="var(--accent)" />
                            <div style={{ overflow: 'hidden' }}>
                              <p style={{ margin: '0', fontWeight: '500', fontSize: '0.9rem', color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {uploadFile.name}
                              </p>
                              <p style={{ margin: '0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadFile(null);
                              setUploadStatus('idle');
                            }}
                            disabled={uploadStatus === 'uploading'}
                            style={{
                              border: 'none', background: 'none', padding: '6px', cursor: 'pointer',
                              color: 'var(--text-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            className="hover-bg-red"
                          >
                            <Trash2 size={16} className="hover-red" />
                          </button>
                        </div>

                        {uploadStatus === 'uploading' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #0d6efd, #0dcaf0)', borderRadius: '999px', transition: 'width 0.2s ease-out' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span>Đang tải lên S3...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                          </div>
                        )}

                        {uploadStatus === 'completed' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: '500' }}>
                            <CheckCircle2 size={16} /> Tải lên thành công!
                          </div>
                        )}

                        {uploadStatus === 'failed' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: '500' }}>
                              <XCircle size={16} /> Tải lên thất bại!
                            </div>
                            <p style={{ margin: '0', fontSize: '0.75rem', color: 'var(--danger)' }}>{uploadErrorMessage}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={handleUploadData}
                      disabled={!uploadFile || uploadStatus === 'uploading'}
                      className="primary-upload-btn"
                    >
                      <UploadCloud size={18} />
                      {uploadStatus === 'uploading' ? `Đang tải lên... ${uploadProgress}%` : 'Tải Lên Hệ Thống'}
                    </button>
                    
                    {uploadStatus === 'uploading' && (
                      <button
                        type="button"
                        onClick={() => setUploadStatus('cancelled')}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-strong)',
                          color: 'var(--text)',
                          fontSize: '0.95rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.25s'
                        }}
                        className="hover-bg-white-10"
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </div>

                {/* Cột phải: Panel Xem trước */}
                <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Storage Path Panel */}
                  <div className="glass-panel" style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Key size={16} color="var(--accent)" /> Đường dẫn lưu trữ
                      </h4>
                      {uploadFile && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(getExpectedStoragePath(uploadFile.name));
                          }}
                          title="Sao chép đường dẫn"
                          style={{ border: 'none', background: 'var(--surface-strong)', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FileCode size={12} /> Sao chép
                        </button>
                      )}
                    </div>

                    {uploadFile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Breadcrumb-style path */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '0.82rem' }}>
                          {(() => {
                            const path = getExpectedStoragePath(uploadFile.name);
                            const parts = path.split('/');
                            const colors = ['#0d6efd', '#0dcaf0', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#d63384', '#0d6efd'];
                            return parts.map((part, i) => (
                              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {i > 0 && <span style={{ color: 'var(--text-muted)', margin: '0 1px' }}>/</span>}
                                <span style={{
                                  background: i < 3 ? `${colors[i]}18` : 'var(--surface-strong)',
                                  color: i < 3 ? colors[i] : 'var(--text)',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontWeight: i < 3 ? '700' : '400',
                                  fontSize: '0.78rem',
                                  border: `1px solid ${i < 3 ? colors[i] : 'var(--border)'}`,
                                  maxWidth: '160px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {part}
                                </span>
                              </span>
                            ));
                          })()}
                        </div>

                        {/* File info row */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '10px 14px', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text)' }}>
                            <FileCode size={14} color="var(--accent)" />
                            <span style={{ fontWeight: '600' }}>{uploadFile.name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          {(() => {
                            const ext = uploadFile.name.substring(uploadFile.name.lastIndexOf('.')).toLowerCase();
                            const isRaster = ['.tif', '.tiff', '.png', '.jpg', '.jpeg'].includes(ext);
                            const isVector = ['.geojson', '.kml', '.shp', '.gpkg', '.zip'].includes(ext);
                            const isCSV = ext === '.csv';
                            let label = ext.toUpperCase();
                            let bg = 'var(--surface-strong)';
                            let color = 'var(--text-muted)';
                            if (isRaster) { label = 'Raster'; bg = '#0d6efd18'; color = '#0d6efd'; }
                            else if (isVector) { label = 'Vector'; bg = '#19875418'; color = '#198754'; }
                            else if (isCSV) { label = 'CSV'; bg = '#6f42c118'; color = '#6f42c1'; }
                            return <span style={{ padding: '2px 10px', borderRadius: '999px', background: bg, color, fontSize: '0.75rem', fontWeight: '700' }}>{label}</span>;
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px 0', color: 'var(--text-muted)' }}>
                        <UploadCloud size={32} color="var(--border)" />
                        <p style={{ margin: 0, fontSize: '0.88rem' }}>Chọn tệp tin và điền thông tin để xem đường dẫn lưu trữ</p>
                      </div>
                    )}
                  </div>

                  {/* Metadata Summary Panel */}
                  <div className="glass-panel" style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                      <FileSpreadsheet size={16} color="var(--accent)" />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text)' }}>Thông tin tệp tin</h4>
                    </div>

                    {uploadFile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Data group badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                          <Server size={14} color="var(--text-muted)" />
                          <span style={{ color: 'var(--text-muted)', minWidth: '100px' }}>Nhóm dữ liệu</span>
                          <span style={{
                            padding: '2px 12px', borderRadius: '999px',
                            background: uploadGroup === 'gis' ? '#0d6efd18' : (uploadGroup as string) === 'station' ? '#19875418' : '#6f42c118',
                            color: uploadGroup === 'gis' ? '#0d6efd' : (uploadGroup as string) === 'station' ? '#198754' : '#6f42c1',
                            fontWeight: '700', fontSize: '0.78rem'
                          }}>
                            {uploadGroup === 'gis' ? 'GIS Data' : (uploadGroup as string) === 'station' ? 'Station Data' : 'Monitoring Data'}
                          </span>
                        </div>

                        {/* Dynamic metadata rows */}
                        {uploadGroup === 'gis' ? (
                          <>
                            {[
                              { icon: <Layers size={14} />, label: 'Dataset', value: gisDataset || '—' },
                              { icon: <Tag size={14} />, label: 'Category', value: gisCategory || '—' },
                              { icon: <Activity size={14} />, label: 'Kiểu dữ liệu', value: gisDataType ? (gisDataType === 'raster' ? 'Raster' : 'Vector') : '—' },
                              { icon: <Calendar size={14} />, label: 'Năm', value: gisYear || '—' },
                              gisMonth ? { icon: <Calendar size={14} />, label: 'Tháng', value: gisMonth } : null,
                              gisDay ? { icon: <Calendar size={14} />, label: 'Ngày', value: gisDay } : null,
                              gisTime ? { icon: <Clock size={14} />, label: 'Giờ', value: gisTime } : null,
                              gisDescription ? { icon: <FileCode size={14} />, label: 'Mô tả', value: gisDescription } : null,
                            ].filter((row): row is NonNullable<typeof row> => row !== null).map((row, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', padding: '6px 8px', background: i % 2 === 0 ? 'var(--background)' : 'transparent', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{row.icon}</span>
                                <span style={{ color: 'var(--text-muted)', minWidth: '90px' }}>{row.label}</span>
                                <span style={{ color: 'var(--text)', fontWeight: '500', wordBreak: 'break-all' }}>{row.value}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            {[
                              { icon: <MapPin size={14} />, label: 'Trạm', value: selectedStation || '—' },
                              (uploadGroup as string) === 'station' ? { icon: <Layers size={14} />, label: 'Dạng dữ liệu', value: stationDataType ? STATION_DATA_TYPES.find(t => t.key === stationDataType)?.label || stationDataType : '—' } : null,
                              { icon: <Activity size={14} />, label: 'Tham số', value: selectedParam ? ((uploadGroup as string) === 'station' ? STATION_PARAMETERS.find(p => p.key === selectedParam)?.label : MONITORING_PARAMETERS.find(p => p.key === selectedParam)?.label) || selectedParam : '—' },
                              selectedDate ? { icon: <Calendar size={14} />, label: 'Ngày', value: selectedDate } : null,
                              selectedTime ? { icon: <Clock size={14} />, label: 'Giờ', value: selectedTime } : null,
                              uploadDescription ? { icon: <FileCode size={14} />, label: 'Mô tả', value: uploadDescription } : null,
                            ].filter((row): row is NonNullable<typeof row> => row !== null).map((row, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', padding: '6px 8px', background: i % 2 === 0 ? 'var(--background)' : 'transparent', borderRadius: '6px' }}>
                                <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{row.icon}</span>
                                <span style={{ color: 'var(--text-muted)', minWidth: '90px' }}>{row.label}</span>
                                <span style={{ color: 'var(--text)', fontWeight: '500', wordBreak: 'break-all' }}>{row.value}</span>
                              </div>
                            ))}
                          </>
                        )}

                        {!uploadGroup && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px 0', color: 'var(--text-muted)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem' }}>Chưa có thông tin</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px 0', color: 'var(--text-muted)' }}>
                        <FileSpreadsheet size={28} color="var(--border)" />
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>Chọn tệp tin để xem thông tin chi tiết</p>
                      </div>
                    )}
                  </div>

                  {/* Recent uploads when no selection */}
                  {recentUploads.length > 0 && !uploadFile && ((uploadGroup === 'gis' && !gisDataset) || (uploadGroup !== 'gis' && !selectedStation)) && (
                    <div className="glass-panel fade-in" style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '14px', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={16} color="var(--accent)" /> Tệp tải lên gần nhất
                        </h4>
                        {canManageData && selectedRecentKeys.length > 0 ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              onClick={handleDeleteSelectedRecent}
                              disabled={isDeletingRecent}
                              style={{
                                border: 'none',
                                background: '#dc3545',
                                color: '#fff',
                                cursor: 'pointer',
                                padding: '4px 10px',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                            >
                              <Trash2 size={12} /> {isDeletingRecent ? 'Đang xóa...' : `Xóa (${selectedRecentKeys.length})`}
                            </button>
                            <button
                              onClick={() => setSelectedRecentKeys([])}
                              style={{
                                border: '1px solid var(--border)',
                                background: 'var(--surface-strong)',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                              }}
                            >
                              Hủy chọn
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--surface-strong)', padding: '4px 12px', borderRadius: '999px', fontWeight: '600' }}>
                            {recentUploads.length} tệp
                          </span>
                        )}
                      </div>
                      <div 
                        onScroll={handleRecentScroll}
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '8px', 
                          maxHeight: '380px', 
                          overflowY: 'auto', 
                          paddingRight: '6px' 
                        }}
                      >
                        {recentUploads.slice(0, visibleRecentCount).map((file) => {
                          const fileName = file.key.split('/').pop() || file.key;
                          const filePath = getParentPath(file.key) || '/';
                          const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
                          const isRaster = ['.tif', '.tiff', '.cog', '.png', '.jpg', '.jpeg', '.rst'].includes(fileExt);
                          const isVector = ['.geojson', '.shp', '.kml', '.gpkg', '.zip', '.vtc', '.vct', '.vdc'].includes(fileExt);
                          
                          return (
                            <div 
                              key={file.key}
                              onClick={() => setPreviewFile(file)}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '12px 16px', 
                                background: 'var(--background)', 
                                border: '1px solid var(--border)', 
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              className="hover-bg-surface-strong"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                {canManageData && (
                                  <input
                                    type="checkbox"
                                    checked={selectedRecentKeys.includes(file.key)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRecentKeys(prev => [...prev, file.key]);
                                      } else {
                                        setSelectedRecentKeys(prev => prev.filter(k => k !== file.key));
                                      }
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border)',
                                      accentColor: 'var(--accent)',
                                      marginRight: '4px'
                                    }}
                                  />
                                )}
                                <div style={{ 
                                  width: '36px', 
                                  height: '36px', 
                                  borderRadius: 'var(--radius-md)', 
                                  background: isRaster ? 'rgba(13, 110, 253, 0.1)' : isVector ? 'rgba(25, 135, 84, 0.1)' : 'rgba(111, 66, 193, 0.1)',
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <FileCode size={18} color={isRaster ? '#0d6efd' : isVector ? '#198754' : '#6f42c1'} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>
                                    {fileName}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filePath}>
                                    {truncatePath(filePath, 60)}
                                  </p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <p style={{ margin: '0 0 2px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {new Date(file.lastModified).toLocaleString('vi-VN')}
                                  </p>
                                </div>
                                <span style={{ 
                                  padding: '4px 10px', 
                                  borderRadius: '999px', 
                                  background: isRaster ? 'rgba(13, 110, 253, 0.1)' : isVector ? 'rgba(25, 135, 84, 0.1)' : 'rgba(111, 66, 193, 0.1)',
                                  color: isRaster ? '#0d6efd' : isVector ? '#198754' : '#6f42c1',
                                  fontSize: '0.7rem', 
                                  fontWeight: '700',
                                  textTransform: 'uppercase'
                                }}>
                                  {isRaster ? 'Raster' : isVector ? 'Vector' : 'CSV'}
                                </span>
                                {canManageData && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa tệp này?\n${fileName}`);
                                      if (confirmDelete) {
                                        handleDeleteSingleRecent(file.key);
                                      }
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      color: 'var(--text-muted)',
                                      padding: '6px',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s',
                                      marginLeft: '4px'
                                    }}
                                    className="hover-bg-red hover-red"
                                    title="Xóa tệp"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>

          {/* Danh sách tệp đã tải lên */}
          <div className="glass-panel fade-in" style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={20} color="var(--accent)" /> Tệp tin trong thư mục
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--surface-strong)', padding: '4px 12px', borderRadius: '999px', fontFamily: 'monospace', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getS3PrefixForSelection()}>
                {truncatePath(getS3PrefixForSelection(), 50)}
              </span>
            </div>
            <S3Explorer prefix={getS3PrefixForSelection()} onPreviewFile={(file) => setPreviewFile(file)} refreshTrigger={s3RefreshTrigger} />
          </div>


        </div>
      )}
      </div>
      )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        .fade-in {
          animation: fadeIn 0.4s ease-in-out forwards;
        }
        
        .slide-down {
          animation: slideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .form-section {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: all 0.2s ease-in-out;
        }
        .form-section:hover {
          border-color: var(--accent-hover);
          box-shadow: var(--shadow-sm);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes pulse-float {
          0% { transform: translateY(0) scale(1); opacity: 0.75; }
          50% { transform: translateY(-5px) scale(1.06); opacity: 1; color: var(--accent); }
          100% { transform: translateY(0) scale(1); opacity: 0.75; }
        }

        .drag-drop-zone-icon {
          animation: pulse-float 3s ease-in-out infinite;
        }

        .form-section {
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
        }
        .form-section:hover {
          border-color: rgba(37, 99, 168, 0.35);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 2px rgba(0, 0, 0, 0.01);
        }
        .form-section-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
          margin-bottom: 4px;
        }

        .form-input {
          padding: 11px 15px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--background-soft);
          color: var(--text);
          outline: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.9rem;
          width: 100%;
        }
        .form-input:hover {
          border-color: var(--accent-hover);
          background: var(--background);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .form-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(37, 99, 168, 0.15), 0 4px 12px rgba(37, 99, 168, 0.08);
          background: var(--background);
        }
        .form-input.has-value {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
          font-weight: 600;
          background: linear-gradient(180deg, rgba(37, 99, 168, 0.03) 0%, rgba(37, 99, 168, 0.01) 100%) !important;
          box-shadow: 0 2px 6px rgba(37, 99, 168, 0.05);
        }
        
        .group-btn {
          flex: 1;
          padding: 12px 16px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          background: var(--background-soft);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .group-btn:hover {
          color: var(--text);
          background: var(--surface);
          border-color: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        .group-btn.active {
          border-color: var(--accent);
          background: linear-gradient(135deg, rgba(37, 99, 168, 0.12), rgba(37, 99, 168, 0.04));
          color: var(--accent);
          box-shadow: 0 4px 12px rgba(37, 99, 168, 0.15);
          font-weight: 700;
        }
        
        .drag-drop-zone {
          border: 2px dashed var(--border);
          border-radius: var(--radius-lg);
          padding: 36px 24px;
          text-align: center;
          background: var(--background-soft);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .drag-drop-zone:hover {
          border-color: var(--accent) !important;
          background: rgba(37, 99, 168, 0.01) !important;
          box-shadow: 0 6px 20px rgba(37, 99, 168, 0.04);
        }
        .drag-drop-zone.active {
          border-color: var(--accent) !important;
          background: rgba(37, 99, 168, 0.08) !important;
          box-shadow: 0 8px 24px rgba(37, 99, 168, 0.12);
        }
        
        .primary-upload-btn {
          flex: 2;
          padding: 13px 26px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%);
          color: #fff;
          border: none;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(37, 99, 168, 0.25);
        }
        .primary-upload-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--accent-hover) 0%, #1e40af 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(37, 99, 168, 0.35);
        }
        .primary-upload-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .primary-upload-btn:disabled {
          background: var(--surface-strong);
          color: var(--text-muted);
          border: 1px solid var(--border);
          cursor: not-allowed;
          box-shadow: none;
          opacity: 0.6;
        }
        
        .hover-bg-white-10:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .hover-bg-muted:hover {
          background: var(--surface-strong) !important;
        }
        
        .hover-bg-red:hover {
          background: rgba(239, 68, 68, 0.15) !important;
        }
        
        .glass-panel {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-panel:hover {
          border-color: rgba(37, 99, 168, 0.25) !important;
          box-shadow: var(--shadow-lg), 0 4px 20px rgba(37, 99, 168, 0.05);
        }
        
        .hover-red:hover {
          color: #ef4444 !important;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>

      {previewFile && (
        <FilePreviewModal
          fileKey={previewFile.key}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {mapPreviewStation && mapPreviewStation.x != null && mapPreviewStation.y != null && (
        <MapPreviewModal
          station={mapPreviewStation}
          onClose={() => setMapPreviewStation(null)}
        />
      )}

      {selectedSampleDetail && (
        <WaterQualityDetailModal
          sample={selectedSampleDetail}
          onClose={() => setSelectedSampleDetail(null)}
        />
      )}

      {showManualStationForm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowManualStationForm(false); }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
            background: 'rgba(6, 8, 16, 0.4)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'modalOverlayIn 0.25s ease'
          }}
        >
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            boxShadow: 'var(--shadow-xl)',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '92vh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'modalPanelIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text)' }}>
                  {editingManualStation ? 'Cập Nhật Trạm Quan Trắc' : 'Thêm Trạm Quan Trắc Mới'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {editingManualStation ? `Đang chỉnh sửa trạm ID: ${editingManualStation.id}` : 'Nhập thông tin trạm tự đo/thu thập thủ công'}
                </p>
              </div>
              <button
                onClick={() => setShowManualStationForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                className="hover-bg-muted"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveManualStation} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Station Type Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <Layers size={14} color="var(--accent)" /> Loại trạm <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setManualStationType('groundwater')}
                      className={`group-btn ${manualStationType === 'groundwater' ? 'active' : ''}`}
                      style={{ padding: '10px 16px', fontSize: '0.88rem' }}
                    >
                      Nước Ngầm
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setManualStationType('surface_water')}
                      className={`group-btn ${manualStationType === 'surface_water' ? 'active' : ''}`}
                      style={{ padding: '10px 16px', fontSize: '0.88rem' }}
                    >
                      Nước Mặt
                    </button>
                  </div>
                </div>

                {/* Station ID Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <FileCode size={14} color={hasValue(manualStationId) ? "var(--accent)" : "var(--text-muted)"} /> Mã trạm (ID trạm)
                  </label>
                  <input
                    type="text"
                    value={manualStationId}
                    onChange={(e) => setManualStationId(e.target.value)}
                    placeholder="Để trống hệ thống sẽ tự động tạo (VD: GW001, SW001)"
                    className={`form-input ${hasValue(manualStationId) ? 'has-value' : ''}`}
                  />
                </div>

                {/* Location Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <MapPin size={14} color={hasValue(manualLocation) ? "var(--accent)" : "var(--text-muted)"} /> Địa điểm <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder="VD: Trạm Vĩnh Hải, Sóc Trăng"
                    className={`form-input ${hasValue(manualLocation) ? 'has-value' : ''}`}
                  />
                </div>

                {/* Hydro Characteristics */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <Activity size={14} color={hasValue(manualHydroChar) ? "var(--accent)" : "var(--text-muted)"} /> Đặc tính thủy vực
                  </label>
                  <input
                    type="text"
                    value={manualHydroChar}
                    onChange={(e) => setManualHydroChar(e.target.value)}
                    placeholder="VD: Kênh/Sông tự nhiên, tầng chứa nước q13"
                    className={`form-input ${hasValue(manualHydroChar) ? 'has-value' : ''}`}
                  />
                </div>

                {/* X & Y coordinates (row) */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                      <MapPin size={14} color={hasValue(manualX) ? "var(--accent)" : "var(--text-muted)"} /> Tọa độ X (Kinh độ) <span style={{ color: '#dc3545' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={manualX}
                      onChange={(e) => setManualX(e.target.value)}
                      placeholder="VD: 106.12345"
                      className={`form-input ${hasValue(manualX) ? 'has-value' : ''}`}
                    />
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                      <MapPin size={14} color={hasValue(manualY) ? "var(--accent)" : "var(--text-muted)"} /> Tọa độ Y (Vĩ độ) <span style={{ color: '#dc3545' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={manualY}
                      onChange={(e) => setManualY(e.target.value)}
                      placeholder="VD: 9.87654"
                      className={`form-input ${hasValue(manualY) ? 'has-value' : ''}`}
                    />
                  </div>
                </div>

                {/* Station Active Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <Activity size={14} color="var(--accent)" /> Trạng thái hoạt động <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setManualIsActive(true)}
                      className={`group-btn ${manualIsActive ? 'active' : ''}`}
                      style={{ padding: '10px 16px', fontSize: '0.88rem' }}
                    >
                      Hoạt Động
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setManualIsActive(false)}
                      className={`group-btn ${!manualIsActive ? 'active' : ''}`}
                      style={{ padding: '10px 16px', fontSize: '0.88rem' }}
                    >
                      Tạm Dừng
                    </button>
                  </div>
                </div>

                {/* Image Code (Pics hiện trường) - Only for Surface Water */}
                {manualStationType === 'surface_water' && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                      <FileCode size={14} color={(manualImageFiles.length > 0 || currentImages.length > 0) ? "var(--accent)" : "var(--text-muted)"} /> Ảnh hiện trường (Pics)
                    </label>
                    
                    {/* Preview Area */}
                    {(manualImageFiles.length > 0 || currentImages.length > 0) && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--background-soft)',
                        padding: '12px',
                        borderRadius: '8px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        marginBottom: '4px'
                      }}>
                        {/* Render existing images */}
                        {currentImages.map((img, idx) => (
                          <div
                            key={`existing-${idx}`}
                            style={{
                              position: 'relative',
                              width: '100%',
                              aspectRatio: '1',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <img
                              src={img.blobUrl}
                              alt={`Existing ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (img.blobUrl && img.blobUrl.startsWith('blob:')) {
                                  URL.revokeObjectURL(img.blobUrl);
                                }
                                setCurrentImages((prev) => prev.filter(item => item.key !== img.key));
                              }}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'rgba(239, 68, 68, 0.95)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                padding: 0
                              }}
                              title="Xóa ảnh này"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}

                        {/* Render newly selected files */}
                        {manualImageFiles.map((file, idx) => (
                          <div
                            key={`new-${idx}`}
                            style={{
                              position: 'relative',
                              width: '100%',
                              aspectRatio: '1',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`New ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setManualImageFiles((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                background: 'rgba(239, 68, 68, 0.95)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                padding: 0
                              }}
                              title="Xóa ảnh mới chọn"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Controls */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="file"
                        id="manual-station-image-upload"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setManualImageFiles((prev) => [...prev, ...files]);
                        }}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="manual-station-image-upload"
                        className="group-btn"
                        style={{
                          padding: '10px 16px',
                          fontSize: '0.88rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          width: '100%',
                          textAlign: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <UploadCloud size={16} /> Chọn ảnh hiện trường (Có thể chọn nhiều)...
                      </label>
                    </div>
                  </div>
                )}

              </div>

              {/* Form Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'var(--background)'
              }}>
                <button
                  type="button"
                  onClick={() => setShowManualStationForm(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  className="hover-bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%)',
                    color: '#fff',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 168, 0.3)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  className="hover-opacity-90"
                >
                  <Check size={16} />
                  Lưu trạm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !importLoading) setShowImportModal(false); }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
            background: 'rgba(6, 8, 16, 0.4)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'modalOverlayIn 0.25s ease'
          }}
        >
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            boxShadow: 'var(--shadow-xl)',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '92vh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'modalPanelIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text)' }}>
                  Nhập danh sách trạm từ Excel
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Nhập hàng loạt trạm đo nước ngầm hoặc nước mặt
                </p>
              </div>
              <button
                type="button"
                disabled={importLoading}
                onClick={() => setShowImportModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                className="hover-bg-muted"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Station Type Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                    <Layers size={14} color="var(--accent)" /> Chọn loại trạm để nhập <span style={{ color: '#dc3545' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      disabled={importLoading}
                      onClick={() => setImportStationType('groundwater')}
                      className={`group-btn ${importStationType === 'groundwater' ? 'active' : ''}`}
                      style={{ padding: '10px 16px', fontSize: '0.88rem', flex: 1 }}
                    >
                      Nước Ngầm
                    </button>
                    
                    <button
                      type="button"
                      disabled={importLoading}
                      onClick={() => setImportStationType('surface_water')}
                      className={`group-btn ${importStationType === 'surface_water' ? 'active' : ''}`}
                      style={{ padding: '10px 16px', fontSize: '0.88rem', flex: 1 }}
                    >
                      Nước Mặt
                    </button>
                  </div>
                </div>

                {/* File Dropzone */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileSpreadsheet size={14} /> File Excel dữ liệu <span style={{ color: '#dc3545' }}>*</span>
                  </label>

                  <div
                    onDragOver={(e) => { e.preventDefault(); if (!importLoading) setIsImportDragActive(true); }}
                    onDragLeave={() => setIsImportDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsImportDragActive(false);
                      if (importLoading) return;
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleExcelFileChange(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => { if (!importLoading) document.getElementById('excel-file-input')?.click(); }}
                    className={`drag-drop-zone ${isImportDragActive ? 'active' : ''}`}
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '30px 20px',
                      textAlign: 'center',
                      cursor: importLoading ? 'not-allowed' : 'pointer',
                      background: isImportDragActive ? 'rgba(37, 99, 168, 0.05)' : 'var(--background-soft)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}
                  >
                    <input
                      id="excel-file-input"
                      type="file"
                      style={{ display: 'none' }}
                      accept=".xlsx,.xls"
                      disabled={importLoading}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleExcelFileChange(e.target.files[0]);
                        }
                      }}
                    />

                    <UploadCloud 
                      size={40} 
                      color={isImportDragActive ? 'var(--accent)' : 'var(--text-muted)'} 
                      style={{ transition: 'all 0.25s', transform: isImportDragActive ? 'scale(1.1)' : 'none' }} 
                    />
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--text)', fontSize: '0.9rem' }}>
                        Kéo thả file Excel vào đây hoặc click để duyệt
                      </p>
                      <p style={{ margin: '0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Hỗ trợ định dạng: .xlsx, .xls
                      </p>
                    </div>
                  </div>
                </div>

                {/* Selected File Details */}
                {importFile && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    background: 'var(--background-soft)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <FileSpreadsheet size={20} color="#198754" style={{ flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {importFile.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {(importFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    {!importLoading && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportFile(null);
                          setImportResult(null);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%'
                        }}
                        className="hover-bg-muted"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}

                {/* Loading State */}
                {importLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 0' }}>
                    <div className="animate-spin" style={{ width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Đang tải và xử lý file Excel, vui lòng đợi...</span>
                  </div>
                )}

                {/* Import Result Feedback */}
                {importResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      background: importResult.failCount > 0 ? 'rgba(220, 53, 69, 0.05)' : 'rgba(25, 135, 84, 0.05)',
                      border: `1px solid ${importResult.failCount > 0 ? 'rgba(220, 53, 69, 0.2)' : 'rgba(25, 135, 84, 0.2)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '16px'
                    }}>
                      <div style={{
                        width: '36px', height: '36px',
                        background: importResult.failCount > 0 ? 'rgba(220, 53, 69, 0.1)' : 'rgba(25, 135, 84, 0.1)',
                        color: importResult.failCount > 0 ? 'var(--danger)' : 'var(--success)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {importResult.failCount > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text)' }}>
                          {importResult.message}
                        </span>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--success)', fontWeight: '600' }}>Thành công: {importResult.successCount} trạm</span>
                          {importResult.duplicateCount != null && importResult.duplicateCount > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Bỏ qua trùng: {importResult.duplicateCount} trạm</span>
                          )}
                          {importResult.failCount > 0 && <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Thất bại: {importResult.failCount} trạm</span>}
                        </div>
                      </div>
                    </div>

                    {/* Itemized error logs */}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text)' }}>Chi tiết lỗi dòng:</span>
                        <div style={{
                          maxHeight: '150px',
                          overflowY: 'auto',
                          background: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }} className="custom-scrollbar">
                          {importResult.errors.map((err, idx) => (
                            <span key={idx} style={{ fontSize: '0.75rem', color: 'var(--danger)', fontFamily: 'monospace', lineHeight: '1.4' }}>
                              • {err}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Form Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'var(--background)'
              }}>
                <button
                  type="button"
                  disabled={importLoading}
                  onClick={() => setShowImportModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    cursor: importLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  className="hover-bg-muted"
                >
                  {importResult ? 'Đóng' : 'Hủy'}
                </button>
                {!importResult && (
                  <button
                    type="submit"
                    disabled={importLoading || !importFile}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: importFile ? 'linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%)' : 'var(--border)',
                      color: importFile ? '#fff' : 'var(--text-muted)',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      cursor: (importLoading || !importFile) ? 'not-allowed' : 'pointer',
                      boxShadow: importFile ? '0 4px 12px rgba(37, 99, 168, 0.3)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    className={importFile ? "hover-opacity-90" : ""}
                  >
                    <Check size={16} />
                    Bắt đầu Nhập
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
