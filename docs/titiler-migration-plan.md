# Kế Hoạch Triển Khai Tile Server (TiTiler)

**Phiên bản**: 1.0  
**Ngày**: 2026-07-19  
**Mục tiêu**: Chuyển từ OpenLayers GeoTIFF rendering → TiTiler XYZ tile server  
**Kết quả mong đợi**: Load < 2s, pan/zoom 60fps, GPU usage giảm 80%

---

## 📋 Tổng Quan Kiến Trúc

### Hiện tại
```
[S3 Bucket] ──HTTP Range──► [Backend /api/s3/render] ──► [Next.js /api/tif] ──► [Browser WebGLTileLayer]
   GeoTIFF thô              Spring Boot proxy              Frontend proxy          decode + reproject + render
```

### Sau khi chuyển
```
[S3 Bucket] ──HTTP Range──► [TiTiler Service] ──XYZ PNG──► [Browser TileLayer]
   COG (đã tối ưu)           Python, port 8000              Chỉ dán ảnh lên canvas
                                                │
                                          [CDN Cache]
                                        (Cloudflare tùy chọn)
```

---

## 🗺️ Sơ Đồ Luồng Dữ Liệu Chi Tiết

```
1. Người dùng chọn dataset (vd: hydrology-salinity)
         │
2. Frontend xác định tile URL:
   https://titiler.mekong.local/tiles/256/{z}/{x}/{y}.png
     ?url=s3://bucket/gis-data/hydrology/salinity/2026/07/19/00-00/raster/salinity.tif
     &colormap=salinity
     &rescale=0,25
         │
3. Browser gọi XYZ tile (256x256 PNG, ~5-15KB)
         │
   ┌────▼────────────────────────────────────────────┐
   │  TiTiler (Python, port 8000)                     │
   │                                                  │
   │  3a. Nhận request /tiles/256/12/3456/7890.png   │
   │  3b. Đọc đúng block từ COG trên S3 (range req)  │
   │  3c. Áp dụng colormap + rescale                  │
   │  3d. Encode PNG → trả về browser                 │
   │  Thời gian: ~10-50ms                             │
   └──────────────────────────────────────────────────┘
         │
4. Browser nhận PNG → dán lên canvas (ImageTileLayer)
   - Không decode GeoTIFF
   - Không reproject
   - Không WebGL shader
```

---

## 📦 Chuẩn Bị

### 1.1 Môi trường

| Thành phần | Yêu cầu | Ghi chú |
|-----------|---------|---------|
| Python | 3.10+ | `python3 --version` |
| pip | 22+ | `pip install --upgrade pip` |
| GDAL | 3.6+ | `apt install gdal-bin libgdal-dev` |
| Docker | 24+ (tùy chọn) | `docker --version` |
| RAM | > 512MB | Cho TiTiler + tile cache |
| Disk | > 5GB | Cho tile cache nếu dùng disk |

### 1.2 S3 Bucket

Cần đảm bảo S3 credentials có quyền `GetObject` cho prefix `gis-data/`:
```
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=c01-mekong-prod-01
S3_REGION=us-east-1
S3_ENDPOINT=https://backup.hci.vn
```

### 1.3 File GeoTIFF → COG

Trước khi TiTiler hoạt động, file GeoTIFF cần được chuyển sang COG (Cloud Optimized GeoTIFF) có tiling + overviews.

---

## 📅 Các Giai Đoạn

### Phase 0: Chuyển GeoTIFF → COG (1-2 ngày)

**Mục tiêu**: Chuyển tất cả file GeoTIFF trên S3 thành COG.

**Script** (`scripts/convert-to-cog.sh`):

```bash
#!/bin/bash
# Chuyển 1 file GeoTIFF sang COG

INPUT=$1
OUTPUT=${INPUT%.tif}_cog.tif

gdal_translate "$INPUT" "$OUTPUT" \
  -co TILED=YES \
  -co BLOCKXSIZE=256 \
  -co BLOCKYSIZE=256 \
  -co COMPRESS=DEFLATE \
  -co PREDICTOR=2 \
  -co NUM_THREADS=ALL_CPUS \
  -of COG

# Thêm overviews
gdaladdo -r AVERAGE "$OUTPUT" 2 4 8 16

echo "Done: $OUTPUT"
```

