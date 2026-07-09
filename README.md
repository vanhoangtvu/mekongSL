<div align="center">

# 🗺️ Mekong WebGIS

*Hệ thống WebGIS giám sát khí tượng thủy văn & môi trường Đồng bằng sông Cửu Long*

[![Java](https://img.shields.io/badge/Java-17-ED8B00?style=flat&logo=openjdk)](https://adoptium.net/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.0.6-6DB33F?style=flat&logo=springboot)](https://spring.io/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![OpenLayers](https://img.shields.io/badge/OpenLayers-10.9-1F6B75?style=flat&logo=openlayers)](https://openlayers.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat&logo=mysql)](https://www.mysql.com/)

</div>

---

## ✨ Tổng quan

Mekong WebGIS là nền tảng giám sát và trực quan hóa dữ liệu không gian địa lý cho khu vực Đồng bằng sông Cửu Long. Hệ thống thu thập dữ liệu thời tiết, thủy văn, chất lượng nước từ nhiều nguồn, hiển thị trên bản đồ tương tác với khả năng phân tích theo thời gian thực.

---

## 🏗️ Kiến trúc

```
┌──────────────────────────────────────────────────────────┐
│                    Mekong WebGIS                          │
├──────────────┬───────────────────┬───────────────────────┤
│   Frontend   │     Backend       │     Datacenter        │
│  Next.js 15  │  Spring Boot 4   │    Node.js ESM        │
│  React 19    │   Java 17         │    MySQL2             │
│  OpenLayers  │   JWT + Security  │    Cron Scheduler     │
│  TypeScript  │   S3 AWS SDK      │    CSV Export         │
├──────────────┴───────────────────┴───────────────────────┤
│              MySQL 8.0  +  S3 Storage                    │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
git clone https://github.com/vanhoangtvu/mekongSL.git
cd Mekong
./manage.sh          # Giao diện quản lý tích hợp
```

---

## 📦 Cấu trúc

```
Mekong/
├── manage.sh                  # CLI quản lý start/stop/restart/logs
├── frontend/                  # Ứng dụng Next.js (port 3004)
├── backend/                   # API Spring Boot (port 8084)
├── datacenter/                # Pipeline thu thập dữ liệu
├── docs/                      # Tài liệu chi tiết
└── data/                      # Output data (gitignored)
```

---

## 🎯 Tính năng

| Module | Mô tả |
|--------|------|
| 🗺️ **Bản đồ** | 8 base layers, UTM 48N, timeline/timelapse raster |
| 📊 **Biểu đồ** | Ecowitt weather charts, landuse statistics |
| 🔍 **Tìm kiếm** | Geo-search sidebar, dataset tree 3 cấp, bbox filter |
| 💧 **Chất lượng nước** | Import Excel, overlay station, QCVN standards |
| 📡 **Weather Station** | Realtime Ecowitt popup với sparkline charts |
| 🔐 **Phân quyền** | 3 roles: USER / DATA_MANAGER / ADMIN |
| 📰 **Tin tức** | Article CRUD, public blog |
| ☁️ **S3 Storage** | Upload/Download/Render GeoTIFF, folder management |
| 📱 **Responsive** | Mobile-first, dark mode, drag & drop |

---

## 🛠️ Công nghệ

<details open>
<summary><b>Frontend</b></summary>

```bash
cd frontend && npm install && npm run dev   # port 3004
```

- Next.js 15 App Router
- React 19 + TypeScript 5.8
- OpenLayers 10.9 (WebGIS)
- Recharts + XLSX + Proj4
- geotiff.js (GeoTIFF parsing)

</details>

<details>
<summary><b>Backend</b></summary>

```bash
cd backend && ./mvnw spring-boot:run       # port 8084
```

- Spring Boot 4.0.6 + Java 17
- Spring Security + JWT (jjwt 0.12.3)
- Spring Data JPA + Hibernate
- AWS SDK v2 (S3)
- Apache POI (Excel)
- Lombok + Swagger UI

</details>

<details>
<summary><b>Datacenter</b></summary>

```bash
cd datacenter && npm install && node cron-wrapper.mjs
```

- Ecowitt API — mỗi 15 phút
- Mekong API — 5 lần/ngày
- Auto MySQL upsert + CSV snapshot

</details>

---

## 🔐 Roles

| Role | Quyền |
|------|-------|
| **USER** | Xem bản đồ, articles, download S3, water-quality |
| **DATA_MANAGER** | Upload/delete S3, GIS CRUD, station & data management |
| **ADMIN** | Toàn quyền: users, articles, backup, tất cả endpoint |

---

## 📚 Tài liệu

| File | Nội dung |
|------|----------|
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hướng dẫn triển khai |
| [API-AUTH.md](docs/API-AUTH.md) | Xác thực & phân quyền API |
| [ROLES.md](docs/ROLES.md) | Chi tiết bảng phân quyền |
| [S3-STORAGE.md](docs/S3-STORAGE.md) | API lưu trữ S3 |
| [BACKUP-STRATEGY.md](docs/BACKUP-STRATEGY.md) | Chiến lược sao lưu |
| [SECURITY.md](docs/SECURITY.md) | Bảo mật hệ thống |

---

<div align="center">

**Developed by [@vanhoangtvu](https://github.com/vanhoangtvu)**

</div>
