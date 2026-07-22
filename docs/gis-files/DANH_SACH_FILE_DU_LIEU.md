# Danh sách file dữ liệu GIS - Mekongsaltlab

> Thư mục này chứa các file dữ liệu GIS thuộc tính của dự án Mekongsaltlab.
> Toàn bộ dữ liệu gốc (1.126 files, 765 MB) được lưu trữ trên S3 tại `backup.hci.vn`.

---

## Cấu trúc thư mục

```
docs/gis-files/
├── 📐 1-ban-do-goc-DXF/            (4 file - bản vẽ CAD gốc)
├── 📊 2-ban-do-chuyen-doi-GEOJSON/  (4 file - dữ liệu vector đã chuyển đổi)
├── 🏗️ 3-he-thong-kenh-rach/        (7 file - thuộc tính hạ tầng)
└── 🗺️ 4-dia-gioi-hanh-chinh/       (3 file - thuộc tính ranh giới)
```

---

### 📐 1-ban-do-goc-DXF/ — Bản vẽ CAD gốc

| STT | Tên file | Dung lượng | Mô tả |
|:---:|----------|:----------:|-------|
| 1 | `soil map 2015 dxf.dxf` | 435 KB | Bản đồ đất Trà Vinh 2015 |
| 2 | `BDHT_HUYENCANGLONG.dxf` | 47 MB | Bản đồ địa chính huyện Càng Long |
| 3 | `BDQH_hchauthanh.dxf` | 33 MB | Bản đồ quy hoạch huyện Châu Thành |
| 4 | `1 BDKH 2025_TP TRA VINH - LAN 4 IN LAI.dxf` | 43 MB | Bản đồ biến đổi khí hậu TP Trà Vinh 2025 |

### 📊 2-ban-do-chuyen-doi-GEOJSON/ — Dữ liệu bản đồ đã chuyển đổi

| STT | Tên file | Dung lượng | Mô tả |
|:---:|----------|:----------:|-------|
| 1 | `soil_map_2015.geojson` | 424 KB | Bản đồ đất Trà Vinh 2015 (từ DXF) |
| 2 | `canglong_display.geojson` | 4.3 MB | Quy hoạch sử dụng đất huyện Càng Long |
| 3 | `dxf_display.geojson` | 11 MB | Quy hoạch sử dụng đất huyện Châu Thành |
| 4 | `travinhcity_display.geojson` | 3.5 MB | Quy hoạch sử dụng đất TP Trà Vinh |

### 🏗️ 3-he-thong-kenh-rach/ — Thuộc tính hạ tầng kênh rạch

| STT | Tên file | Dung lượng | Mô tả |
|:---:|----------|:----------:|-------|
| 1 | `cau.vdc` | 761 B | Cầu |
| 2 | `kenh_rach_noi_dong.vdc` | 789 B | Kênh rạch nội đồng |
| 3 | `kenh_cap_1.vdc` | 763 B | Kênh cấp 1 |
| 4 | `de_bao.vdc` | 777 B | Đê bao |
| 5 | `cong_thuy_loi.vdc` | 773 B | Cống thủy lợi |
| 6 | `KDC.vdc` | 764 B | Khu dân cư |
| 7 | `giaothong.dbf` | 7.3 KB | Giao thông |

### 🗺️ 4-dia-gioi-hanh-chinh/ — Thuộc tính ranh giới hành chính

| STT | Tên file | Dung lượng | Mô tả |
|:---:|----------|:----------:|-------|
| 1 | `Travinh_district_line.vdc` | 730 B | Ranh giới xã |
| 2 | `Travinh_hamlet_line.vdc` | 722 B | Ranh giới ấp |
| 3 | `Tra_Vinh_province_line.vdc` | 696 B | Ranh giới tỉnh |

---

## Dữ liệu còn lại trên S3 (backup.hci.vn)

Theo báo cáo dự án, toàn bộ dữ liệu GIS đã được import lên S3 gồm:

### 1. 🌊 Hydrology - Water Quality
| Loại | Số file | Dung lượng |
|------|:-------:|:----------:|
| Salinity | 286 files | 8.5 MB |
| pH | 282 files | 8.5 MB |
| Tidal | 270 files | 8.2 MB |

### 2. 🛰️ Landsat Imagery (2014-2025)
| Band | Số file | Dung lượng |
|------|:-------:|:----------:|
| Band 1-7 (7 bands × 12 năm) | 84 files | 546 MB (gốc) → 135 MB (COG) |

### 3. 🌿 Landuse Classification
| Loại | Số file | Dung lượng |
|------|:-------:|:----------:|
| 7 class × 5 năm | 35 files | 227 MB (gốc) → 10 MB (COG) |

### 4. 📐 Landuse Planning (9 huyện Trà Vinh)
| Loại | Số file | Dung lượng |
|------|:-------:|:----------:|
| DXF → GeoJSON | 3 files | 18.4 MB |

### 5. 🚧 Channel System
| Loại | Số file | Dung lượng |
|------|:-------:|:----------:|
| DXF → GeoJSON | 16 files | 6.6 MB |

### 6. 🗺️ Administration
| Loại | Số file | Dung lượng |
|------|:-------:|:----------:|
| GeoJSON | 6 files | 0.5 MB |

### 7. 🌊 Flooding Modeling
| Loại | Số file | Dung lượng |
|------|:-------:|:----------:|
| Mô hình số | 2 files | 13.0 MB |

---

## Tổng kết

| Danh mục | Số file | Dung lượng |
|----------|:-------:|:----------:|
| File DXF (CAD gốc) | 4 | 123 MB |
| File GeoJSON (vector) | 4 | 19 MB |
| File VDC (thuộc tính) | 9 | 7 KB |
| File DBF (thuộc tính) | 1 | 7 KB |
| **Tổng file thuộc tính** | **18** | **142 MB** |
| File còn lại trên S3 | ~1.128 | ~624 MB |
| **Tổng toàn bộ** | **~1.146** | **~766 MB** |

> **Ghi chú:**
> - Đã xóa các file .vct (vector geometry) theo yêu cầu, chỉ giữ file thuộc tính (.vdc, .dbf, .dxf, .geojson)
> - Các file còn lại trên S3 (thủy văn, Landsat, landuse classification, flooding) có thể tải bằng S3 Explorer tại route `/data` hoặc chạy lại script với prefix tương ứng.