**Cách chạy**:
```bash
# Cài đặt GDAL
apt install gdal-bin

# Chạy convert cho 1 file test
./scripts/convert-to-cog.sh input.tif

# Chạy batch cho tất cả file (sẽ code sau khi test OK)
```

**Kiểm tra**:
```bash
gdalinfo output_cog.tif | grep -E "BlockSize|Overviews|INTERLEAVE|COMPRESSION"
# Kết quả mong đợi:
#   BlockSize: [256, 256]
#   Overviews: 2, 4, 8, 16
#   INTERLEAVE: PIXEL
#   COMPRESSION: DEFLATE
```

**Output**: File COG mới, upload lên S3 cùng thư mục hoặc thư mục riêng `gis-data-cog/`.

---

### Phase 1: Cài Đặt TiTiler (1 ngày)

#### 1.1 Cài đặt Python packages

```bash
# Tạo virtual environment
python3 -m venv /opt/titiler
source /opt/titiler/bin/activate

# Cài TiTiler
pip install titiler uvicorn[standard] python-multipart boto3

# Kiểm tra
python -c "from titiler.main import app; print('OK')"
```

#### 1.2 Cấu hình TiTiler

Tạo file `/opt/titiler/config.py`:

```python
import os

# S3 Configuration
os.environ["AWS_ACCESS_KEY_ID"] = "WGU85A069Z04ESKJXYHF"
os.environ["AWS_SECRET_ACCESS_KEY"] = "E9YWIUztSKCGxEtmETrxBPmzl4XCBadOnPMNxTYH"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

# TiTiler config
TITILER_API_URL = "http://0.0.0.0:8000"
TITILER_CORS_ORIGINS = ["http://localhost:3004", "https://mekongsaltlab.org"]

# Cache config
TITILER_CACHE_ENABLED = True
TITILER_CACHE_TTL = 3600  # 1 hour
TITILER_CACHE_MAXSIZE = 512  # MB
```

#### 1.3 Chạy TiTiler

```bash
# Test thủ công
cd /opt/titiler
source bin/activate
uvicorn titiler.main:app --host 0.0.0.0 --port 8000 --workers 4

# Kiểm tra
curl "http://localhost:8000/docs"  # Swagger UI
```

#### 1.4 Systemd service (production)

Tạo file `/etc/systemd/system/titiler.service`:

```ini
[Unit]
Description=TiTiler Tile Server
After=network.target

[Service]
Type=simple
User=hv
WorkingDirectory=/opt/titiler
Environment=PATH=/opt/titiler/bin:/usr/bin
EnvironmentFile=/home/hv/DuAn/Mekong/.env
ExecStart=/opt/titiler/bin/uvicorn titiler.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable titiler
sudo systemctl start titiler
sudo systemctl status titiler
```

---

### Phase 2: Tích Hợp Frontend (2-3 ngày)

#### 2.1 File thay đổi

| File | Thay đổi |
|------|---------|
| `frontend/src/lib/constants/titiler.ts` | **Mới**: Cấu hình TiTiler URL, colormaps |
| `frontend/src/features/map/useS3LayerRenderer.ts` | Sửa: Thêm logic chọn source (XYZ vs GeoTIFF) |
| `frontend/src/features/map/useS3DatasetLayers.ts` | Sửa: Bổ sung titilerUrl vào RenderedLayer |
| `frontend/src/app/api/tif/route.ts` | Giữ nguyên (fallback cho trình duyệt cũ) |

#### 2.2 Cấu hình TiTiler (`lib/constants/titiler.ts`)

