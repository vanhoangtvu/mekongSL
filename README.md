# Mekong WebGIS Project

Hệ thống WebGIS hiển thị và quản lý dữ liệu khí tượng thủy văn, môi trường vùng Đồng bằng sông Cửu Long, phát triển cho Mekong Salt Lab (mekongsaltlab.org).

## Cấu trúc dự án

```
Mekong/
├── manage.sh           # Quản lý hệ thống (start/stop/restart/logs/status)
├── frontend/           # Next.js 15 + React 19 + TypeScript + OpenLayers 10.9
├── backend/            # Spring Boot 4.0.6 + Java 17 + Maven
├── datacenter/         # Data pipeline scripts (Node.js ESM + MySQL2)
├── docs/               # Tài liệu dự án
└── data/               # Output data (gitignored)
```

## Quick Start

```bash
./manage.sh
```

## Frontend

**Tech stack:**
- Next.js 15 (App Router)
- React 19
- TypeScript 5.8
- OpenLayers 10.9 (WebGIS)
- Recharts (biểu đồ)
- XLSX (Excel export)
- Proj4 (chuyển đổi tọa độ)

**Tính năng chính:**
- Bản đồ tương tác với 8 base layers (OSM, Satellite, Terrain, Topo, Transport, Humanitarian, Light, Dark)
- Hỗ trợ UTM 48N projection
- Timeline/timelapse cho dữ liệu raster (theo giờ/ngày/tháng/năm)
- Pixel inspector cho GeoTIFF
- Ecowitt popup chart (dữ liệu thời tiết realtime)
- Water quality station overlay
- Landuse classification statistics
- Geo-search sidebar với dataset tree 3 cấp
- Auth: login/register/role-based routing
- Admin dashboard (quản lý users, articles, S3 files)
- Responsive design (mobile support)

**Chạy dev:**
```bash
cd frontend
npm install
npm run dev  # Port 3004
```

## Backend

**Tech stack:**
- Spring Boot 4.0.6 + Java 17
- Spring Security + JWT (jjwt 0.12.3)
- Spring Data JPA (Hibernate)
- MySQL 8.0 (database: `mekong`)
- AWS SDK v2 cho S3 (backup.hci.vn)
- Apache POI (Excel)
- Lombok
- Swagger UI (springdoc-openapi)

**API Modules:**
- Auth: `/api/auth/login`, `/api/auth/register`
- Users: `/api/admin/users` (CRUD)
- Articles: `/api/articles` (tin tức, blog)
- S3 Storage: `/api/s3/upload|download|list|delete|copy|rename|folders|signed-url|render|stats`
- GIS Layers: `/api/gis/layers` (search với bbox, province, station, tag, time)
- GIS Datasets: `/api/gis/datasets`
- GIS Stations: `/api/gis/stations`, `/api/gis/manual-stations`
- GIS Folders: `/api/gis/folders`
- GIS Tags: `/api/gis/tags`
- Water Quality: `/api/gis/water-quality` (import Excel, list samples)
- Monitoring Data: `/api/gis/monitoring-data`
- Backup: `/api/backup`

**Chạy dev:**
```bash
cd backend
./mvnw spring-boot:run  # Port 8084
```

## Datacenter

Pipeline thu thập dữ liệu tự động từ API bên ngoài, lưu vào MySQL.

**Cấu trúc:**
```
datacenter/
├── cron-wrapper.mjs             # Cron scheduler (đọc schedule.json)
├── lib/persistence.mjs          # MySQL upsert/insert, CSV export, table auto-create
├── ecowitt/fetch-ecowitt-data.mjs   # Fetch dữ liệu thời tiết Ecowitt
├── mekong/fetch-mekong-data.mjs     # Fetch dữ liệu thủy văn Mekong (Rynan Mobile)
├── config/schedule.json         # Lịch cron
├── migrations/                  # SQL migration files
├── imports/                     # Import utilities
└── output/                      # CSV snapshots
```

**Data Sources:**
1. **Ecowitt API** - Dữ liệu thời tiết (nhiệt độ, độ ẩm, gió, mưa, áp suất, UV, bức xạ)
   - Fetch mỗi 15 phút
   - Lưu vào bảng `ecowitt`
2. **Mekong API** (Rynan Mobile) - Dữ liệu cảm biến thủy văn (Salinity, PH, WaterLevel, Alkalinity)
   - Fetch 5 lần/ngày (0h, 5h, 10h, 15h, 20h) - hiện đang tắt
   - Lưu vào bảng `mekong_sensor` + `mekong_measurement`

**Chạy:**
```bash
cd datacenter
npm install
cp ../.env.example ../.env

# Fetch Ecowitt
node ecowitt/fetch-ecowitt-data.mjs

# Fetch Mekong
node mekong/fetch-mekong-data.mjs

# Chạy cron scheduler (tự động theo schedule.json)
node cron-wrapper.mjs
```

## S3 Storage

- **Endpoint**: https://backup.hci.vn
- **Bucket**: c01-mekong-prod-01
- **Cấu trúc**: `gis-data/`, `station-data/`, `monitoring-data/`, `news-images/`, `uploads/`, `backups/`

## Phân quyền (Roles)

| Role | Quyền hạn chính |
|------|----------------|
| **USER** | Xem bản đồ, articles public, download S3 files, water-quality public data |
| **DATA_MANAGER** | Upload/delete S3, quản lý data, GIS CRUD, station management |
| **ADMIN** | Toàn quyền: quản lý users, articles, backup, tất cả CRUD |

## Environment Variables

Copy `.env.example` thành `.env` và điền credentials:
```bash
cp .env.example .env
```

## Tài liệu

Xem thêm trong thư mục `docs/`:
- `DEPLOYMENT.md` - Hướng dẫn triển khai
- `API-AUTH.md` - API Authentication
- `ROLES.md` - Phân quyền chi tiết
- `S3-STORAGE.md` - S3 Storage API
- `BACKUP-STRATEGY.md` - Chiến lược backup
- `SECURITY.md` - Bảo mật hệ thống
- `SECURITY-REPORT.md` - Báo cáo bảo mật
- `nhapdata.md` - Spec Upload Data
- `share.md` - Import dữ liệu Mekong

## License

Private project - EVA Team
