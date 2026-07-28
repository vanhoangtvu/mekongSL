# MSL WebGIS Technical Handover Package

**Proposed Title:** Digital Technical Handover Package  
**Vietnamese Title:** Gói kỹ thuật số bàn giao hệ thống WebGIS Mekong Salt Lab  
**Folder Name:** `MSL_WebGIS_Technical_Handover_Package`  
**Version:** 1.0 | **Updated:** 25/07/2026

---

## Table of Contents

- [Introduction](#introduction)
- [Package Structure](#package-structure)
  - [01_Source_Code](#01_source_code)
  - [02_Database_Backup](#02_database_backup)
  - [03_GIS_Data](#03_gis_data)
  - [04_Monitoring_Data](#04_monitoring_data)
  - [05_Images_and_Documents](#05_images_and_documents)
  - [06_System_Configuration](#06_system_configuration)
  - [07_Installation_Instructions](#07_installation_instructions)
  - [08_Backup_and_Recovery](#08_backup_and_recovery)
  - [09_Admin_Account_Handover](#09_admin_account_handover)
  - [10_Version_and_File_Manifest](#10_version_and_file_manifest)
- [System Information](#system-information)
- [Contact](#contact)

---

## Introduction

The Digital Technical Handover Package is a comprehensive collection of all source code, data, documentation, and configuration of the MekongSaltLab WebGIS system. This package has been assembled for the purpose of handing over the system to the receiving party for operational maintenance and post-project support.

The handover package includes **10 main directories**, each containing a specific component of the system.

---

## Package Structure

```
MSL_WebGIS_Technical_Handover_Package/
│
├── 01_Source_Code/                  # Complete system source code
├── 02_Database_Backup/              # Database backup files
├── 03_GIS_Data/                     # GIS data (raster & vector)
├── 04_Monitoring_Data/              # Environmental monitoring data
├── 05_Images_and_Documents/         # Field photos and documentation
├── 06_System_Configuration/         # System configuration files
├── 07_Installation_Instructions/    # Installation guides
├── 08_Backup_and_Recovery/          # Backup and recovery procedures
├── 09_Admin_Account_Handover/       # Administrator account information
└── 10_Version_and_File_Manifest/    # Version info and file manifest
```

---

### 01_Source_Code

**Complete System Source Code**

This directory contains the complete source code of the MekongSaltLab system, including both Frontend and Backend.

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | Next.js 15 + React 19 + TypeScript 5.8 | User interface, OpenLayers 10.9 map |
| **Backend** | Java 17 + Spring Boot 4.0.6 | RESTful API, data processing |
| **Database Scripts** | MySQL 8.0 + Flyway | Migration scripts (V001-V005) |
| **GIS Scripts** | Python + GDAL | COG conversion, raster optimization |

**Directory Structure:**

| Path | Description |
|------|-------------|
| `frontend/` | Frontend source code (Next.js) |
| `frontend/src/app/` | Pages and routes |
| `frontend/src/components/` | Reusable React components |
| `frontend/src/features/` | Feature modules (map, admin, news...) |
| `frontend/src/lib/` | Libraries and utilities |
| `backend/` | Backend source code (Spring Boot) |
| `backend/src/main/java/` | Java source code |
| `backend/src/main/resources/` | Configuration (application.yaml) |
| `backend/db/mysql/` | Database migration scripts |
| `scripts/` | GIS and utility scripts |
| `docs/` | Project documentation |

**How to Clone the Source Code:**

```bash
git clone https://github.com/vanhoangtvu/mekongSL.git
cd mekongSL
```

**Statistics:**
- Total commits: 122
- Total files: 308
- Development period: 25/05/2026 → 20/07/2026 (56 days)

---

### 02_Database_Backup

**Database Backup Files**

This directory contains MySQL database backup files generated automatically on a daily basis.

| Information | Value |
|-------------|-------|
| **DBMS** | MySQL 8.0 |
| **Database Name** | `mekong` |
| **Backup Mechanism** | Daily automatic at 00:00 + manual via Trigger Backup |
| **File Format** | `.sql.gz` (GZip compressed SQL dump) |
| **Storage Location** | S3 bucket, prefix `backup/` |
| **Size** | Depends on data volume (typically 5-50 MB) |

**Sample Backup Filenames:**
```
backup/mekong-20260725_000000.sql.gz
backup/mekong-20260726_000000.sql.gz
backup/mekong-20260727_000000.sql.gz
```

**Main Database Tables:**

| Table | Description | Estimated Rows |
|-------|-------------|:--------------:|
| `users` | User accounts | 5-10 |
| `articles` | News articles | 10-20 |
| `gis_layers` | GIS data layers | 10-15 |
| `gis_datasets` | GIS datasets | 50-60 |
| `manual_stations` | Manual monitoring stations | 20-25 |
| `water_quality_samples` | Water quality samples | 100-500 |
| `ecowitt_data` | Ecowitt weather data | 10,000+ |
| `mekong_sensor_data` | Mekong sensor data | 10,000+ |
| `landuse_statistics` | Land use statistics | 50-100 |

---

### 03_GIS_Data

**GIS Data (Raster & Vector)**

This directory contains all geospatial data imported and optimized on the system.

**Overview Statistics:**

| Data Type | Files | Size | Notes |
|-----------|:-----:|:----:|-------|
| Hydrology - Salinity | 286 | 8.5 MB | Real-time salinity data |
| Hydrology - pH | 282 | 8.5 MB | Real-time pH data |
| Hydrology - Tidal | 270 | 8.2 MB | Real-time tidal data |
| Landsat Band 1-7 | 84 | 135 MB (COG) | Optimized from 546 MB |
| Landuse Classification | 35 | 10 MB (COG) | Optimized from 227 MB |
| Landuse Planning | 3 | 18.4 MB | DXF to GeoJSON (9 districts) |
| Channel System | 16 | 6.6 MB | Canal network system |
| Administration | 6 | 0.5 MB | Administrative boundaries |
| Flooding Modeling | 2 | 13.0 MB | Flood simulation model |
| **Total** | **1,126** | **765 MB** | |

**S3 Directory Structure:**

| Path | Content |
|------|---------|
| `gis-data/landsat/band1/` to `band7/` | Individual Landsat bands |
| `gis-data/landsat/composite/` | RGB composite (pending) |
| `gis-data/administration/province/` | Province boundary |
| `gis-data/administration/commune/` | Commune boundaries |
| `gis-data/administration/hamlet/` | Hamlet boundaries |
| `gis-data/baseline/landuse-planning/` | Land use planning (9 districts) |
| `gis-data/baseline/soil-type/` | Soil type map |
| `gis-data/baseline/channel/` | Canal network system |
| `gis-data/baseline/ground-water/` | Groundwater data |
| `gis-data/baseline/road/` | Road network |
| `gis-data/baseline/landuse-classification/` | Land use classification (7 types) |
| `gis-data/ecology/` | Ecology data |
| `gis-data/flooding/` | Flood simulation data |
| `gis-data/hydrology/salinity/` | Salinity data |
| `gis-data/hydrology/ph/` | pH data |
| `gis-data/hydrology/tidal/` | Tidal data |

**Coordinate Systems:**
- Raster: EPSG:32648 (UTM zone 48N)
- Vector: EPSG:32648 (UTM zone 48N)
- Measurement points (Weather, WQ): EPSG:4326 (WGS84)

**COG Optimization:**
119 GeoTIFF files converted to Cloud Optimized GeoTIFF (COG):
- Tile size: 256x256
- Compression: DEFLATE
- Overviews: Yes
- Size reduction: 81% (from 773 MB to 145 MB)

---

### 04_Monitoring_Data

**Environmental Monitoring Data**

This directory contains data from automatic and manual monitoring stations.

**Ecowitt Weather Data:**

| Parameters | Frequency | Source |
|------------|:---------:|--------|
| Temperature, humidity, wind speed, wind direction, rainfall, pressure, solar radiation, UV index | Every 15 minutes | Ecowitt API |

**Ecowitt Stations:** 3 stations (EW-TV-01, EW-TV-02, EW-TV-03)

**Mekong API Hydrological Data:**

| Parameters | Frequency | Source |
|------------|:---------:|--------|
| Salinity, pH, water level, alkalinity | 5 times/day (00:00, 05:00, 10:00, 15:00, 20:00) | Rynan Mobile API |

**Manual Water Quality Data:**

| Type | Stations | Parameters |
|:----:|:--------:|------------|
| Surface Water | 16 | pH, EC, Salinity, DO, TDS, Turbidity, NH4+, NO3-... |
| Ground Water | 4 | pH, EC, Salinity, DO, TDS... |

**S3 Storage Structure:**

| Path | Content |
|------|---------|
| `station-data/manual-stations/` | Manual station field photos |
| `station-data/{stationCode}/...` | Manual station CSV data |
| `monitoring-data/{stationCode}/...` | Automatic station CSV data |

---

### 05_Images_and_Documents

**Field Photos and Documentation**

This directory contains field photos from monitoring stations and all project documentation.

**Field Photos:**
- Stored on S3: `station-data/manual-stations/`
- Format: JPEG
- Access: Public
- Quantity: As per configured stations

**Project Documentation (docs/):**

| File | Description |
|------|-------------|
| `README.md` | Project overview |
| `DEPLOY.md` | Deployment guide |
| `huong-dan-su-dung-nguoi-dung.md` | User guide (table of contents) |
| `huong-dan-su-dung-nguoi-dung-role-USER.md` | USER role guide |
| `huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md` | DATA_MANAGER role guide |
| `huong-dan-su-dung-nguoi-dung-role-ADMIN.md` | ADMIN role guide |
| `project-report.md` | Project report (Hoang) |
| `project-report-duy.md` | Project report (Duy) |
| `MSL_WebGIS_User_and_Administration_Manual.md` | User & admin manual (Product 2) |
| `MSL_WebGIS_User_and_Administration_Manual_EN.md` | User & admin manual (English) |
| `MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx` | Data catalogue (Product 3) |
| `MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx` | Testing dossier (Product 4) |
| `MSL_WebGIS_Technical_Handover_Package.md` | Handover package (Product 5) |
| `api-auth.md` | API authentication |
| `backup-strategy.md` | Backup strategy |
| `data-upload.md` | Data upload guide |
| `deployment.md` | System deployment |
| `roles.md` | Role permissions |
| `s3-storage.md` | S3 storage guide |
| `security.md` | Security documentation |
| `mekong-data-import.md` | Mekong data import |

**Screenshots (to be added):**

```
docs/images/
├── screenshot-map-main.png
├── screenshot-timeline.png
├── screenshot-inspector.png
├── screenshot-wq-popup.png
├── screenshot-weather-popup.png
├── screenshot-landuse-classification.png
├── screenshot-landuse-planning.png
├── screenshot-s3-explorer.png
├── screenshot-admin.png
```

---

### 06_System_Configuration

**System Configuration Files**

This directory contains critical system configuration files.

**Backend Configuration (`application.yaml`):**

| Parameter | Description | Notes |
|-----------|-------------|-------|
| `spring.datasource.url` | MySQL connection | `jdbc:mysql://localhost:3306/mekong` |
| `spring.datasource.username` | MySQL username | `root` |
| `spring.datasource.password` | MySQL password | Change on deployment |
| `jwt.secret` | JWT secret key | Change for production deployment |
| `jwt.expiration` | Token validity period | Default: 24h |
| `s3.endpoint` | S3 endpoint | `https://backup.hci.vn` |
| `s3.accessKey` | S3 access key | Configurable in `.env` |
| `s3.secretKey` | S3 secret key | Configurable in `.env` |
| `s3.bucket` | Bucket name | Environment variable |
| `cors.allowedOrigins` | Allowed origins | IP/domain list |

**Frontend Configuration (`.env.local`):**

| Parameter | Description |
|-----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_S3_ENDPOINT` | S3 endpoint |
| `NEXT_PUBLIC_MAP_CENTER` | Map center coordinates |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | Default zoom level |

**System Management Script (`manage.sh`):**

Centralized management script with menu options:
1. Start Backend
2. Start Frontend
3. Stop Backend
4. Stop Frontend
5. View Status
6. Build Backend
7. Build Frontend
8. Restart all services
9. Change IP
10. View logs

---

### 07_Installation_Instructions

**Installation Guide**

This directory contains detailed instructions for installing and deploying the system from scratch.

**System Requirements:**

| Component | Requirement |
|-----------|-------------|
| **Operating System** | Linux (Ubuntu 20.04+/CentOS 7+) |
| **CPU** | Minimum 2 cores |
| **RAM** | Minimum 4 GB |
| **Storage** | Minimum 20 GB |
| **Java** | JDK 17 |
| **Node.js** | 18.x or later |
| **MySQL** | 8.0 or later |
| **Python** | 3.8 or later (for GDAL) |
| **Nginx** | Optional (for HTTPS) |

**Installation Overview:**

1. **Environment Setup:**
   ```bash
   # Install Java 17
   apt-get install openjdk-17-jdk
   
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt-get install nodejs
   
   # Install MySQL 8
   apt-get install mysql-server-8.0
   
   # Install Python + GDAL
   apt-get install python3-pip gdal-bin
   ```

2. **Clone Source Code:**
   ```bash
   git clone https://github.com/vanhoangtvu/mekongSL.git
   cd mekongSL
   ```

3. **Configure Backend:**
   - Copy `.env.example` to `.env`
   - Fill in S3 and database information
   - Build: `cd backend && ./mvnw clean package -DskipTests`

4. **Configure Frontend:**
   - Copy `.env.example` to `.env.local`
   - Set `NEXT_PUBLIC_API_URL`
   - Build: `cd frontend && npm install && npm run build`

5. **Start the System:**
   ```bash
   ./manage.sh
   ```
   Select menu 1 (Start Backend) and 2 (Start Frontend)

6. **Configure Nginx (for HTTPS):**
   ```nginx
   server {
       listen 443 ssl;
       server_name mekongsaltlab.org;
       
       ssl_certificate /etc/letsencrypt/live/mekongsaltlab.org/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/mekongsaltlab.org/privkey.pem;
       
       location / {
           proxy_pass http://localhost:3004;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api/ {
           proxy_pass http://localhost:8084;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

---

### 08_Backup_and_Recovery

**Backup and Recovery Procedures**

This directory contains documentation and scripts related to system backup and recovery.

**Automatic Backup:**

| Parameter | Value |
|-----------|-------|
| **Mechanism** | Spring `@Scheduled` in `BackupService.java` |
| **Schedule** | Every day at 00:00 |
| **Content** | Full MySQL database |
| **Format** | `backup/mekong-{yyyyMMdd}_{HHmmss}.sql.gz` |
| **Storage** | S3 bucket, prefix `backup/` |

**Manual Backup:**
1. Log in with an ADMIN account
2. Go to the **Overview** tab
3. Click the **Trigger Backup** button

**Data Restoration:**
```bash
# Step 1: Download backup file from S3
# (download via Storage tab or use AWS CLI)

# Step 2: Decompress
gunzip backup/mekong-20260725_000000.sql.gz

# Step 3: Import into MySQL
mysql -u root -p mekong < mekong-20260725_000000.sql
```

**Maintenance Schedule:**

| Task | Frequency | Description |
|------|:---------:|-------------|
| Check backups | Daily | Verify backup files are created |
| Remove old backups | Monthly | Keep only the last 30 days |
| Download backups | Weekly | Offline backup |
| Test restoration | Quarterly | Practice restoration on test environment |

---

### 09_Admin_Account_Handover

**Administrator Account Information**

This directory contains system administrator account information. **Note: This document must be kept strictly confidential.**

**Default Accounts:**

| Role | Username | Password | Description |
|------|----------|----------|-------------|
| **ADMIN** | `admin` | `admin123` | Full system administrator |
| **DATA_MANAGER** | `manager` | `manager123` | Data manager |
| **USER** | `user` | `user123` | Regular user |

> **Important:** Change passwords immediately upon handover!

**System Accounts:**

| System | URL | Username | Notes |
|--------|-----|----------|-------|
| **Server SSH** | `123.22.61.134` | Provided separately | Server access |
| **MySQL** | `localhost:3306` | `root` | Database `mekong` |
| **S3 Storage** | `backup.hci.vn` | Provided separately | S3-compatible storage |
| **GitHub** | `github.com/vanhoangtvu/mekongSL` | Provided separately | Source code |
| **Ecowitt API** | `api.ecowitt.net` | Provided separately | Weather data |
| **Mekong API** | Rynan Mobile API | Provided separately | Hydrological data |
| **Domain** | `mekongsaltlab.org` | Provided separately | Domain name |

**Handover Checklist:**
- [ ] Server access (SSH key / password)
- [ ] MySQL admin access (root)
- [ ] S3 access (access key + secret key)
- [ ] GitHub repository access
- [ ] Domain management access
- [ ] API keys (Ecowitt, Mekong)
- [ ] SSL/TLS certificates

---

### 10_Version_and_File_Manifest

**Version Information and File Manifest**

This directory contains system version information and a complete file manifest for the handover package.

**Version Information:**

| Component | Version |
|-----------|:-------:|
| **System** | 1.0.0 |
| **Frontend** | 1.0.0 |
| **Backend** | 1.0.0 |
| **Database Schema** | V005 |
| **API** | v1 |

**File Manifest - Packages and Libraries:**

**Frontend (package.json):**

| Package | Version | Purpose |
|---------|:-------:|---------|
| next | 15 | React framework |
| react | 19 | UI library |
| typescript | 5.8 | Static typing |
| ol (OpenLayers) | 10.9 | Interactive map |
| recharts | 3.8 | Charts |
| xlsx | 0.18.5 | Excel processing |
| axios | 1.x | HTTP client |
| tailwindcss | 4.x | CSS framework |

**Backend (pom.xml):**

| Package | Version | Purpose |
|---------|:-------:|---------|
| Spring Boot | 4.0.6 | Framework |
| Spring Security | 6.x | Authentication + authorization |
| JPA / Hibernate | 7.x | ORM |
| jjwt (JWT) | 0.12.3 | Token authentication |
| AWS SDK S3 | 2.20.26 | S3 client |
| Apache POI | 5.2.5 | Excel processing |
| Lombok | 1.x | Boilerplate code |
| Flyway | 9.x | Database migration |

**Database:** MySQL 8.0, 18+ tables

---

## System Information

| Information | Value |
|-------------|-------|
| **Project Name** | MekongSaltLab |
| **Description** | Geospatial data monitoring and visualization platform for the Mekong Delta |
| **Frontend URL** | `https://mekongsaltlab.org` |
| **Backend API URL** | `http://103.54.251.212:8084` |
| **Swagger** | `https://mekongsaltlab.org/swagger-ui/` |
| **Server IP** | `123.22.61.134` |
| **Development Team** | Nguyen Van Hoang & Nguyen Le Duy |
| **Start Date** | 01/05/2026 |
| **End Date** | 31/07/2026 |

---

## Contact

| Member | Role | Email |
|--------|------|-------|
| Nguyen Van Hoang | WebGIS Developer | Via About page |
| Nguyen Le Duy | WebGIS Developer | Via About page |

---

*Copyright 2026 MekongSaltLab. Digital Technical Handover Package – Version 1.0.*  
*Document drafted by Hoang and Duy.*