```typescript
// Định nghĩa colormap cho từng loại dữ liệu
export const TITILER_COLORMAPS: Record<string, string> = {
  'hydro-salinity': 'vik',            // xanh→trắng→đỏ
  'hydro-temp':      'blues',          // xanh dương
  'hydro-ph':        'spectral',       // quang phổ
  'landsat-b':       'greys',          // xám
  'flooding':        'blues',          // xanh dương
  'landuse':         'landuse',        // custom: 7 màu cho 7 class
};

export const TITILER_RESCALE: Record<string, [number, number]> = {
  'hydro-salinity': [0.01, 25],
  'hydro-temp':     [-100, 200],
  'hydro-ph':       [4, 9],
};

export const TITILER_URL = process.env.NEXT_PUBLIC_TITILER_URL || 'http://localhost:8000';

export function getTitilerTileUrl(
  s3Key: string,
  datasetId: string,
): string {
  const encodedKey = encodeURIComponent(`s3://c01-mekong-prod-01/${s3Key}`);
  const colormap = findColormap(datasetId);
  const rescale = TITILER_RESCALE[datasetId];
  const rescaleParam = rescale ? `&rescale=${rescale[0]},${rescale[1]}` : '';
  
  return `${TITILER_URL}/tiles/256/{z}/{x}/{y}.png`
    + `?url=${encodedKey}`
    + `&colormap=${colormap}`
    + rescaleParam
    + `&nodata=0`;
}
```

#### 2.3 Sửa `useS3LayerRenderer.ts` — Thêm XYZ source

```typescript
// Kiểm tra TiTiler có khả dụng không
async function checkTitilerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${TITILER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Chọn source: ưu tiên XYZ (TiTiler), fallback GeoTIFF
async function createRasterLayer(info, map) {
  const useTitiler = titilerAvailable && info.s3Key && info.type !== 'classified';
  
  if (useTitiler) {
    const source = new XYZ({
      url: getTitilerTileUrl(info.s3Key, info.datasetId),
      maxZoom: 17,
      tileSize: 256,
    });
    return new TileLayer({ source, opacity: 0 });
  }
  
  // Fallback: GeoTIFF cũ
  const source = new GeoTIFF({...});
  return new WebGLTileLayer({ source, style, opacity: 0 });
}
```

#### 2.4 Thêm feature toggle

Thêm biến môi trường để bật/tắt TiTiler dễ dàng:

```env
# .env.local
NEXT_PUBLIC_TITILER_URL=http://123.22.61.134:8000
NEXT_PUBLIC_USE_TITILER=true
```

Trong code:
```typescript
const useTitiler = process.env.NEXT_PUBLIC_USE_TITILER === 'true' && titilerAvailable;
```

---

### Phase 3: Xử Lý Inspect Pixel Value (1 ngày)

**Vấn đề**: PNG tile không chứa giá trị gốc (salinity=12.5 ppt).

**Giải pháp**: Giữ 1 GeoTIFF source invisible chỉ để inspect.

#### Cách làm

```typescript
// Trong map-stage.tsx, hàm inspectAtPixel:

const inspectAtPixel = async (evt) => {
  // 1. Thử lấy từ hidden GeoTIFF source trước
  const hiddenLayer = hiddenGeotiffLayers[key];
  if (hiddenLayer) {
    const buf = hiddenLayer.getData(evt.pixel);
    if (buf) return processValue(buf[0], key);
  }
  
  // 2. Fallback: gọi API TiTiler để lấy giá trị tại điểm
  const response = await fetch(
    `${TITILER_URL}/point?url=${s3Key}&lng=${lng}&lat=${lat}`
  );
  const { value } = await response.json();
  return processValue(value, key);
};
```

TiTiler có sẵn endpoint `/point` trả về giá trị tại 1 tọa độ:
```
GET /point?url=s3://bucket/file.tif&lng=106.5&lat=9.8
→ { "value": 12.5, "band": 1, "lng": 106.5, "lat": 9.8 }
```

**Hiệu quả**: Chỉ tải 1 request nhỏ khi inspect, không cần GeoTIFF source ẩn.

---

### Phase 4: Tối Ưu & CDN (2-3 ngày)

#### 4.1 Disk cache cho TiTiler

```bash
# TiTiler tự động cache tile vào RAM
# Có thể thêm Redis cho cache phân tán
pip install titiler[redis]

# Cấu hình Redis cache
export TITILER_CACHE_REDIS_URL=redis://localhost:6379/0
```

#### 4.2 Cloudflare CDN

```dns
# DNS: Thêm CNAME
titiler.mekongsaltlab.org → 123.22.61.134
```

```bash
# Cloudflare cache rule:
# Cache tất cả tile PNG trong 7 ngày
# Bypass cache khi có ?refresh=true
```

#### 4.3 Nginx reverse proxy (tùy chọn)

```nginx
server {
    listen 443 ssl;
    server_name titiler.mekongsaltlab.org;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_cache titiler_cache;
        proxy_cache_valid 200 7d;
        proxy_cache_use_stale error timeout;
        add_header X-Cache $upstream_cache_status;
    }
}
```

---

## 📊 Kiểm Thử & Rollback

### Kiểm thử từng bước

```bash
# 1. Kiểm tra TiTiler health
curl -s http://localhost:8000/health
# → {"status": "OK"}

