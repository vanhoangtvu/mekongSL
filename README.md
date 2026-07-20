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

> **Mekong WebGIS** là nền tảng giám sát & trực quan hóa dữ liệu không gian địa lý,
> phục vụ quản lý tài nguyên nước, khí tượng thủy văn và môi trường
> khu vực Đồng bằng sông Cửu Long.

<br>

| 🗺️ Bản đồ tương tác | 📡 Dữ liệu Realtime | 📊 Phân tích chuyên sâu |
|:---:|:---:|:---:|
| OpenLayers 10.9 | Ecowitt · Mekong API | Biểu đồ · Thống kê |
| 8 Base Layers | Mỗi 15 phút | Landuse · Salinity |
| Timeline · Timelapse | Cảm biến thủy văn | QCVN Standards |

---

## ⚡ Quick Start

```bash
git clone https://github.com/vanhoangtvu/mekongSL.git Mekong
cd Mekong
./manage.sh
```

```text
┌─────────────────────────────────────┐
│         MEKONG MANAGEMENT           │
│                                     │
│   [1] Start Backend    :8084        │
│   [2] Start Frontend   :3004        │
│   [3] Restart All                   │
│   [4] Stop All                      │
│   [5] View Logs                     │
│                                     │
└─────────────────────────────────────┘
```

---

## 🏗️ Stack

<details open>
<summary><b>🖥️ Frontend</b> <sub>Next.js 15 · React 19 · TypeScript 5.8</sub></summary>

```bash
cd frontend && npm install && npm run dev    # port 3004
```

> `OpenLayers 10.9` `Recharts` `geotiff.js` `XLSX` `Proj4` `geotiff`

| Chức năng | Mô tả |
|-----------|-------|
| 🗺️ MapStage | Bản đồ trung tâm, 8 base layers, UTM 48N |
| 🕐 Timeline | Điều khiển thời gian giờ/ngày/tháng/năm |
| 🎬 Timelapse | Phát lại dữ liệu raster theo khung giờ |
| 📍 Inspector | Click xem giá trị pixel GeoTIFF |
| 🌡️ Weather | Popup Ecowitt + sparkline charts |
| 💧 WQ Overlay | Trạm chất lượng nước + QCVN |
| 🌿 Landuse | Thống kê phân loại sử dụng đất |
| 🔍 Sidebar | Tìm kiếm dataset tree 3 cấp |
| 📱 Mobile | Responsive, bottom sheet |

</details>

<details>
<summary><b>⚙️ Backend</b> <sub>Spring Boot 4.0 · Java 17 · MySQL 8.0</sub></summary>

```bash
cd backend && ./mvnw spring-boot:run          # port 8084
```

> `Spring Security` `JWT` `JPA/Hibernate` `Apache POI` `Lombok`

| Module | Endpoints |
|--------|-----------|
| 🔐 Auth | `/api/auth/login` `/register` |
| 👥 Users | `/api/admin/users` CRUD |
| 📰 Articles | `/api/articles` Blog & News |
| ☁️ S3 | Upload / Download / List / Delete / Copy / Rename / Folder / Signed URL / Render / Stats |
| 🗺️ Layers | `/api/gis/layers` Search: bbox, province, station, tag, time |
| 📂 Datasets | `/api/gis/datasets` CRUD |
| 📍 Stations | `/api/gis/stations` `/manual-stations` |
| 💧 WQ | `/api/gis/water-quality` Import Excel, Samples |
| 📊 Monitoring | `/api/gis/monitoring-data` |
| 🏷️ Tags | `/api/gis/tags` CRUD + Link |
| 💾 Backup | `/api/backup` Trigger |

</details>

<details>
<summary><b>📡 Datacenter</b> <sub>Node.js ESM · MySQL2 · Cron</sub></summary>

```bash
cd datacenter && npm install && node cron-wrapper.mjs
```

| Nguồn | Tần suất | Dữ liệu | Bảng |
|-------|----------|---------|------|
| 🌤️ Ecowitt | 15 phút | Nhiệt độ, ẩm, gió, mưa, UV, bức xạ | `ecowitt` |
| 🌊 Mekong | 5x/ngày | Salinity, PH, WaterLevel, Alkalinity | `mekong_sensor` `mekong_measurement` |

</details>

---

## 🔐 Phân quyền

```text
USER ──────────────> Xem bản đồ · Articles · Download S3 · WQ Data
  │
  └── DATA_MANAGER ─> Upload/Delete S3 · GIS CRUD · Import Data
        │
        └── ADMIN ──> Users · Backup · Full Access
```

---

## 📁 Cấu trúc

```text
Mekong/
├── manage.sh                   # CLI quản lý toàn hệ thống
├── frontend/                   # Next.js 15 App Router
│   └── src/
│       ├── app/                # Pages (public, dashboard)
│       ├── features/map/       # MapStage, Timeline, Sidebar
│       ├── components/         # UI components
│       ├── hooks/              # Custom hooks
│       └── lib/                # Auth, API, Constants
├── backend/                    # Spring Boot 4.0
│   └── src/main/java/.../
│       ├── config/             # Security, S3, DataInit
│       ├── controller/         # REST API + GIS controllers
│       ├── service/            # Business logic + GIS services
│       ├── entity/             # JPA entities + GIS entities
│       └── repository/         # Spring Data repos
├── datacenter/                 # Data Pipeline
│   ├── ecowitt/                # Ecowitt weather fetch
│   ├── mekong/                 # Mekong sensor fetch
│   ├── lib/                    # Shared persistence
│   └── config/                 # Cron schedule
└── docs/                       # Tài liệu
```

---

## 📖 Tài liệu

| 📄 | |
|----|---|
| [DEPLOY.md](DEPLOY.md) | **Hướng dẫn triển khai chi tiết (quan trọng!)** |
| [deployment.md](docs/deployment.md) | Hướng dẫn triển khai (cũ) |
| [performance-improvement-plan.md](docs/performance-improvement-plan.md) | Kế hoạch cải thiện hiệu năng |
| [landuse-planning-optimization.md](docs/landuse-planning-optimization.md) | Tối ưu vector Landuse Planning |
| [titiler-migration-plan.md](docs/titiler-migration-plan.md) | Kế hoạch triển khai TiTiler |
| [api-auth.md](docs/api-auth.md) | Xác thực & JWT |
| [roles.md](docs/roles.md) | Bảng phân quyền chi tiết |
| [s3-storage.md](docs/s3-storage.md) | S3 Storage API |
| [backup-strategy.md](docs/backup-strategy.md) | Chiến lược sao lưu |
| [security.md](docs/security.md) | Bảo mật hệ thống |
| [security-report.md](docs/security-report.md) | Báo cáo đánh giá bảo mật |
| [data-upload.md](docs/data-upload.md) | Spec upload dữ liệu |
| [mekong-data-import.md](docs/mekong-data-import.md) | Import dữ liệu Mekong |
| [monthly-excel-structure.md](datacenter/docs/monthly-excel-structure.md) | Cấu trúc Excel tháng |

---

<br>
<div align="center">

<sub>Developed with ❤️ by **hoangtvu** · [github.com/vanhoangtvu](https://github.com/vanhoangtvu)</sub>

<sub>© 2026 Mekong WebGIS</sub>

</div>
