# MSL WebGIS Data Catalogue and Metadata Workbook

**Ten de xuat:** Ho so danh muc va mo ta du lieu  
**Ten tieng Anh:** Dataset Catalogue, Data Dictionary and Metadata Workbook  
**File Excel:** `MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx`  
**Phien ban:** 1.0 | **Cap nhat:** 25/07/2026

---

## Gioi thieu

Tai lieu nay mo ta chi tiet noi dung cua file Excel danh muc du lieu he thong MekongSaltLab. File Excel gom **9 sheet** voi day du thong tin ve tap du lieu, cau truc truong, nguon goc, tram quan trac, chi tieu chat luong nuoc, nguon du lieu, lich su cap nhat, QA/QC va han che du lieu.

---

## Sheet 1 – Dataset Catalogue (Danh muc tap du lieu)

Danh muc toan bo cac lop va bang du lieu trong he thong, bao gom **50 datasets** duoc chia thanh cac nhom:

| Danh muc | So luong | Loai |
|----------|:--------:|:----:|
| Landsat Imagery | 8 | Raster |
| Administration | 3 | Vector |
| Baseline Environment | 26 | Raster & Vector |
| Ecology | 5 | Vector |
| Flooding Modeling | 2 | Vector |
| Hydrology Environment | 3 | Raster |
| Weather | 1 | Point (API) |
| Water Quality | 2 | Point (Database) |

### Cac truong du lieu

| Truong | Mo ta |
|--------|-------|
| STT | So thu tu |
| Dataset Name | Ten tap du lieu |
| Layer Name (English) | Ten lop (tieng Anh) |
| Layer Type | Loai (RASTER/VECTOR/POINT) |
| Category | Danh muc |
| Format | Dinh dang du lieu |
| CRS | He toa do |
| S3 Path | Duong dan tren S3 |
| Description | Mo ta chi tiet |
| Year(s) | Nam du lieu |
| Status | Trang thai (Published/Pending/Realtime/Active) |

---

## Sheet 2 – Data Dictionary (Tu dien du lieu)

Giai thich **60 truong du lieu** tu cac bang co so du lieu chinh:

| Bang | So truong | Cac truong chinh |
|------|:---------:|------------------|
| Manual Stations | 9 | id, station_id, type, location, lat, lng, image_code, status, created_at |
| Water Quality Samples | 8 | id, station_id, sample_date, parameter, value, unit, qcvn, created_at |
| Users | 7 | id, username, email, password, role, enabled, created_at |
| Articles | 11 | id, title, slug, content, excerpt, category, tags, image_url, featured, published, created_at |
| GIS Layers | 5 | id, name, type, description, created_at |
| Ecowitt Weather | 9 | timestamp, temperature, humidity, wind_speed, wind_direction, rainfall, pressure, solar_radiation, uv_index |
| Mekong Sensor | 5 | timestamp, salinity, ph, water_level, alkalinity |
| Landuse Statistics | 6 | id, landuse_type, year, area_ha, percentage, pixel_count |

---

## Sheet 3 – Metadata (Sieu du lieu)

Thong tin ve **13 nguon du lieu** chinh:

| Dataset | Nguon | Nam | He toa do |
|---------|-------|:---:|:---------:|
| Landsat Imagery | USGS / EarthExplorer | 2014-2025 | EPSG:32648 |
| Administration Boundaries | GIS Website Vinh Long | 2025 | EPSG:32648 |
| Landuse Planning | AutoCAD DXF > GeoJSON | 2025 | EPSG:32648 |
| Soil Type | GIS Interpretation | 2025 | EPSG:32648 |
| Channel System | AutoCAD DXF > GeoJSON | 2025 | EPSG:32648 |
| Landuse Classification | Landsat GIS Interpretation | 2020-2025 | EPSG:32648 |
| Salinity | Mekong API (Rynan Mobile) | 2026 | EPSG:32648 |
| pH | Mekong API (Rynan Mobile) | 2026 | EPSG:32648 |
| Tidal | Mekong API (Rynan Mobile) | 2026 | EPSG:32648 |
| Weather | Ecowitt API | 2026 | EPSG:4326 |
| Water Quality (Manual) | Khao sat thuc dia | 2026 | EPSG:4326 |
| Flooding Model | Mo hinh so | 2025 | EPSG:32648 |
| Ecology Data | Khao sat thuc dia | 2025 | EPSG:32648 |