# 2. Lấy 1 tile PNG
curl -s -o tile.png \
  "http://localhost:8000/tiles/256/12/3456/7890.png?url=s3://c01-mekong-prod-01/gis-data/..."
# → file tile.png ~5-15KB

# 3. Kiểm tra point query
curl -s "http://localhost:8000/point?url=s3://...&lng=106.5&lat=9.8"
# → {"value": 12.5}

# 4. Test frontend với feature toggle OFF → vẫn dùng GeoTIFF cũ
NEXT_PUBLIC_USE_TITILER=false

# 5. Test frontend với feature toggle ON
NEXT_PUBLIC_USE_TITILER=true
```

### Rollback

```bash
# Frontend: chỉ cần set
NEXT_PUBLIC_USE_TITILER=false
# → ngay lập tức quay về GeoTIFF cũ

# Backend: tắt TiTiler
sudo systemctl stop titiler
# → frontend tự động fallback
```

---

## 🗓️ Tiến Độ Dự Kiến

| Phase | Nội dung | Thời gian | Ai làm |
|-------|----------|-----------|--------|
| **0** | Chuyển GeoTIFF → COG | 1-2 ngày | DevOps |
| **1** | Cài đặt TiTiler | 1 ngày | DevOps |
| **2** | Tích hợp Frontend | 2-3 ngày | Frontend |
| **3** | Xử lý Inspect | 1 ngày | Fullstack |
| **4** | CDN + Tối ưu | 2-3 ngày | DevOps |
| | **Tổng cộng** | **~7-10 ngày** | |

---

## 🔍 Rủi Ro & Giảm Thiểu

| Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
|--------|:--------:|:---------:|-----------|
| TiTiler memory leak | Thấp | Service crash | Auto-restart systemd, monitor |
| S3 credentials thay đổi | Trung | Tile không load | .env file, alert |
| Python version conflict | Thấp | Không cài được | Docker container |
| Old browser không support PNG | Rất thấp | Không xem được | Fallback GeoTIFF |
| Inspect giá trị không chính xác | Trung | Sai số liệu | Kiểm thử kỹ /point endpoint |

---

## 📝 Checklist Triển Khai

- [ ] **Phase 0**: 
  - [ ] Cài GDAL
  - [ ] Test convert 1 file thành COG
  - [ ] Upload COG test lên S3
  - [ ] Kiểm tra kích thước file giảm
  - [ ] Script convert batch

- [ ] **Phase 1**:
  - [ ] Cài Python venv + TiTiler
  - [ ] Test health endpoint
  - [ ] Test tile PNG
  - [ ] Test point query
  - [ ] Systemd service
  - [ ] Monitor script

- [ ] **Phase 2**:
  - [ ] Tạo `lib/constants/titiler.ts`
  - [ ] Sửa `useS3LayerRenderer.ts` — thêm XYZ source
  - [ ] Feature toggle
  - [ ] Test với 1 dataset
  - [ ] Test với nhiều datasets

- [ ] **Phase 3**:
  - [ ] Test /point endpoint
  - [ ] Sửa `inspectAtPixel` — dùng TiTiler point
  - [ ] Kiểm tra độ chính xác

- [ ] **Phase 4**:
  - [ ] Cloudflare DNS
  - [ ] Nginx cache
  - [ ] Load test
  - [ ] Benchmark FPS

---

## 📐 Đo Lường Kết Quả

```typescript
// Benchmark helper (dùng trong browser console)
await measureLoadTime('Landuse Classification', async () => {
  // Load 1 layer → đo thời gian
});

await measureFPS(async () => {
  // Pan từ A→B trong 3s → đo frame rate
});
```

**Chỉ số cần đạt**:
| Metric | Hiện tại | Mục tiêu |
|--------|:--------:|:--------:|
| Time to first tile | 3-8s | **< 1s** |
| Load 7 layers | 15-30s | **< 3s** |
| FPS khi pan (desktop) | 15-25 | **55-60** |
| FPS khi pan (mobile) | 8-15 | **30-45** |
| GPU memory | 200-500MB | **< 50MB** |
| Tile size | 200KB-2MB | **5-15KB** |
