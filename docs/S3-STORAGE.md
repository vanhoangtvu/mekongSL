# S3 Storage API

## Thong tin ket noi

- **Endpoint**: https://backup.hci.vn
- **Bucket**: c01-mekong-prod-01
- **Region**: us-east-1
- **Access**: Path-style (custom S3-compatible endpoint)
- **Max file size**: 100MB

## Cau truc S3 Bucket

```
c01-mekong-prod-01/
├── gis-data/                          # GIS raster/vector layers
│   └── {dataset}/{category}/{year}/{month}/{day}/{time}/{type}/{file}
├── station-data/                      # Station data files
│   └── {stationCode}/{parameter}/{year}/{month}/{day}/{time}/{file}
├── monitoring-data/                   # Monitoring data files
│   └── {monitoringCode}/{parameter}/{year}/{month}/{day}/{time}/{file}
├── news-images/                       # Article images
├── uploads/                           # Auto-generated key uploads
└── backups/                           # MySQL backups
```

## API Endpoints

### 1. Upload File
```bash
POST /api/s3/upload
Authorization: Bearer <token>  # DATA_MANAGER hoac ADMIN
Content-Type: multipart/form-data

Parameters:
  file:       (required) File to upload
  key:        (optional) Custom S3 key. Must start with: gis-data/, station-data/, monitoring-data/, news-images/
  overwrite:  (optional, default: false)
```

**Examples:**
```bash
# Upload voi key tu dong (uploads/YYYYMMDD_HHmmss_filename)
curl -X POST http://localhost:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data.tif"

# Upload voi key tuy chinh
curl -X POST http://localhost:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "key=gis-data/hydrology/salinity/2026/raster/map.tif" \
  -F "file=@map.tif"

# Upload voi overwrite
curl -X POST "http://localhost:8084/api/s3/upload?overwrite=true" \
  -H "Authorization: Bearer $TOKEN" \
  -F "key=gis-data/test.tif" \
  -F "file=@test.tif"
```

**Response:**
```json
{
  "key": "gis-data/hydrology/salinity/2026/raster/map.tif",
  "url": "https://backup.hci.vn/c01-mekong-prod-01/gis-data/hydrology/salinity/2026/raster/map.tif",
  "message": "File uploaded successfully"
}
```

### 2. Download File
```bash
GET /api/s3/download?key={key}
# PUBLIC - khong can token

# Hoac dung path variable:
GET /api/s3/download/{key}
```

**Example:**
```bash
curl "http://localhost:8084/api/s3/download?key=gis-data/salinity.tif" -o output.tif
```

### 3. List Files
```bash
GET /api/s3/list?prefix={prefix}

# gis-data/ prefix: PUBLIC
# Cac prefix khac: Yeu cau authentication
```

**Example:**
```bash
# Public (khong can token)
curl "http://localhost:8084/api/s3/list?prefix=gis-data/"

# Authenticated
curl "http://localhost:8084/api/s3/list?prefix=uploads/" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "files": [
    { "key": "gis-data/raster/salinity_313_900.tif", "size": 1234567, "lastModified": "2026-05-25T10:30:00Z" }
  ],
  "count": 1
}
```

### 4. List Folders (voi delimiter)
```bash
GET /api/s3/folders?prefix={prefix}
Authorization: Bearer <token>

# Response:
{
  "folders": ["gis-data/hydrology/", "gis-data/landsat-imagery/"],
  "files": [{ "key": "...", "size": 123, "lastModified": "..." }],
  "prefix": "gis-data/"
}
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
