<br>
<div align="center">

# 🌊 Mekong WebGIS

*WebGIS · Giám sát · Dự báo · Phân tích · Đồng bằng sông Cửu Long*

![Java](https://img.shields.io/badge/Java-17-ED8B00?style=flat-square&logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.0-6DB33F?style=flat-square&logo=springboot)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)
![OpenLayers](https://img.shields.io/badge/OpenLayers-10.9-1F6B75?style=flat-square&logo=openlayers)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql)

[*Trang chủ →*](https://mekongsaltlab.org)

</div>

---

## 🌊 Tổng quan

**Mekong WebGIS** là nền tảng giám sát & trực quan hóa dữ liệu không gian địa lý,
phục vụ quản lý tài nguyên nước, khí tượng thủy văn và môi trường
khu vực **Đồng bằng sông Cửu Long**.

| 🗺️ Bản đồ tương tác | 📡 Dữ liệu Realtime | 📊 Phân tích chuyên sâu |
|:---:|:---:|:---:|
| OpenLayers 10.9 | Ecowitt · Mekong API | Biểu đồ · Thống kê |
| 8 Base Layers | Mỗi 15 phút | Salinity · Tidal · pH |
| Timeline · Timelapse | Cảm biến thủy văn | Landuse · QCVN Standards |

### 🧩 Các dịch vụ

| Dịch vụ | Công nghệ | Port | Mục đích |
|---------|-----------|:----:|----------|
| **Frontend** | Next.js 15 · React 19 · TS 5.8 | **3004** | Giao diện WebGIS |
| **Backend** | Spring Boot 4.0 · Java 17 | **8084** | REST API · Auth · S3 |
| **Datacenter** | Node.js ESM · Cron | — | Pipeline dữ liệu |
| **TiTiler** (tùy chọn) | Python · FastAPI | **8001** | Tile server PNG |

---

## ⚡ Quick Start

```bash
git clone https://github.com/vanhoangtvu/mekongSL.git Mekong
cd Mekong
cp .env.example .env              # Sửa file .env với thông tin của bạn
./manage.sh                       # Menu quản lý
```

**Sau khi chạy `./manage.sh`:**

| Phím | Chức năng |
|:----:|-----------|
| **1** | Khởi động Backend (Spring Boot, port 8084) |
| **2** | Khởi động Frontend (Next.js dev, port 3004) |
| **A** | Restart tất cả dịch vụ |
| **C** | Auto convert GeoTIFF → COG (tối ưu tốc độ) |
| **9** | Đổi IP (tự động cập nhật CORS + env) |

### 📘 Tài liệu triển khai chi tiết

👉 **[DEPLOY.md](DEPLOY.md)** — Hướng dẫn từ git pull → chạy hoàn chỉnh

---

## 🏗️ Stack

<details open>
<summary><b>🖥️ Frontend</b> <sub>Next.js 15 · React 19 · TypeScript 5.8 · OpenLayers 10.9</sub></summary>

```bash
cd frontend && npm install && npm run build && npm run start    # port 3004
```

> **Dependencies:** `ol` `recharts` `proj4` `lucide-react` `xlsx`

| Chức năng | File chính | Mô tả |
|-----------|-----------|-------|
| 🗺️ MapStage | `features/map/map-stage.tsx` | Bản đồ trung tâm, 8 base layers, UTM 48N |
| 🕐 Timeline | `features/map/temporal-timeline-control.tsx` | Điều khiển thời gian (giờ/ngày/tháng/năm) |
| 🎬 Timelapse | `features/map/timelapse-player.tsx` | Phát lại dữ liệu raster tự động |
| 📍 Inspector | (trong `map-stage.tsx`) | Click/hover xem giá trị pixel + thuộc tính vector |
| 🌡️ Weather | Popup Ecowitt + sparkline charts (Recharts) | Trạm thời tiết |
| 💧 Water Quality | `features/hydrology/` | Trạm chất lượng nước + ảnh hiện trường |
| 🌿 Landuse | Trong `useS3LayerRenderer.ts` | Vector DXF + Raster classification |
| 🔍 Sidebar | `features/map/geo-search-sidebar.tsx` | Dataset tree 3 cấp, tìm kiếm |
| 📱 Mobile | Responsive layout, bottom sheet | Tương thích mobile |

**Tối ưu hiệu năng:**
- **Direct backend URL** — Tile GeoTIFF gọi thẳng Spring Boot (bỏ proxy Next.js) → **nhanh hơn 4×**
- `resolveTileUrl()`: `/api/tif?key=...` → `http://ip:8084/api/s3/render?key=...`
- `Cache-Control: public, max-age=86400` trên proxy tile
- `maxZoom: 17` cho raster layers
- `MAX_SOURCE_CACHE = 100` GeoTIFF sources cache trong RAM
- `landuseStyleCache` cho vector DXF (10.993 features)
- **Không fade animation** — hiển thị layer ngay lập tức
- **renderOrder vector** — polygon nhỏ vẽ trên cùng, không bị che
- **Web Worker** — parse GeoJSON trong worker, không block UI

</details>

<details>
<summary><b>⚙️ Backend</b> <sub>Spring Boot 4.0 · Java 17 · MySQL 8.0</sub></summary>

```bash
cd backend && ./mvnw clean package -DskipTests && java -jar target/*.jar    # port 8084
```

> **Dependencies:** Spring Security · JWT · JPA/Hibernate · Apache POI · Lombok · AWS S3 SDK · SpringDoc OpenAPI

| Module | Endpoints | Auth |
|--------|-----------|:----:|
| 🔐 Auth | `/api/auth/login` `/register` | Public |
| 👥 Users | `/api/admin/users` | ADMIN |
| 📰 Articles | `/api/articles` `/api/articles/public` | Mixed |
| ☁️ S3 | Upload / Download / List / Delete / Copy / Rename / Folder / Signed URL / Render / Stats | **Download + List public** cho `gis-data/`, `station-data/`, `news-images/` |
| 🗺️ GIS Layers | `/api/gis/layers` (search: bbox, province, station, tag, time) | Mixed |
| 📂 Datasets | `/api/gis/datasets` | DATA_MANAGER+ |
| 📍 Stations | `/api/gis/manual-stations` (public GET) | Mixed |
| 💧 Water Quality | `/api/gis/water-quality` (public GET) | Mixed |
| 📊 Monitoring | `/api/gis/monitoring-data` | DATA_MANAGER+ |
| 🌿 Landuse | `/api/gis/landuse-yearly-stats` | Public |
| 🏷️ Tags | `/api/gis/tags` | DATA_MANAGER+ |
| 💾 Backup | `/api/backup` | ADMIN |

**Security — endpoint public:**
```
GET  /api/auth/**
POST /api/auth/login
GET  /api/s3/download          → gis-data/, station-data/, news-images/
GET  /api/s3/render            → gis-data/
GET  /api/s3/list              → public
GET  /api/gis/manual-stations  → public
GET  /api/gis/water-quality    → public
GET  /api/articles/public      → public
     /api/gis/landuse-yearly-stats → public
     /swagger-ui/** /v3/api-docs/** → public
```

**CORS:** Cho phép `localhost:3004`, `localhost:3000`, IP máy chủ, `mekongsaltlab.org`

**Database migrations:** `backend/db/mysql/` (V001–V005: GIS metadata, storage, articles)

</details>

<details>
<summary><b>📡 Datacenter</b> <sub>Node.js ESM · MySQL2 · Cron</sub></summary>

```bash
cd datacenter && npm install && node cron-wrapper.mjs
```

| Nguồn | Tần suất | Dữ liệu | Bảng |
|-------|----------|---------|------|
| 🌤️ Ecowitt | 15 phút | Nhiệt độ, ẩm, gió, mưa, UV, bức xạ | `ecowitt` |
| 🌊 Mekong API | 5 lần/ngày | Salinity, pH, WaterLevel, Alkalinity | `mekong_sensor`, `mekong_measurement` |

Scripts:
- `ecowitt/fetch-ecowitt-data.mjs` — Fetch dữ liệu thời tiết
- `ecowitt/run-scheduled-fetch.mjs` — Fetch theo lịch
- `mekong/fetch-mekong-data.mjs` — Fetch dữ liệu thủy văn
- `mekong/migrate-mekong-legacy.mjs` — Migrate dữ liệu cũ
- `lib/persistence.mjs` — MySQL connection pool (dùng chung với backend)
- `config/schedule.json` — Lịch chạy cron

</details>

<details>
<summary><b>🧠 TiTiler</b> <sub>Python · Tile Server (tùy chọn)</sub></summary>

```bash
python3 -m venv ~/titiler-env
source ~/titiler-env/bin/activate
pip install titiler uvicorn boto3 python-multipart
./scripts/titiler-start.sh    # port 8001
```

> **Khi nào cần:** Khi render GeoTIFF trong browser chưa đạt 60fps.  
> TiTiler chuyển GeoTIFF → **PNG tile** (5-15KB thay vì 200KB-2MB) → GPU nhẹ hơn, load nhanh hơn.  
> Hiện tại chưa bật mặc định (`NEXT_PUBLIC_USE_TITILER=false`). Bật bằng menu [10].

**Endpoints:**
- `/cog/tiles/{z}/{x}/{y}.png` — Tile PNG có màu
- `/cog/point/{lon},{lat}` — Inspect pixel value
- `/cog/info` — File metadata

</details>

---

## 🔐 Phân quyền

| Vai trò | Quyền |
|---------|-------|
| **USER** | Xem bản đồ, articles, download S3 (gis-data, station-data), WQ data |
| **DATA_MANAGER** | Upload/Delete S3, GIS CRUD, Import dữ liệu |
| **ADMIN** | Quản lý users, backup, toàn quyền |

**Tài khoản mặc định** (tạo tự động khi chạy backend lần đầu):
- **admin** / `admin123` — ADMIN
- **manager** / `manager123` — DATA_MANAGER

---

## 🗄️ Dữ liệu trên S3

```
c01-mekong-prod-01 (S3-compatible: backup.hci.vn)
│
├── gis-data/                          ← Dữ liệu GIS (953+ files)
│   ├── hydrology/
│   │   ├── salinity/    (251 files, cập nhật mỗi 15 phút)
│   │   ├── tidal/       (245 files)
│   │   └── ph/          (250 files)
│   ├── landsat-imagery/
│   │   └── band-1..7/   (84 files, 2014-2025, ~6.5MB → COG ~1.3MB)
│   ├── baseline-environment/
│   │   ├── landuse-classification/  (35 raster, ~6.8MB → COG ~300KB)
│   │   ├── landuse-planning/        (3 vector GeoJSON, ~11MB → FGB ~7MB)
│   │   └── channel-system/         (vector)
│   ├── administration/              (vector: province, commune, hamlet)
│   ├── flooding-modeling/          (2 raster)
│   ├── ecology/                    (chưa có dữ liệu)
│   ├── cog/                        ← Raster COG đã tối ưu (tự động sinh)
│   └── fgb/                        ← Vector FlatGeobuf (hiện không dùng)
│
├── station-data/                    ← Ảnh hiện trường (public)
│   └── manual-stations/
├── monitoring-data/                 ← Dữ liệu giám sát (auth)
└── news-images/                     ← Ảnh bài viết (public)
```

> **Ghi chú:** Files trong `gis-data/cog/` được **auto-convert** từ GeoTIFF gốc sang COG (Tiled, DEFLATE, overviews). Dung lượng giảm **75-95%**. File gốc vẫn được giữ nguyên tại `gis-data/`.

---

## 📁 Cấu trúc source code

```
Mekong/
├── manage.sh                   # CLI quản lý hệ thống (menu)
├── .env                        # Biến môi trường (API keys, S3, JWT)
├── .env.example                # Mẫu file .env
├── DEPLOY.md                   # Hướng dẫn triển khai chi tiết
├── README.md                   # (file này)
│
├── frontend/                   # Next.js 15 App Router
│   ├── .env.local              # Frontend env (API_URL, TITILER_URL)
│   └── src/
│       ├── app/
│       │   ├── (public)/       # Home, About, News, Auth, Data, Download
│       │   ├── (dashboard)/    # Dashboard, Data-ops
│       │   └── api/            # Proxy routes (tif, ecowitt, s3-list, mysql, ...)
│       ├── features/
│       │   ├── map/            # MapStage, Timeline, Timelapse, Sidebar, Inspector
│       │   ├── hydrology/      # Water quality
│       │   ├── weather/        # Ecowitt
│       │   ├── admin/          # Admin panels
│       │   └── auth/           # Login/Register
│       ├── components/
│       │   ├── layout/         # Header, Footer, ResizablePanel
│       │   ├── admin/          # S3Manager, NewsManager, LanduseCompute
│       │   └── ui/             # UI primitives
│       ├── hooks/              # Custom hooks
│       ├── lib/
│       │   ├── constants/      # Datasets, Colormaps, TitilerConfig
│       │   ├── api/            # API client
│       │   ├── utils/          # Geo utils
│       │   ├── workers/        # Web Worker (vector parser)
│       │   ├── auth.ts         # Auth service
│       │   └── admin-api.ts    # API functions
│       └── styles/theme/       # Theme CSS
│
├── backend/                    # Spring Boot 4.0
│   ├── pom.xml                 # Maven (Java 17, Spring Boot 4.0.6)
│   ├── db/mysql/               # DB migrations (V001-V005)
│   └── src/main/java/com/mekongsaltlab/org/
│       ├── MekongsaltlabApplication.java
│       ├── config/             # SecurityConfig, S3Config, DataInit
│       ├── controller/         # REST controllers + GIS controllers (12)
│       ├── service/            # Business logic + GIS services
│       ├── entity/             # JPA entities + GIS entities (18 tables)
│       ├── repository/         # Spring Data repos (18 GIS repos)
│       ├── dto/                # DTOs (30+ classes)
│       ├── security/           # JWT filter + util
│       └── exception/          # GlobalExceptionHandler
│
├── datacenter/                 # Data Pipeline
│   ├── ecowitt/                # Weather fetch scripts
│   ├── mekong/                 # Hydrology fetch scripts
│   ├── lib/persistence.mjs     # MySQL connection pool
│   ├── config/schedule.json    # Lịch cron
│   ├── migrations/             # SQL migrations
│   └── docs/                   # Documentation
│
├── scripts/                    # System scripts
│   ├── auto-cog-watch.sh       # Auto-detect + convert → COG
│   ├── convert-to-cog.sh       # Manual file → COG
│   ├── cog-batch-convert.sh    # Batch convert (bash)
│   ├── cog_convert_upload.py   # Batch convert (Python, đã dùng)
│   └── titiler-start.sh        # Start TiTiler service
│
├── docs/                       # Tài liệu kỹ thuật
├── data/                       # Dữ liệu Ecowitt/Mekong output
└── *.dxf / *.dgn               # Bản đồ CAD gốc
```

---

## 🔧 Quản lý với manage.sh

```bash
./manage.sh
```

```
┌──────────────────────────────────────────────────────────────┐
│                  MEKONG MANAGEMENT                           │
├──────────────────────────────────────────────────────────────┤
│  ● Backend  │ 1234  │ 8084  │ ---  │ 2d 3h  │ 256 MB       │
│  ● Frontend │ 5678  │ 3004  │ Dev  │ 2d 3h  │ 793 MB       │
│  ● TiTiler  │ 9012  │ 8001  │ Tile │ 5h 12m │ 128 MB       │
├──────────────────────────────────────────────────────────────┤
│  [1] Khởi động backend       [6] Build & Restart             │
│  [2] FE Dev mode             [7] Xem log backend             │
│  [3] FE Production mode      [8] Xem log frontend            │
│  [4] Dừng backend            [9] Đổi IP                     │
│  [5] Dừng frontend          [10] Start TiTiler               │
│  [0] Thoát                  [11] Stop TiTiler                │
│  [C] Auto convert COG                                        │
└──────────────────────────────────────────────────────────────┘
```

**Tính năng:**
- Dashboard real-time: PID, port, uptime, RAM từng service
- Auto-detect IP, cập nhật CORS + `.env.local` khi đổi IP
- Restart / Build & Restart backend
- Sync PID files với port thực tế

---

## 📊 Tối ưu hiệu năng

### COG (Cloud Optimized GeoTIFF)

| Dữ liệu | File gốc | File COG | Giảm | Ghi chú |
|---------|:--------:|:--------:|:----:|---------|
| Landuse Classification (35 files) | **227 MB** | **10 MB** | **95%** | ✅ Đã convert |
| Landsat Imagery (84 files) | **545 MB** | **134 MB** | **75%** | ✅ Đã convert |
| Hydrology (salinity, tidal, pH) | ~30KB | — | — | File nhỏ, không cần COG |

**Cơ chế:** File gốc giữ nguyên tại `gis-data/`. File COG lưu tại `gis-data/cog/`. Frontend ưu tiên tải COG, fallback về file gốc.

**Auto-convert:** script `auto-cog-watch.sh` chạy theo crontab:
```bash
*/5 * * * * /home/.../Mekong/scripts/auto-cog-watch.sh
```

### Frontend rendering

| Cải thiện | Mô tả |
|-----------|-------|
| **Direct backend URL** | Tile raster gọi thẳng Spring Boot, bỏ qua Next.js proxy → **nhanh hơn 4×** |
| **maxZoom: 17** | Giới hạn zoom raster → giảm tile không cần thiết |
| **Cache 24h** | `Cache-Control: public, max-age=86400` |
| **Source cache** | 100 GeoTIFF sources cache trong RAM |
| **Style cache** | Landuse vector style cache (10.993 features) |
| **No fade animation** | Layer hiện ngay, không fade-in |
| **No GPU polling** | Bỏ `waitForLayerRender` |
| **renderOrder** | Polygon nhỏ vẽ trên cùng |
| **Web Worker** | Parse GeoJSON không block UI |

---

## 📖 Tài liệu tham khảo

| File | Nội dung |
|------|----------|
| [DEPLOY.md](DEPLOY.md) | **Hướng dẫn triển khai từ A-Z (quan trọng!)** |
| [docs/deployment.md](docs/deployment.md) | Hướng dẫn triển khai (cũ) |
| [docs/api-auth.md](docs/api-auth.md) | Xác thực & JWT |
| [docs/roles.md](docs/roles.md) | Bảng phân quyền chi tiết |
| [docs/s3-storage.md](docs/s3-storage.md) | S3 Storage API |
| [docs/backup-strategy.md](docs/backup-strategy.md) | Chiến lược sao lưu |
| [docs/security.md](docs/security.md) | Bảo mật hệ thống |
| [docs/security-report.md](docs/security-report.md) | Báo cáo đánh giá bảo mật |
| [docs/data-upload.md](docs/data-upload.md) | Spec upload dữ liệu |
| [docs/mekong-data-import.md](docs/mekong-data-import.md) | Import dữ liệu Mekong |
| [docs/performance-improvement-plan.md](docs/performance-improvement-plan.md) | Kế hoạch cải thiện hiệu năng |
| [docs/landuse-planning-optimization.md](docs/landuse-planning-optimization.md) | Tối ưu vector Landuse Planning |
| [docs/titiler-migration-plan.md](docs/titiler-migration-plan.md) | Kế hoạch triển khai TiTiler |
| [datacenter/docs/monthly-excel-structure.md](datacenter/docs/monthly-excel-structure.md) | Cấu trúc Excel tháng |

---

## 🔧 Xử lý sự cố thường gặp

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|------------|-----------|
| **403 khi tải ảnh station** | Backend code cũ, thiếu public download fix | `./manage.sh` → [6] Build & Restart |
| **Thiếu Tidal trong danh sách** | Backend chưa có pagination fix | Restart backend với code mới |
| **File 6.5MB (chậm)** | Chưa convert COG | `./manage.sh` → [C] Auto convert |
| **"Maximum update depth"** | Cache Next.js cũ / lỗi pointermove | `Ctrl+Shift+R` hard reload |
| **TiTiler không start** | Thiếu Python packages | `pip install titiler uvicorn boto3` |
| **Landuse Planning không hiện** | Thiếu file GeoJSON trên S3 | Upload file `.geojson` vào S3 |
| **Composite (RGB) không hiện** | Không có file RGB trên S3 | Cần upload file Landsat RGB |
| **Tải file chậm qua proxy** | Next.js proxy thêm latency | Đã fix: frontend gọi backend trực tiếp |

---

## 📬 Liên hệ

| | |
|---|---|
| **Phát triển** | **hoangtvu** |
| **GitHub** | [github.com/vanhoangtvu](https://github.com/vanhoangtvu) |
| **Trang chủ** | [mekongsaltlab.org](https://mekongsaltlab.org) |

---

<br>
<div align="center">

<sub>Developed with ❤️ by **hoangtvu** · © 2026 Mekong WebGIS</sub>

</div>
# LacGroup
