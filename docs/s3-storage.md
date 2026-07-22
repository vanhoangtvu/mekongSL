# S3 Storage API

## Thông tin kết nối

- **Endpoint**: https://backup.hci.vn
- **Bucket**: c01-mekong-prod-01
- **Region**: us-east-1
- **Access**: Path-style (custom S3-compatible endpoint)
- **Max file size**: 100MB

---

## Cấu trúc S3 Bucket

```
c01-mekong-prod-01/
├── gis-data/                              # Dữ liệu GIS (953+ files)
│   ├── hydrology/                         # Thủy văn (salinity, tidal, pH)
│   │   └── {type}/{year}/{month}/{day}/{time}/raster/{file}.tif
│   ├── landsat-imagery/                   # Landsat 7 bands (84 files)
│   │   └── band-{1..7}/{year}/raster/{file}.tif
│   ├── baseline-environment/              # Môi trường nền
│   │   ├── landuse-classification/        # Raster (35 files)
│   │   │   └── {class}/{year}/raster/{file}.tif
│   │   ├── landuse-planning/              # Vector GeoJSON (3 districts)
│   │   │   └── {district}/{year}/vector/{file}.geojson
│   │   └── channel-system/               # Vector (canal, dike, bridge...)
│   ├── administration/                   # Vector (province, commune, hamlet)
│   ├── flooding-modeling/               # Raster (2 files)
│   ├── cog/                              # File COG đã tối ưu (tự động sinh)
│   │   ├── baseline-environment/landuse-classification/  (35 files)
│   │   └── landsat-imagery/band-{1..7}/               (84 files)
│   └── fgb/                              # FlatGeobuf (hiện không dùng)
│
├── station-data/                          # Dữ liệu trạm
│   └── manual-stations/                   # Ảnh hiện trường
│       └── station_import_*.jpeg
├── monitoring-data/                       # Dữ liệu giám sát
└── news-images/                           # Ảnh bài viết
```

> **Lưu ý quan trọng:**
> - File gốc giữ nguyên tại `gis-data/`. File COG tối ưu lưu tại `gis-data/cog/`.
> - Frontend tự động ưu tiên tải file COG, fallback về file gốc nếu không có.
> - `gis-data/` listing trả về **toàn bộ 953+ files** (đã fix pagination, không còn bị truncate).

---

## API Endpoints

### 1. Upload File

```bash
POST /api/s3/upload
Authorization: Bearer <token>  # DATA_MANAGER hoặc ADMIN
Content-Type: multipart/form-data

Parameters:
  file:       (required) File to upload
  key:        (optional) Custom S3 key. Must start with: gis-data/, station-data/, monitoring-data/, news-images/
  overwrite:  (optional, default: false)
```

**Examples:**
```bash
# Upload với key tự động
curl -X POST http://localhost:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data.tif"

# Upload với key tùy chọn
curl -X POST http://localhost:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "key=gis-data/hydrology/salinity/2026/raster/map.tif" \
  -F "file=@map.tif"

# Upload với overwrite
curl -X POST "http://localhost:8084/api/s3/upload?overwrite=true" \
  -H "Authorization: Bearer $TOKEN" \
  -F "key=gis-data/test.tif" \
  -F "file=@test.tif"
```

**Response:**
```json
{
  "key": "gis-data/hydrology/salinity/2026/raster/map.tif",
  "url": "https://backup.hci.vn/c01-mekong-prod-01/gis-data/...",
  "message": "File uploaded successfully"
}
```

### 2. Download File

```bash
GET /api/s3/download?key={key}
# PUBLIC cho prefix: gis-data/, station-data/, news-images/
# Yêu cầu auth cho các prefix khác
```