---

## Sheet 4 – Monitoring Stations (Danh sach tram)

### Manual Stations (20 tram)

Bao gom **20 tram quan trac thu cong** tren dia ban tinh Tra Vinh, trong do:

- **16 tram** surface_water (nuoc mat)
- **4 tram** groundwater (nuoc ngam)
- **1 tram** Inactive (SL-1 tam ngung)
- **19 tram** Active

Cac vi tri trai dai tu TP Tra Vinh den cac huyen: Chau Thanh, Cang Long, Cau Ke, Cau Ngang, Duyen Hai, Tieu Can, Tra Cu.

### Ecowitt Weather Stations (3 tram)

| Ma tram | Vi tri | Thong so |
|---------|--------|----------|
| EW-TV-01 | Tra Vinh City | Nhiet do, am, gio, mua, ap suat, UV |
| EW-TV-02 | Cang Long | Nhiet do, am, gio, mua, ap suat |
| EW-TV-03 | Duyen Hai | Nhiet do, am, gio, mua, ap suat, UV |

---

## Sheet 5 – Water Quality Parameters (Chi tieu chat luong nuoc)

Danh muc **15 chi tieu** chat luong nuoc theo tieu chuan QCVN 08:2023:

| Chi tieu | Don vi | Gioi han (QCVN 08:2023) |
|----------|:------:|:------------------------:|
| pH | | 5.5-9.0 |
| EC | microS/cm | 1000 |
| Salinity | ppt | 0.5 |
| TDS | mg/L | 1000 |
| DO | mg/L | >= 5.0 |
| Turbidity | NTU | 30 |
| Temperature | °C | 30 |
| NH4+ | mg/L | 0.3 |
| NO3- | mg/L | 5 |
| PO4³- | mg/L | 0.3 |
| Cl- | mg/L | 250 |
| SO4²- | mg/L | 400 |
| Fe | mg/L | 1.0 |
| Coliform | MPN/100mL | 5000 |
| E. coli | MPN/100mL | 50 |

---

## Sheet 6 – Data Sources (Nguon cung cap du lieu)

Danh sach **10 to chuc/nguon** cung cap du lieu:

| Nguon | Du lieu | Tan suat |
|-------|---------|:--------:|
| So TNMT Tra Vinh | Ban do quy hoach, hanh chinh | One-time |
| Rynan Mobile | Du lieu thuy van (Salinity, pH, Tidal) | 5 lan/ngay |
| Ecowitt | Du lieu thoi tiet | 15 phut/lan |
| USGS / EarthExplorer | Anh ve tinh Landsat 8-9 | One-time |
| MSL Project (Khao sat) | Chat luong nuoc thu cong | Hang thang |
| MSL Project (GIS) | Ban do su dung dat, kenh rach | One-time |
| OpenStreetMap | Ban do nen (base map) | Real-time |
| Esri | Anh ve tinh nen | Real-time |
| OpenTopoMap | Ban do dia hinh nen | Real-time |
| Thunderforest | Ban do giao thong nen | Real-time |

---

## Sheet 7 – Data Update Log (Lich su cap nhat)

**16 lan cap nhat** du lieu tu 25/05/2026 den 25/07/2026:

