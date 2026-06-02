# Upload Data Page Specification

## 1. Mục tiêu

Trang Upload Data cho phép người dùng tải dữ liệu lên hệ thống lưu trữ tập trung của WebGIS.

Hệ thống quản lý 3 nhóm dữ liệu chính:

* GIS Data
* Station Data
* Monitoring Data

Người dùng không được phép tự nhập đường dẫn lưu trữ.

Backend sẽ tự động sinh đường dẫn S3 dựa trên metadata người dùng chọn.

---

# 2. UI Layout

## Page Structure

```text
---------------------------------------------------
| Upload Data                                      |
---------------------------------------------------

[Data Group]

(Dynamic Form)

[Description]

[Upload File]

[Upload Button]
---------------------------------------------------
```

---

# 3. Data Group

Control:

```text
Dropdown
```

Options:

```text
GIS Data
Station Data
Monitoring Data
```

Khi thay đổi Data Group, form bên dưới sẽ thay đổi tương ứng.

---

# 4. GIS Data Upload Form

## Fields

| Field       | Type       | Required |
| ----------- | ---------- | -------- |
| Dataset     | Select     | Yes      |
| Category    | Select     | Yes      |
| Year        | Select     | Yes      |
| Month       | Select     | Optional |
| Day         | Select     | Optional |
| Time        | TimePicker | Optional |
| Data Type   | Select     | Yes      |
| Description | TextArea   | No       |
| File        | Upload     | Yes      |

---

## Dataset Tree

### Landsat Imagery

```text
Dry Season
Wet Season
```

### Administration

```text
Province
Community
Hamlet
```

### Flooding Modeling

```text
Flooding Modeling
```

### Hydrology

```text
Salinity Monitoring
Water Temperature Monitoring
PH Monitoring
```

### Water Quality

```text
Surface Water
Ground Water
```

### Ecology

```text
Biodiversity
Vegetation Index
Habitat Mapping
Species Distribution
```

### Baseline Environment

```text
Landuse Planning
Soil Type
Water Body
Channel System
Ground Water Storage
Road
Landuse Classification
Mangroves
Salinity Intrusion
```

---

## Data Type

Options:

```text
Raster
Vector
```

---

## File Validation

### Raster

Allowed:

```text
.tif
.tiff
.cog
.png
.jpg
.jpeg
```

### Vector

Allowed:

```text
.geojson
.shp
.kml
.gpkg
.zip
```

---

# 5. Station Data Upload Form

## Fields

| Field       | Type       | Required |
| ----------- | ---------- | -------- |
| Station     | Select     | Yes      |
| Parameter   | Select     | Yes      |
| Date        | DatePicker | Yes      |
| Time        | TimePicker | Yes      |
| Description | TextArea   | No       |
| CSV File    | Upload     | Yes      |

---

## Parameter Examples

```text
pH
Salinity
Temperature
DO
Water Level
Flow
```

---

## File Validation

Only:

```text
.csv
```

---

# 6. Monitoring Data Upload Form

## Fields

| Field              | Type       | Required |
| ------------------ | ---------- | -------- |
| Monitoring Station | Select     | Yes      |
| Parameter          | Select     | Yes      |
| Date               | DatePicker | Yes      |
| Time               | TimePicker | Yes      |
| Description        | TextArea   | No       |
| CSV File           | Upload     | Yes      |

---

## Parameter Examples

```text
Salinity
Temperature
pH
Water Level
```

---

# 7. Upload Component

Features:

* Drag & Drop
* Browse File
* Multiple File Upload
* Upload Progress
* Cancel Upload
* Retry Upload

---

## Upload Status

```text
Uploading...
Completed
Failed
Cancelled
```

---

# 8. Metadata Preview

Hiển thị metadata trước khi upload.

Example:

```json
{
  "dataGroup": "GIS_DATA",
  "dataset": "HYDROLOGY",
  "category": "SALINITY_MONITORING",
  "year": 2026,
  "month": 5,
  "day": 30,
  "time": "12:00",
  "fileType": "RASTER"
}
```

---

# 9. Backend Generated Storage Path

Người dùng không nhìn thấy phần này.

Ví dụ:

## GIS Data

```text
gis-data/hydrology/salinity-monitoring/2026/05/30/12-00/raster/file.tif
```

## Station Data

```text
station-data/station-001/salinity/2026/05/30/12-00/data.csv
```

## Monitoring Data

```text
monitoring-data/monitor-001/salinity/2026/05/30/12-00/data.csv
```

---

# 10. User Experience Requirements

## Required

* Responsive Design
* Dark Mode Support
* Upload Progress Bar
* Validation Before Upload
* Drag & Drop Upload
* File Size Display
* Upload Success Notification
* Upload Error Notification

---

# 11. Recommended Tech Stack

Frontend:

```text
Next.js
TypeScript
TailwindCSS
Shadcn/UI
React Hook Form
Zod
TanStack Query
```

Upload:

```text
S3 Presigned URL
Multipart Upload
```

Backend:

```text
Spring Boot
PostgreSQL
MinIO / S3 Storage
```