**Examples:**
```bash
# Public - không cần token (gis-data/, station-data/, news-images/)
curl "http://localhost:8084/api/s3/download?key=gis-data/hydrology/.../file.tif" -o output.tif

# Yêu cầu auth (monitoring-data/ và các prefix khác)
curl "http://localhost:8084/api/s3/download?key=monitoring-data/.../file.tif" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Render GeoTIFF (cho map viewer)

```bash
GET /api/s3/render?key={key}
# PUBLIC (chỉ gis-data/ prefix)
# Hỗ trợ HTTP Range requests (partial content)
```

**Example:**
```bash
curl "http://localhost:8084/api/s3/render?key=gis-data/hydrology/.../file.tif"
# → image/tiff với Content-Range header (cho tiled rendering)
```

### 4. List Files

```bash
GET /api/s3/list?prefix={prefix}

# gis-data/ prefix: PUBLIC
# Các prefix khác: Yêu cầu authentication
```

**Examples:**
```bash
# Public (không cần token)
curl "http://localhost:8084/api/s3/list?prefix=gis-data/"
# → 953+ files (đã fix pagination, không truncate)

# Authenticated
curl "http://localhost:8084/api/s3/list?prefix=station-data/" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "files": [
    { "key": "gis-data/hydrology/salinity/.../file.tif", "size": 30364, "lastModified": "2026-05-25T10:30:00Z" }
  ],
  "count": 1
}
```

### 5. List Folders (with delimiter)

```bash
GET /api/s3/folders?prefix={prefix}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "folders": ["gis-data/hydrology/", "gis-data/landsat-imagery/"],
  "files": [{ "key": "...", "size": 123, "lastModified": "..." }],
  "prefix": "gis-data/"
}
```

### 6. Delete File

```bash
DELETE /api/s3/delete?key={key}
Authorization: Bearer <token>  # DATA_MANAGER hoặc ADMIN
```

### 7. Other Endpoints

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|-------|
| POST | `/api/s3/copy` | ADMIN/DATA_MANAGER | Copy file |
| POST | `/api/s3/rename` | ADMIN/DATA_MANAGER | Rename file |
| POST | `/api/s3/create-folder` | ADMIN/DATA_MANAGER | Tạo folder |
| POST | `/api/s3/rename-folder` | ADMIN/DATA_MANAGER | Rename folder |
| GET | `/api/s3/exists` | Authenticated | Kiểm tra file tồn tại |
| GET | `/api/s3/signed-url` | Authenticated | Tạo signed URL |
| GET | `/api/s3/stats` | ADMIN/DATA_MANAGER | Thống kê storage |
| GET | `/api/s3/render` | Public (gis-data/) | Render GeoTIFF |
| POST | `/api/s3/download-token` | ADMIN/DATA_MANAGER | Tạo token download |
| GET | `/api/s3/download-by-token` | ADMIN/DATA_MANAGER | Download bằng token |

---

## Cơ chế bảo vệ

- **Upload**: chỉ ADMIN/DATA_MANAGER
- **Delete**: chỉ ADMIN/DATA_MANAGER  
- **Download**: Public cho `gis-data/`, `station-data/`, `news-images/`
- **List**: Public cho `gis-data/` prefix
- **Key validation**: Upload key phải bắt đầu bằng `gis-data/`, `station-data/`, `monitoring-data/`, `news-images/`

---

## Tối ưu COG

Frontend ưu tiên tải file COG từ `gis-data/cog/`:

```javascript
// Frontend tự động:
// 1. Tìm trong gis-data/cog/... (COG ~300KB, load nhanh)
// 2. Nếu không có → fallback về gis-data/... (gốc 6.8MB)
```

Convert thủ công:
```bash
gdal_translate input.tif output_cog.tif \
  -co TILED=YES -co BLOCKXSIZE=256 \
  -co COMPRESS=DEFLATE -of GTiff
gdaladdo -r AVERAGE output_cog.tif 2 4 8 16
```

Tự động qua script:
```bash
./scripts/auto-cog-watch.sh
```
```

### 5. Delete File (hoac Folder)
```bash
DELETE /api/s3/delete?key={key}
Authorization: Bearer <token>  # DATA_MANAGER hoac ADMIN

# Neu key ket thuc bang "/" -> xoa de quy toan bo folder
```

**Example:**
```bash
curl -X DELETE "http://localhost:8084/api/s3/delete?key=uploads/old_file.txt" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{ "message": "File deleted successfully" }
```