| Thoi gian | Noi dung | Nguoi thuc hien |
|-----------|----------|:---------------:|
| 25/05/2026 | Khoi tao cau truc database va S3 | Hoang |
| 02/06/2026 | Upload 84 files Landsat bands 1-7 (546 MB) | Hoang |
| 10/06/2026 | Upload 35 files phan loai SD dat (227 MB) | Duy |
| 13/06/2026 | Upload DXF > GeoJSON 9 huyen (18.4 MB) | Hoang |
| 15/06/2026 | Upload 16 files he thong kenh rach (6.6 MB) | Duy |
| 19/06/2026 | Upload du lieu man, pH, thuy trieu (25.2 MB) | Hoang |
| 20/06/2026 | Toi uu COG 119 files (773 MB > 145 MB) | Duy |
| 25/06/2026 | Import chat luong nuoc dot 1 | Duy |
| 01/07/2026 | Them 10 tram quan trac thu cong | Hoang |
| 05/07/2026 | Ket noi API Ecowitt + cron job | Duy |
| 10/07/2026 | Ket noi API Mekong + cron job | Duy |
| 15/07/2026 | Upload ranh gioi hanh chinh (0.5 MB) | Hoang |
| 20/07/2026 | Upload du lieu mo phong ngap (13 MB) | Hoang |
| 25/07/2026 | **(Dang cho)** Composite RGB chua upload | |

---

## Sheet 8 – QA/QC Log

**10 loi** da phat hien va xu ly trong qua trinh phat trien:

| Loi | Muc do | Giai phap |
|-----|:------:|-----------|
| 403 khi tai anh station | Cao | Mo public prefix station-data/, news-images/ |
| Thieu Tidal trong danh sach | Trung binh | Them pagination loop |
| File GeoTIFF cham | Trung binh | Chuyen sang COG (tiled 256x256, DEFLATE) |
| Polygon lon che nho | Thap | Sap xep theo dien tich |
| "Maximum update depth" error | Cao | Dung ref, so sanh toa do |
| Khong inspect vector tren mobile | Trung binh | Goi inspectAtPixel cho ca raster + vector |
| Loi dinh dang ngay import WQ | Trung binh | Cap nhat mau Excel chuan |
| Cron job Ecowitt khong chay | Cao | Them auto-start script |
| Landuse Compute sai dien tich | Trung binh | Hieu chinh cong thuc UTM 48N |
| CORS loi khi doi IP | Cao | Cap nhat allowedOrigins |

---

## Sheet 9 – Data Limitations (Han che du lieu)

**10 han che** va khuyen nghi su dung:

| Han che | Do uu tien | Khuyen nghi |
|---------|:----------:|-------------|
| Composite RGB chua upload | Trung binh | Upload va toi uu COG (Thang 8/2026) |
| Do chinh xac phan loai ~85% | Thap | Bo sung khao sat thuc dia |
| Du lieu WQ chua day du thang | Trung binh | Thu thap va import dinh ky |
| Thieu noi suy khong gian | Cao | Phat trien mo hinh Kriging/IDW (Thang 9/2026) |
| Tram nuoc ngam han che | Trung binh | Bo sung them tram (Thang 10/2026) |
| Mo hinh ngap chua hieu chinh | Cao | Hieu chinh voi so lieu thuc te (Thang 12/2026) |
| Du lieu sinh thai 1 dot khao sat | Thap | Khao sat bo sung 2 lan/nam |
| Chua co HTTPS | Cao | Cai Let's Encrypt + Nginx (Thang 9/2026) |
| Du lieu DXF co the loi thoi | Trung binh | Lien he So TNMT cap nhat |
| Phu thuoc API ben thu ba | Trung binh | Xay dung co che fallback (Thang 9/2026) |

---

## Thong tin file

- **Dinh dang:** Microsoft Excel (.xlsx)
- **So sheet:** 9
- **Dung luong:** ~113 KB
- **Muc dich:** Ho so ban giao du lieu, giup nguoi tiep quan biet ro tung lop du lieu, nguon goc va cach cap nhat

---

*Ban quyen 2026 MekongSaltLab. Ho so danh muc va mo ta du lieu – Phien ban 1.0.*  
*Tai lieu do Hoang va Duy lap ban thao.*
