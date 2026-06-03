'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../../lib/auth';
import { DATA_SOURCE_OPTIONS, DEFAULT_DATA_SOURCE, type DataSourceKey } from '../../../lib/constants/data-sources';
import { collectRecordKeys, formatRecordValue, truncatePath, getParentPath, type DataRecord } from '../../../lib/utils/record-utils';
import { loadDataDevices, loadDataRows, loadDataTimeframes, uploadS3File, listS3Files, deleteS3File, downloadS3File } from '../../../lib/admin-api';
import DataExportModal from '../../../components/DataExportModal';
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
import { fromLonLat, transformExtent } from 'ol/proj';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
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
  Layers, Tag, Clock, Folder, Copy
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

const GIS_DATASETS = {
  'landsat-imagery': {
    label: 'Landsat Imagery',
    categories: [
      { key: 'dry-season', label: 'Dry Season' },
      { key: 'wet-season', label: 'Wet Season' }
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
      { key: 'salinity-monitoring', label: 'Salinity' },
      { key: 'water-temperature-monitoring', label: 'Temperature' },
      { key: 'ph-monitoring', label: 'pH' }
    ]
  },
  'baseline-environment': {
    label: 'Baseline Environment',
    categories: [
      { key: 'landuse-planning', label: 'Landuse Planning' },
      { key: 'soil-type', label: 'Soil Type' },
      { key: 'water-body', label: 'Water Body' },
      { key: 'channel-system', label: 'Channel System' },
      { key: 'ground-water-storage', label: 'Ground Water Storage' },
      { key: 'road', label: 'Road' },
      { key: 'landuse-classification', label: 'Landuse Classification' },
      { key: 'mangroves', label: 'Mangroves' },
      { key: 'salinity-intrusion', label: 'Salinity Intrusion' }
    ]
  }
};

const STATION_DATA_TYPES = [
  { key: 'water-quality', label: 'Chất lượng nước' },
  { key: 'ecology', label: 'Sinh thái' }
];

const STATION_PARAMETERS = [
  { key: 'ph', label: 'pH' },
  { key: 'salinity', label: 'Độ mặn' },
  { key: 'temperature', label: 'Nhiệt độ' },
  { key: 'do', label: 'DO' },
  { key: 'water-level', label: 'Mực nước' },
  { key: 'flow', label: 'Lưu lượng' }
];

