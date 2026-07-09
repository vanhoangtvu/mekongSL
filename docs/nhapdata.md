# Upload Data Page Specification

## 1. Muc tieu

Trang Upload Data cho phep nguoi dung tai du lieu len he thong luu tru tap trung cua WebGIS.

He thong quan ly 3 nhom du lieu chinh:
- **GIS Data** (raster, vector) -> S3: `gis-data/`
- **Station Data** (CSV files) -> S3: `station-data/`
- **Monitoring Data** (CSV files) -> S3: `monitoring-data/`

Nguoi dung khong duoc phep tu nhap duong dan luu tru.
Backend se tu dong sinh duong dan S3 dua tren metadata nguoi dung chon.

---

## 2. Data Group

Dropdown options:
- GIS Data
- Station Data
- Monitoring Data

Khi thay doi Data Group, form ben duoi se thay doi tuong ung.

---

## 3. GIS Data Upload Form

| Field       | Type       | Required |
|-------------|-----------|----------|
| Dataset     | Select     | Yes      |
| Category    | Select     | Yes      |
| Year        | Select     | Yes      |
| Month       | Select     | Optional |
| Day         | Select     | Optional |
| Time        | TimePicker | Optional |
| Data Type   | Select     | Yes      |
| Description | TextArea   | No       |
| File        | Upload     | Yes      |

### Dataset Tree (based on datasets.ts)

#### Landsat Imagery
- Band 1, Band 2, Band 3, Band 4, Band 5, Band 6, Band 7
- Composite (RGB)

#### Administration
- Province, Community, Hamlet

#### Baseline Environment
- Landuse Planning
- Soil Type
- Water Body
- Channel System (River, Canal, Sluice, Pump Station, Dike & Embankments, Irrigation)
- Ground Water Storage
- Road
- Landuse Classification (Aquaculture, Rice-Shrimp, Perennial Crops, Residential Land, Coconut Garden, Vegetable Crops, Rice Cultivation)
- Salinity Intrusion

#### Ecology
- Biodiversity, Vegetation Index, Habitat Mapping, Species Distribution, Mangroves

#### Flooding Modeling
- Flooding Modeling

#### Hydrology
- Salinity (hourly)
- Tidal (hourly)
- pH (hourly)

### Data Type
- Raster
- Vector

### File Validation

**Raster:** `.tif`, `.tiff`
**Vector:** `.geojson`, `.shp`, `.kml`, `.gpkg`, `.zip`

---

## 4. Station Data Upload Form

| Field       | Type       | Required |
|-------------|-----------|----------|
| Station     | Select     | Yes      |
| Parameter   | Select     | Yes      |
| Date        | DatePicker | Yes      |
| Time        | TimePicker | Yes      |
| Description | TextArea   | No       |
| CSV File    | Upload     | Yes      |

**Parameter Examples:** pH, Salinity, Temperature, DO, Water Level, Flow
**File:** Only `.csv`

---

## 5. Monitoring Data Upload Form

| Field              | Type       | Required |
|---------------------|-----------|----------|
| Monitoring Station  | Select     | Yes      |
| Parameter           | Select     | Yes      |
| Date                | DatePicker | Yes      |
| Time                | TimePicker | Yes      |
| Description         | TextArea   | No       |
| CSV File            | Upload     | Yes      |

**Parameter Examples:** Salinity, Temperature, pH, Water Level
**File:** Only `.csv`

---

## 6. Water Quality Upload (Special)

Upload Excel file chua du lieu chat luong nuoc:

| Field      | Type       | Required |
|------------|-----------|----------|
| File       | Upload (.xlsx, .xls) | Yes |
| SampleDate | DatePicker | Yes      |
| Overwrite  | Checkbox   | No       |
| Notes      | TextArea   | No       |

Endpoint: `POST /api/gis/water-quality/preview` (preview truoc khi import)
Endpoint: `POST /api/gis/water-quality/import` (import chinh thuc)

---

## 7. Backend Generated Storage Path

### GIS Data
```
gis-data/{dataset-slug}/{category-slug}/{year}/{month}/{day}/{time}/{type}/{filename}
```
Vi du: `gis-data/hydrology/salinity/2026/05/30/12-00/raster/salinity.tif`

### Station Data
```
station-data/{stationCode}/{parameter}/{year}/{month}/{day}/{time}/{filename}
```
Vi du: `station-data/station-001/salinity/2026/05/30/12-00/data.csv`

### Monitoring Data
```
monitoring-data/{monitoringCode}/{parameter}/{year}/{month}/{day}/{time}/{filename}`
```
Vi du: `monitoring-data/monitor-001/salinity/2026/05/30/12-00/data.csv`

---

## 8. Tech Stack (Thuc te)

Frontend:
- Next.js 15 (App Router)
- React 19 + TypeScript 5.8
- OpenLayers 10.9 (ban do)
- CSS modules (inline styles)

Backend:
- Spring Boot 4.0.6 + Java 17
- MySQL 8.0 (database: `mekong`)
- S3-compatible storage (backup.hci.vn, bucket: c01-mekong-prod-01)
- AWS SDK v2 cho S3 operations

Upload:
- Multipart upload qua S3Controller
- Signed URLs cho download
- DB tracking qua `s3_object` table

---

## 9. User Experience Requirements

- Responsive Design
- Dark Mode Support (localStorage theme)
- Upload Progress Bar
- Validation Before Upload
- Drag & Drop Upload
- File Size Display
- Upload Success/Error Notification