### 6. Check File Exists
```bash
GET /api/s3/exists?key={key}
Authorization: Bearer <token>

# Response:
{ "exists": true }
```

### 7. Copy File
```bash
POST /api/s3/copy
Authorization: Bearer <token>  # DATA_MANAGER hoac ADMIN
Content-Type: application/json

{
  "sourceKey": "gis-data/source.tif",
  "destinationKey": "gis-data/backup/source.tif"
}
```

### 8. Rename File
```bash
POST /api/s3/rename
Authorization: Bearer <token>  # DATA_MANAGER hoac ADMIN
Content-Type: application/json

{
  "oldKey": "gis-data/old_name.tif",
  "newKey": "gis-data/new_name.tif"
}
```

### 9. Rename Folder
```bash
POST /api/s3/rename-folder
Authorization: Bearer <token>  # DATA_MANAGER hoac ADMIN
Content-Type: application/json

{
  "oldPrefix": "gis-data/old_folder/",
  "newPrefix": "gis-data/new_folder/"
}
```

### 10. Create Folder
```bash
POST /api/s3/create-folder
Authorization: Bearer <token>  # DATA_MANAGER hoac ADMIN
Content-Type: application/json

{ "path": "gis-data/new-folder/" }
```

### 11. Generate Signed URL
```bash
GET /api/s3/signed-url?key={key}&expires={seconds}
Authorization: Bearer <token>

# expires: thoi gian het han (giay), mac dinh 3600 (1 gio)
```

**Response:**
```json
{
  "url": "https://backup.hci.vn/...?X-Amz-...",
  "expiresAt": "2026-05-25T11:30:00Z",
  "key": "gis-data/file.tif"
}
```

### 12. Render GeoTIFF (Inline)
```bash
GET /api/s3/render?key={key}
# PUBLIC - khong can token
# Chi cho phep gis-data/ prefix
# Ho tro HTTP Range requests (cho geotiff.js)
# Header: Range: bytes=0-1023 -> 206 Partial Content
```

**Example:**
```bash
curl "http://localhost:8084/api/s3/render?key=gis-data/hydrology/salinity/2026/raster/map.tif" \
  -H "Range: bytes=0-16383"
```

### 13. Storage Stats
```bash
GET /api/s3/stats
Authorization: Bearer <token>  # DATA_MANAGER hoac ADMIN
```

**Response:**
```json
{
  "totalSize": 1234567890,
  "fileCount": 150,
  "byCategory": {
    "geotiff": 1000000000,
    "backup": 200000000,
    "image": 30000000,
    "spreadsheet": 4567890,
    "document": 0,
    "archive": 0,
    "data": 0,
    "other": 0
  }
}
```

## DB Tracking

He thong tu dong theo doi moi file S3 trong bang `s3_object`:
- Khi upload: tao/cap nhat record (bucket, s3_key, size_bytes, content_type, etag)
- Khi delete: soft delete (is_deleted = true, deleted_at = NOW())
- Stats endpoint su dung DB tracking de tinh toan dung luong

## Bao mat

- Upload: Chi DATA_MANAGER+ , key prefix validation
- Delete/Copy/Rename: Chi DATA_MANAGER+
- Download: Public
- Render (GeoTIFF): Public, chi gis-data/ prefix
- List gis-data/: Public
- List prefix khac: Authenticated
- Signed URLs: Authenticated
- Stats: DATA_MANAGER+

## Configuration

File: `backend/src/main/resources/application.yaml`
```yaml
s3:
  endpoint: https://backup.hci.vn
  bucket: c01-mekong-prod-01
  access-key: ${S3_ACCESS_KEY}
  secret-key: ${S3_SECRET_KEY}
  region: us-east-1
  max-file-size: 104857600  # 100MB
```

## Dependencies

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
    <version>2.20.26</version>
</dependency>
```
S3-compatible client (software.amazon.awssdk s3 2.20.26) dung S3Client + S3Presigner cho signed URLs.
Path-style access duoc bat cho S3-compatible endpoints.