const MONITORING_PARAMETERS = [
  { key: 'salinity', label: 'Độ mặn' },
  { key: 'temperature', label: 'Nhiệt độ' },
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

// S3 Flat File List Component
function S3FlatFileList({ prefix, onPreviewFile }: { prefix: string; onPreviewFile?: (file: any) => void }) {
  const [files, setFiles] = useState<Array<{ key: string; size: number; lastModified: string }>>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useMemo(() => authService.hasRole('ADMIN'), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listS3Files(prefix);
      data.sort((a, b) => {
        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return dateB - dateA;
      });
      setFiles(data as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách tệp');
    } finally {
      setLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const handleDownload = async (key: string) => {
    try {
      await downloadS3File(key);
    } catch (err) {
      alert('Lỗi tải tệp: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async (key: string) => {
    const shortKey = key.split('/').pop() || key;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${shortKey}"?\n${getParentPath(key)}`)) {
      return;
    }
    try {
      await deleteS3File(key);
      alert('Xóa tệp tin thành công!');
      void fetchFiles();
    } catch (err) {
      alert('Lỗi khi xóa tệp: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const filteredFiles = files.filter(file => 
    file.key.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleString('vi-VN');
  };

  const getFileIcon = (key: string) => {
    const ext = key.substring(key.lastIndexOf('.')).toLowerCase();
    if (['.tif', '.tiff'].includes(ext)) return { icon: Layers, color: '#0d6efd', type: 'Raster' };
    if (['.geojson', '.kml', '.shp', '.gpkg'].includes(ext)) return { icon: MapPin, color: '#198754', type: 'Vector' };
    if (ext === '.csv') return { icon: FileSpreadsheet, color: '#6f42c1', type: 'CSV' };
    if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) return { icon: FileCode, color: '#fd7e14', type: 'Image' };
    return { icon: FileCode, color: 'var(--text-muted)', type: ext || 'File' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm kiếm tên tệp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-strong)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
        </div>
        <button
          onClick={() => void fetchFiles()}
          disabled={loading}
          style={{
            padding: '10px 16px',
            background: 'var(--surface-strong)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220, 53, 69, 0.1)', border: '1px solid #dc3545', borderRadius: 'var(--radius-md)', color: '#dc3545', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--surface-strong)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '600', width: '50px' }}>Loại</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '600' }}>Tên tệp tin</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '600', width: '100px' }}>Kích thước</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '600', width: '160px' }}>Ngày tải lên</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '600', width: '90px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Đang tải danh sách tệp tin...</p>
                </td>
              </tr>
            ) : filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <FileCode size={36} color="var(--border)" />
                    <p style={{ margin: 0, fontWeight: '500', fontSize: '0.95rem' }}>Chưa có tệp tin nào</p>
                    <p style={{ margin: 0, fontSize: '0.82rem' }}>Tải tệp lên để bắt đầu</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => {
                const { icon: FileIcon, color, type } = getFileIcon(file.key);
                const filename = file.key.split('/').pop() || file.key;
                return (
                  <tr key={file.key} style={{ borderBottom: '1px solid var(--border)' }} className="hover-bg-surface-strong">
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: `${color}12`, color }}>
                        <FileIcon size={16} />
                      </span>
                    </td>
                    <td 
                      onClick={() => onPreviewFile?.(file)}
                      style={{ 
                        padding: '10px 16px',
                        cursor: onPreviewFile ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: 'var(--text)', fontWeight: '600', fontSize: '0.92rem' }}>{filename}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.72rem', overflow: 'hidden' }} title={file.key}>
                          <Folder size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getParentPath(file.key) || '/'}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {formatBytes(file.size)}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {formatDate(file.lastModified)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                        <button
                          onClick={() => { navigator.clipboard.writeText(file.key); }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '6px' }}
                          className="hover-bg-surface-strong"
                          title="Sao chép đường dẫn"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => void handleDownload(file.key)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '6px', borderRadius: '6px' }}
                          className="hover-bg-accent-10"
                          title="Tải xuống"
                        >
                          <Download size={15} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => void handleDelete(file.key)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc3545', padding: '6px', borderRadius: '6px' }}
                            className="hover-bg-danger-10"
                            title="Xóa tệp"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .hover-bg-surface-strong:hover {
          background: var(--surface-strong);
        }
        .hover-bg-accent-10:hover {
          background: rgba(13, 110, 253, 0.1);
        }
        .hover-bg-danger-10:hover {
          background: rgba(220, 53, 69, 0.1);
        }
      `}</style>
    </div>
  );
}

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
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://14.183.200.227:8084/api';
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
      const encodedKey = fileKey.split('/').map(seg => encodeURIComponent(seg)).join('/');
      setBlobUrl(`/api/tif?key=${encodedKey}`);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    setBlobUrl('');
    setCsvData([]);

    const token = authService.getToken();
    fetch(getBackendUrl(`/s3/download/${fileKey}`), {
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
      const isPh = fileKey.toLowerCase().includes('ph');
      const isWaterLevel = fileKey.toLowerCase().includes('water-level') || fileKey.toLowerCase().includes('waterlevel');
      const isSingleBand = isSalinity || isPh || isWaterLevel || fileKey.toLowerCase().includes('monitoring') || fileKey.toLowerCase().includes('station');

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
        } else if (isWaterLevel) {
          layerStyle = {
            color: [
              'interpolate',
              ['linear'],
              ['band', 1],
              -2, [0, 0, 0, 0],
              0, [173, 216, 230, 0.8],
              2, [0, 0, 255, 0.8],
              5, [0, 0, 139, 0.8]
            ]
          };
        } else {
          layerStyle = {
            color: [
              'case',
              ['<=', ['band', 1], 0], [0, 0, 0, 0],
              [
                'interpolate',
                ['linear'],
                ['band', 1],
                0.01, [0, 0, 255, 0.8],
                4, [0, 255, 255, 0.8],
                8, [0, 255, 0, 0.8],
                15, [255, 255, 0, 0.8],
                22, [255, 165, 0, 0.8],
                30, [255, 0, 0, 0.8]
              ]
            ]
          };
        }
      }

      const rasterLayer = new WebGLTileLayer({
        source: geoTiffSource,
        opacity: 0.85,
        style: layerStyle
      });

      map.addLayer(rasterLayer);

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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      background: 'rgba(9, 13, 22, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
        width: '100%',
        maxWidth: isCSV ? '1100px' : '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-strong)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(37, 99, 168, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              flexShrink: 0
            }}>
              {isCSV && <FileSpreadsheet size={20} />}
              {isImage && <FileCode size={20} />}
              {isMap && <MapPin size={20} />}
              {!isCSV && !isImage && !isMap && <FileCode size={20} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Xem trước: {filename}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={fileKey}>
                {truncatePath(fileKey, 80)}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleDownload}
              style={{
                background: 'rgba(37, 99, 168, 0.1)',
                border: '1px solid rgba(37, 99, 168, 0.2)',
                color: 'var(--accent)',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              title="Tải tệp này xuống"
            >
              <Download size={14} /> Tải xuống
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              className="hover-bg-surface-strong"
              title="Đóng xem trước"
            >
              <XCircle size={22} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          background: 'var(--background)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '350px',
          justifyContent: loading ? 'center' : 'stretch',
          alignItems: loading ? 'center' : 'stretch'
        }} className="custom-scrollbar">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={36} className="animate-spin" color="var(--accent)" />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Đang nạp tệp tin và chuẩn bị bản xem trước...</p>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '450px', margin: '0 auto', textAlign: 'center' }}>
              <AlertCircle size={48} color="#dc3545" />
              <h4 style={{ margin: 0, color: 'var(--text)', fontWeight: 'bold' }}>Không Thể Xem Trước Tệp Tin</h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5' }}>{error}</p>
            </div>
          ) : (
            <>
              {isCSV && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Hiển thị tối đa 100 dòng đầu tiên của tệp tin. Tổng số dòng hiển thị: {csvData.length}
                    </div>
                    <div style={{ position: 'relative', width: '300px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Tìm kiếm trong bảng..."
                        value={csvSearch}
                        onChange={(e) => setCsvSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px 6px 30px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface-strong)',
                          color: 'var(--text)',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }} className="custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-strong)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                          {csvData[0]?.map((cell, idx) => (
                            <th key={idx} style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 'bold', borderRight: '1px solid var(--border)' }}>
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCsvRows.slice(1).map((row, rowIdx) => (
                          <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border)' }} className="hover-bg-surface-strong">
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} style={{ padding: '10px 14px', color: 'var(--text-muted)', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {filteredCsvRows.length <= 1 && (
                          <tr>
                            <td colSpan={csvData[0]?.length || 1} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              Không tìm thấy hàng nào khớp với từ khóa tìm kiếm.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isImage && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px' }}>
                  <img
                    src={blobUrl}
                    alt={filename}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '60vh',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border)'
                    }}
                  />
                </div>
              )}

              {isMap && (
                <div style={{ position: 'relative', width: '100%', height: '550px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div ref={mapElement} style={{ width: '100%', height: '100%', background: '#f8fafc' }} />
                  
                  {/* Map Float Info */}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    color: 'var(--text)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxWidth: '300px'
                  }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={12} color="var(--accent)" />
                      {isVector ? 'Vector (GeoJSON/KML)' : 'Raster (GeoTIFF)'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Hệ tọa độ: {isVector ? 'EPSG:4326 / EPSG:3857' : 'Auto-detected'}
                    </div>
                  </div>
                </div>
              )}

              {!isCSV && !isImage && !isMap && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '450px', margin: 'auto', textAlign: 'center' }}>
                  <FileCode size={48} color="var(--text-muted)" />
                  <h4 style={{ margin: 0, color: 'var(--text)', fontWeight: 'bold' }}>Không Thể Xem Trực Tiếp Tệp Tin</h4>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5' }}>
                    Định dạng tệp tin này ({ext}) chưa được hỗ trợ xem trước tự động. Bạn vẫn có thể tải xuống tệp tin để xem cục bộ.
                  </p>
                  <button
                    onClick={handleDownload}
                    style={{
                      background: 'var(--accent)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '10px 20px',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(37, 99, 168, 0.25)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Download size={16} /> Tải xuống tệp tin
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          background: 'var(--surface-strong)',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: '0.88rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            className="hover-bg-surface-strong"
          >
            Đóng
          </button>
        </div>
      </div>
      <style jsx>{`
        .hover-bg-surface-strong:hover {
          background: var(--surface-strong) !important;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
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
  const [previewFile, setPreviewFile] = useState<any>(null);
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

  // Persist active tab across page reloads
  useEffect(() => {
    localStorage.setItem('dataPage:activeTab', activeTab);
  }, [activeTab]);

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
      
      const response = await uploadS3File(uploadFile, key);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('completed');
      
      setTimeout(() => {
        setUploadFile(null);
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 5000);
      
      alert(`✓ Tải lên thành công!\n${response.key.split('/').pop()} → ${truncatePath(getParentPath(response.key) || '/', 50)}`);
    } catch (error) {
      setUploadStatus('failed');
      setUploadErrorMessage(error instanceof Error ? error.message : 'Lỗi không xác định khi tải lên S3');
      alert(`Lỗi tải lên: ${error instanceof Error ? error.message : String(error)}`);
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
              { key: 'browse', label: 'Tra cứu dữ liệu' },
              ...(canManageData ? [{ key: 'ingest', label: 'Nhận dữ liệu' }] : []),
              ...(canManageData ? [{ key: 'upload', label: 'Nhập dữ liệu' }] : []),
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    background: isActive ? 'var(--accent)' : 'var(--surface)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
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
            <div className="upload-tab-container fade-in" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {/* Cột trái: Form nhập liệu */}
            <div className="glass-panel" style={{ flex: '1 1 550px', background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: 'var(--shadow-md)' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
                <UploadCloud size={22} color="var(--accent)" /> Nhập Dữ Liệu Lên Hệ Thống
              </h3>
              
              {/* 1. Data Group Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={14} /> Nhóm dữ liệu
                </label>
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
                      >
                        <Server size={16} /> {group.label}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                            {(GIS_DATASETS[gisDataset as keyof typeof GIS_DATASETS]?.categories || []).map((cat) => (
                              <option key={cat.key} value={cat.key}>{cat.label}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                            <Activity size={14} color={hasValue(gisDataType) ? "var(--accent)" : "var(--text-muted)"} /> Kiểu dữ liệu <span style={{ color: '#dc3545' }}>*</span>
                          </label>
                          <select
                            value={gisDataType}
                            onChange={(e) => {
                              setGisDataType(e.target.value as any);
                              setUploadFile(null);
                            }}
                            className={`form-input ${hasValue(gisDataType) ? 'has-value' : ''}`}
                          >
                            <option value="">-- Chọn Kiểu dữ liệu --</option>
                            <option value="raster">Raster (Ảnh vệ tinh, Grid...)</option>
                            <option value="vector">Vector (Hình học, Shape...)</option>
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
                            {Array.from({ length: 15 }, (_, i) => String(2020 + i)).map((yr) => (
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

                {uploadGroup === 'station' && (
                  <div className="slide-down" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Section 1: Cấu hình trạm và Tham số */}
                    <div className="form-section">
                      <div className="form-section-title">
                        <Layers size={16} color="var(--accent)" /> Cấu hình trạm và Tham số
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>
                            <MapPin size={14} color={hasValue(selectedStation) ? "var(--accent)" : "var(--text-muted)"} /> Trạm đo lường <span style={{ color: '#dc3545' }}>*</span>
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
                            <Layers size={14} color={hasValue(stationDataType) ? "var(--accent)" : "var(--text-muted)"} /> Dạng dữ liệu trạm <span style={{ color: '#dc3545' }}>*</span>
                          </label>
                          <select
                            value={stationDataType}
                            onChange={(e) => setStationDataType(e.target.value)}
                            className={`form-input ${hasValue(stationDataType) ? 'has-value' : ''}`}
                          >
                            <option value="">-- Chọn Dạng dữ liệu --</option>
                            {STATION_DATA_TYPES.map((type) => (
                              <option key={type.key} value={type.key}>{type.label}</option>
                            ))}
                          </select>
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
                            {STATION_PARAMETERS.map((param) => (
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
                          placeholder="Nhập mô tả thêm cho tệp tin trạm..."
                          className={`form-input ${hasValue(uploadDescription) ? 'has-value' : ''}`}
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
                        background: uploadGroup === 'gis' ? '#0d6efd18' : uploadGroup === 'station' ? '#19875418' : '#6f42c118',
                        color: uploadGroup === 'gis' ? '#0d6efd' : uploadGroup === 'station' ? '#198754' : '#6f42c1',
                        fontWeight: '700', fontSize: '0.78rem'
                      }}>
                        {uploadGroup === 'gis' ? 'GIS Data' : uploadGroup === 'station' ? 'Station Data' : 'Monitoring Data'}
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
                        ].filter(Boolean).map((row: any, i) => (
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
                          uploadGroup === 'station' ? { icon: <Layers size={14} />, label: 'Dạng dữ liệu', value: stationDataType ? STATION_DATA_TYPES.find(t => t.key === stationDataType)?.label || stationDataType : '—' } : null,
                          { icon: <Activity size={14} />, label: 'Tham số', value: selectedParam ? (uploadGroup === 'station' ? STATION_PARAMETERS.find(p => p.key === selectedParam)?.label : MONITORING_PARAMETERS.find(p => p.key === selectedParam)?.label) || selectedParam : '—' },
                          selectedDate ? { icon: <Calendar size={14} />, label: 'Ngày', value: selectedDate } : null,
                          selectedTime ? { icon: <Clock size={14} />, label: 'Giờ', value: selectedTime } : null,
                          uploadDescription ? { icon: <FileCode size={14} />, label: 'Mô tả', value: uploadDescription } : null,
                        ].filter(Boolean).map((row: any, i) => (
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
            </div>
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
            <S3FlatFileList prefix={getS3PrefixForSelection()} onPreviewFile={(file) => setPreviewFile(file)} />
          </div>
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
    </div>
  );
}
