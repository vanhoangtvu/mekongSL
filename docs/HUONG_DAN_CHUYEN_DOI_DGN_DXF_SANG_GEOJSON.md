# Hướng dẫn chuyển đổi bản đồ quy hoạch (DGN/DXF) lên Web Map

> **Dự án:** Bản đồ quy hoạch sử dụng đất huyện Châu Thành, tỉnh Trà Vinh đến năm 2020
> **File gốc:** `BDQH_hchauthanh.dgn` (DGNv8, 3.9MB)
> **File sau export:** `BDQH_hchauthanh.dxf` (33MB, 57.817 features)
> **Kết quả:** Web map interactive tại `http://localhost:8899/map_dxf.html`

---

## Tổng quan quy trình

```
DGN (MicroStation)
  └→ Export DXF (MicroStation)
       └→ Convert GeoJSON (GDAL ogr2ogr)
            └→ Phân tích lệch tọa độ
                 └→ Tải ranh giới OSM
                      ├→ Tối ưu shift (grid search)
                      ├→ Shift + clip to boundary
                      ├→ Gán mã đất từ text labels
                      ├→ Gán màu theo mã đất
                      └→ Sample lines (tối ưu kích thước)
                           └→ Web Map (OpenLayers + OSM)
```

## Công cụ cần thiết

### Phần mềm

| Công cụ | Phiên bản | Vai trò | Cài đặt |
|---------|-----------|---------|---------|
| **MicroStation** | V8i / CONNECT | Export DGN → DXF | Phần mềm Bentley (có bản quyền) |
| **GDAL / ogr2ogr** | ≥ 3.7 | Convert DXF → GeoJSON | `docker pull ghcr.io/osgeo/gdal:ubuntu-full-latest` |
| **Docker** | ≥ 20.10 | Chạy GDAL container | `apt install docker.io` |
| **Python 3** | ≥ 3.9 | Xử lý dữ liệu (script) | Có sẵn / `apt install python3` |
| **Shapely** | ≥ 2.0 | Thao tác hình học không gian | `pip install shapely` |
| **pyproj** | ≥ 3.4 | Chuyển đổi hệ tọa độ | `pip install pyproj` |
| **OSMnx** | ≥ 1.5 | Tải ranh giới OSM | `pip install osmnx` |
| **OpenLayers** | v7.5.2 | Hiển thị web map | CDN: `ol.js` từ jsdelivr |

### Cài đặt nhanh môi trường Python

```bash
pip install shapely pyproj osmnx numpy
```

### Cài đặt GDAL qua Docker (không cần cài trực tiếp)

```bash
# Pull image
docker pull ghcr.io/osgeo/gdal:ubuntu-full-latest

# Test
docker run --rm ghcr.io/osgeo/gdal:ubuntu-full-latest ogrinfo --version
# Output: GDAL 3.9.0dev...
```

---

## Định dạng dữ liệu chuẩn

### DXF (Drawing Exchange Format)

- **Định dạng:** Text ASCII hoặc Binary (DXF 2010 trở lên)
- **Cấu trúc:** Mỗi entity là nhóm `(group_code, value)` liên tiếp
- **Group code chính:**

| Code | Ý nghĩa |
|------|---------|
| `0` | Loại entity (LWPOLYLINE, LINE, TEXT, HATCH, ...) |
| `8` | Tên layer |
| `10,20,30` | Tọa độ X, Y, Z (điểm chính) |
| `1` | Nội dung text |
| `62` | Màu (0-256, 0=BYBLOCK, 256=BYLAYER) |

- **Entity types phổ biến trong bản đồ quy hoạch:**
  - `LWPOLYLINE` — Đường gấp khúc / đa giác (thửa đất, ranh)
  - `LINE` — Đoạn thẳng (đường giao thông)
  - `HATCH` — Tô màu (polygon)
  - `TEXT` — Chữ (mã loại đất, tên địa danh)

### GeoJSON (RFC 7946)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[106.35, 9.88], [106.36, 9.88], ...]]
      },
      "properties": {
        "Layer": "Level 30",
        "_code": "LUC",
        "_color": "#42A5F5",
        "EntityHandle": "3F5A"
      }
    }
  ]
}
```

- **Geometry types:** Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon
- **CRS:** Luôn là WGS84 (EPSG:4326) — kinh/vĩ độ, không dùng projection khác trong GeoJSON

---

## Hệ tọa độ (CRS/SRS)

### EPSG sử dụng cho Việt Nam

| EPSG | Tên đầy đủ | Proj4 | Dùng cho |
|------|-----------|-------|----------|
| `EPSG:4326` | WGS84 (kinh/vĩ độ) | `+proj=longlat +datum=WGS84` | GeoJSON, GPS |
| `EPSG:3857` | WGS84 Web Mercator | `+proj=merc +datum=WGS84` | OpenLayers, Google Maps |
| `EPSG:32648` | WGS84 UTM zone 48N | `+proj=utm +zone=48 +datum=WGS84` | Trà Vinh, miền Nam |
| `EPSG:32649` | WGS84 UTM zone 49N | `+proj=utm +zone=49 +datum=WGS84` | Miền Trung |
| `EPSG:32647` | WGS84 UTM zone 47N | `+proj=utm +zone=47 +datum=WGS84` | Cà Mau, Kiên Giang |
| `EPSG:3405` | VN2000 UTM 48N | `+proj=utm +zone=48 +datum=WGS84` | Sai ~200m so với WGS84 |
| `EPSG:3406` | VN2000 UTM 49N | | Miền Trung |
| `EPSG:4756` | VN2000 geographic | `+proj=longlat +datum=WGS84` | Tọa độ địa lý VN |

### Cách xác định UTM zone

```
UTM zone = floor((longitude + 180) / 6) + 1

Ví dụ: Châu Thành, Trà Vinh ở 106.35°E
  zone = floor((106.35 + 180) / 6) + 1
       = floor(286.35 / 6) + 1  
       = 47 + 1 = 48N
```

### Công thức chuyển đổi tọa độ

**Độ → Mét (xấp xỉ cho tính diện tích nhanh):**

```
1° kinh độ = 111,320 × cos(vĩ_độ) mét
1° vĩ độ  = 110,540 mét

x_m = lon × 111320 × cos(lat × π/180)
y_m = lat × 110540
```

**Diện tích đa giác (Shoelace formula):**

```
A = ½ × |Σ(x_i × y_{i+1} - x_{i+1} × y_i)|

Trong đó (x_i, y_i) là các đỉnh của đa giác (đã chuyển sang mét)
```

**Chuyển đổi ha:**

```
1 ha = 10,000 m²
A_ha = A_m² / 10000
```

**Tính chính xác hơn bằng Shapely + UTM projection:**

```python
from shapely.geometry import shape
import shapely.ops, pyproj

# Chuyển từ WGS84 → UTM 48N
transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32648", always_xy=True)
utm_geom = shapely.ops.transform(transformer.transform, geom)

# Diện tích mét vuông (cực kỳ chính xác)
area_m2 = utm_geom.area
area_ha = area_m2 / 10000.0
```

---

## Mục lục

1. [Phân tích file DGN gốc](#1-phân-tích-file-dgn-gốc)
2. [Export DGN → DXF](#2-export-dgn--dxf)
3. [Chuyển đổi DXF → GeoJSON bằng GDAL](#3-chuyển-đổi-dxf--geojson-bằng-gdal)
4. [Phân tích cấu trúc dữ liệu DXF](#4-phân-tích-cấu-trúc-dữ-liệu-dxf)
5. [Xác định độ lệch tọa độ](#5-xác-định-độ-lệch-tọa-độ)
6. [Xử lý shift tọa độ + clip + gán mã màu](#6-xử-lý-shift-tọa-độ--clip--gán-mã-màu)
7. [Tải ranh giới hành chính từ OSM](#7-tải-ranh-giới-hành-chính-từ-osm)
8. [Hiển thị lên Web Map (OpenLayers)](#8-hiển-thị-lên-web-map-openlayers)
9. [Chạy web server](#9-chạy-web-server)
10. [Toàn bộ file HTML](#10-toàn-bộ-file-html)
11. [Bảng mã màu loại đất](#11-bảng-mã-màu-loại-đất)
12. [Xử lý lỗi thường gặp](#12-xử-lý-lỗi-thường-gặp)
13. [Tham khảo](#13-tham-khảo)

---

## 1. Phân tích file DGN gốc

### 1.1. Kiểm tra định dạng

```bash
# Kiểm tra magic bytes
xxd BDQH_hchauthanh.dgn | head -3
# DGNv8 bắt đầu bằng D0 CF 11 E0 A1 B1 1A E1 (OLE2)
# DGNv7 bắt đầu bằng 01 01 (raw)

# Kiểm tra kích thước
ls -lh BDQH_hchauthanh.dgn
# Output: 3.9MB
```

### 1.2. Phân tích bằng Python

```python
import struct

with open('BDQH_hchauthanh.dgn', 'rb') as f:
    header = f.read(512)

# DGNv7: offset 0x00 = 0x0101
# DGNv8: offset 0x00 = D0CF11E0 (OLE2)
magic = struct.unpack('<I', header[:4])[0]
if magic == 0xE11CF1D0:  # OLE2 magic
    print("Đây là DGNv8")
```

### 1.3. Kết luận

- File DGN là **DGNv8** (định dạng OLE2, không phải raw binary)
- GDAL driver DGN **chỉ hỗ trợ DGNv7**
- Để đọc DGNv8, cần thư viện **Teigha/ODA SDK** (có bản quyền, không có sẵn)
- **Giải pháp duy nhất:** Export từ MicroStation sang DXF

---

## 2. Export DGN → DXF

### 2.1. Thực hiện trong MicroStation

1. Mở file DGN trong MicroStation
2. **File → Export → DXF/DWG**
3. Chọn định dạng: **AutoCAD DXF 2010** (hoặc mới hơn)
4. **Quan trọng:** Chọn đúng hệ tọa độ:
   - Nếu file dùng VN2000: chọn **VN2000 UTM zone 48N**
   - Nếu file dùng WGS84: chọn **WGS84 UTM zone 48N**
   - Nếu không biết: hỏi người tạo file hoặc thử từng loại
5. Export → file `.dxf`

### 2.2. Kiểm tra file DXF sau export

```bash
# Kích thước file
ls -lh BDQH_hchauthanh.dxf
# Output: 33MB

# Đếm số entity trong DXF
grep -c '^  0$' BDQH_hchauthanh.dxf
# Output: ~15000 entities (LINE, LWPOLYLINE, TEXT, HATCH...)

# Tìm các layer
grep '^  8$' -A1 BDQH_hchauthanh.dxf | grep -v '^  8$' | sort -u
# Output: Level 1..63
```

### 2.3. Lưu ý

- File DXF export từ MicroStation **không nhúng thông tin hệ tọa độ**
- Tọa độ thô trong DXF là số thực 6 chữ số: `X[568544-683788]`, `Y[1014409-1143998]`
- Nghi ngờ đây là tọa độ UTM (đông 500K-700K, bắc 1.000.000-1.150.000)

---

## 3. Chuyển đổi DXF → GeoJSON bằng GDAL

### 3.1. Lệnh cơ bản

```bash
docker run --rm -v /home/hv/DuAn/Mekong:/data \
  ghcr.io/osgeo/gdal:ubuntu-full-latest \
  ogr2ogr -f GeoJSON \
  -t_srs EPSG:4326 \
  -s_srs EPSG:32648 \
  /data/output.geojson \
  /data/input.dxf \
  -lco COORDINATE_PRECISION=6 \
  -progress
```

### 3.2. Giải thích tham số

| Tham số | Giá trị | Ý nghĩa |
|---------|---------|---------|
| `-f` | `GeoJSON` | Định dạng đầu ra |
| `-t_srs` | `EPSG:4326` | Hệ tọa độ đầu ra (WGS84 kinh/vĩ độ) |
| `-s_srs` | `EPSG:32648` | Hệ tọa độ đầu vào (thay đổi tùy file) |
| `-lco` | `COORDINATE_PRECISION=6` | Làm tròn đến 6 số lẻ |
| `-progress` | | Hiển thị tiến trình |

### 3.3. Các EPSG thường dùng cho Việt Nam

| EPSG | Tên | Khu vực | Ghi chú |
|------|-----|---------|---------|
| `EPSG:32648` | WGS84 UTM zone 48N | 102°E → 108°E | Trà Vinh, VN miền Nam |
| `EPSG:32649` | WGS84 UTM zone 49N | 108°E → 114°E | Miền Trung |
| `EPSG:3405` | VN2000 UTM zone 48N | 102°E → 108°E | Sai ~200m so với WGS84 |
| `EPSG:3406` | VN2000 UTM zone 49N | 108°E → 114°E | Miền Trung |
| `EPSG:32647` | WGS84 UTM zone 47N | 96°E → 102°E | Miền Tây (Cà Mau) |

### 3.4. Kiểm tra kết quả

```bash
# Số features
python3 -c "import json; d=json.load(open('output.geojson')); print(len(d['features']))"
# Output: 57817

# Kiểm tra extent
python3 -c "
import json
d=json.load(open('output.geojson'))
for f in d['features'][:10]:
    print(f['properties'].get('Layer',''), f['geometry']['type'])
"
```

### 3.5. Lưu ý quan trọng

- Tham số `-s_srs` rất quan trọng — nếu chọn sai, dữ liệu sẽ bị lệch hàng chục km
- Nếu không chắc chắn, hãy thử:
  ```bash
  # Không chỉ định s_srs → GDAL tự động đoán
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 /data/output.geojson /data/input.dxf
  ```

---

## 4. Phân tích cấu trúc dữ liệu DXF

### 4.1. Code phân tích đầy đủ

```python
import json, re
from collections import Counter

# Đọc GeoJSON
with open('output.geojson') as f:
    data = json.load(f)

# 1. Phân loại theo geometry type
types = Counter()
for feat in data['features']:
    types[feat['geometry']['type']] += 1
print("=== LOẠI ĐỐI TƯỢNG ===")
for t, c in types.most_common():
    print(f"  {t}: {c}")

# 2. Phân loại theo Layer
layers = Counter()
for feat in data['features']:
    layer = feat['properties'].get('Layer', 'N/A')
    layers[layer] += 1
print("\n=== LỚP (LAYER) ===")
for l, c in layers.most_common():
    print(f"  {l}: {c}")

# 3. Tìm text labels
for feat in data['features']:
    if feat['geometry']['type'] == 'Point':
        text = feat['properties'].get('Text', '')
        if text and len(text) > 3:
            print(f"  ({feat['geometry']['coordinates'][0]:.4f}, "
                  f"{feat['geometry']['coordinates'][1]:.4f}) → {text[:60]}")
```

### 4.2. Kết quả phân tích với dữ liệu Châu Thành

```
=== LOẠI ĐỐI TƯỢNG ===
  LineString:      44.542
  Polygon:         9.278
  Point:           3.605
  MultiLineString: 350
  GeometryCollection: 38
  MultiPolygon:    4

=== LỚP (LAYER) ===
  Level 5:   20.273  → Đường giao thông (LineString)
  Level 30:   8.999  → Thửa đất quy hoạch (Polygon)
  Level 33:   6.603  → Text mã loại đất (CLN, LUC, BHK...) + ranh
  Level 23:   5.191  → Ranh giới thửa
  Level 21:   3.707  → Tuyến giao thông
  Level 40:   2.681  → Ranh quy hoạch (nét đứt)
  Level 6:    1.689  → Ranh phụ
  Level 7:    1.440  → Ranh phụ
  Level 17:   1.159  → Ranh quy hoạch tuyến tính
  Level 19:   1.045  → Ranh quy hoạch tuyến tính
  Level 56:     621  → Text + polygon phụ
  ... (còn 37 lớp khác)

=== TEXT LABELS QUAN TRỌNG ===
  (105.8244, 10.0213) → HUYỆN CHÂU THÀNH - TỈNH TRÀ VINH
  (105.8535, 9.8746)  → TT Châu Thành
  (105.8278, 9.9133)  → Trà Vinh
  (105.7179, 9.9327)  → huyện càng long
  (105.8130, 9.7799)  → huyện trà có
  (105.9116, 9.8473)  → huyện cầu ngang
  (105.8041, 9.8325)  → xã Thanh Mỹ
  (105.9767, 9.8694)  → sông cổ chiên
  (105.8986, 9.9382)  → sông cổ chiên
```

### 4.3. Giải mã DXF entities (đọc raw)

```python
with open('input.dxf', errors='replace') as f:
    content = f.read()

lines = content.split('\n')
entities = Counter()
for i, line in enumerate(lines):
    if line.strip() == '0' and i+1 < len(lines):
        entities[lines[i+1].strip()] += 1

print("=== DXF ENTITIES ===")
for e, c in entities.most_common(10):
    print(f"  {e}: {c}")
```

Kết quả:
```
LWPOLYLINE: 27.698  → Đa giác (thửa đất, ranh)
LINE:       13.509  → Đường thẳng
HATCH:       8.145  → Tô màu
TEXT:        3.574  → Chữ
LEADER:      1.000  → Đường dẫn chú thích
```

---

## 5. Xác định độ lệch tọa độ

### 5.1. Vấn đề

Sau khi convert bằng `EPSG:32648` (WGS84 UTM 48N):
```
DXF extent:   lon[105.72-106.07], lat[9.80-9.99]  (trung tâm ~105.89)
OSM thực tế:  lon[106.22-106.55], lat[9.79-9.98]  (trung tâm ~106.35)
→ Lệch ~0.46° về phía tây (~50km)
```

### 5.2. Tìm điểm tham chiếu

Dùng text label **"TT Châu Thành"** trong DXF:
```python
# Tọa độ từ DXF (sau convert, trước shift)
dxf_label = (105.8535, 9.8746)

# Tọa độ thực tế từ Wikipedia:
# "Thị trấn Châu Thành, huyện Châu Thành, tỉnh Trà Vinh"
# 9°52'40"B 106°20'37"Đ = (9.87778, 106.34361)
actual = (106.34361, 9.87778)

# Shift cần áp dụng
delta_lon = actual[0] - dxf_label[0]  # = 0.49011°
delta_lat = actual[1] - dxf_label[1]  # = 0.00318° (bỏ qua)
```

### 5.3. Tải ranh giới OSM

```bash
# Cài đặt OSMnx
pip install osmnx

# Hoặc dùng Overpass API trực tiếp:
```

```python
# Cách 1: Dùng OSMnx (đơn giản nhất)
import osmnx as ox
chau_thanh = ox.geocode_to_gdf("Châu Thành, Trà Vinh, Vietnam")
chau_thanh.to_file("boundary.geojson", driver="GeoJSON")

# Cách 2: Dùng Overpass API
import requests
overpass_url = "https://overpass-api.de/api/interpreter"
query = """
[out:json][timeout:60];
relation(7151606);
out geom;
"""
response = requests.post(overpass_url, data={"data": query})
# Parse và lưu boundary...

# Cách 3: Dùng Nominatim + OSM API
# Bước 1: Tìm relation ID
# https://nominatim.openstreetmap.org/search?q=Châu+Thành+Trà+Vinh&format=json
# Bước 2: Tải boundary
# https://api.openstreetmap.org/api/0.6/relation/7151606/full
```

### 5.4. Tối ưu shift bằng grid search

```python
import json, pickle
from shapely.geometry import shape, Point, Polygon
from shapely.ops import polygonize, unary_union

# Load boundary
with open('boundary.geojson') as f:
    osm_data = json.load(f)

# Polygonize boundary (OSM trả về MultiLineString)
lines = []
for feat in osm_data['features']:
    g = shape(feat['geometry'])
    if g.geom_type == 'LineString':
        lines.append(g)
    elif g.geom_type == 'MultiLineString':
        lines.extend(list(g.geoms))

polygons = list(polygonize(lines))
boundary = max(polygons, key=lambda p: p.area)
# Lưu lại để dùng sau
import pickle
with open('boundary.pkl', 'wb') as f:
    pickle.dump(boundary, f)

# Load polygon centroids từ DXF data
with open('dxf_export.geojson') as f:
    data = json.load(f)

centroids = []
for feat in data['features']:
    if (feat['geometry']['type'] in ('Polygon', 'MultiPolygon') 
        and feat['properties'].get('Layer') == 'Level 30'):
        g = shape(feat['geometry'])
        if not g.is_empty and not g.centroid.is_empty:
            c = g.centroid
            # Lọc tọa độ hợp lệ
            if 105.5 < c.x < 107 and 9.5 < c.y < 10.5:
                centroids.append(c)

print(f"Total valid centroids: {len(centroids)}")

# Grid search
best_score = -1
best_shift = None

# Vùng tìm kiếm: xung quanh shift ước lượng (0.490, 0)
for dlon_off in range(-10, 25, 2):   # -0.010 đến 0.025 step 0.002
    for dlat_off in range(-20, 10, 2):  # -0.020 đến 0.010 step 0.002
        dlon = 0.490 + dlon_off / 1000.0
        dlat = 0.000 + dlat_off / 1000.0
        
        inside = 0
        for c in centroids:
            if boundary.contains(Point(c.x + dlon, c.y + dlat)):
                inside += 1
        
        score = inside / len(centroids)
        if score > best_score:
            best_score = score
            best_shift = (dlon, dlat, score)

print(f"Best shift: Δlon={best_shift[0]:.4f}, Δlat={best_shift[1]:.4f}")
print(f"Score: {best_shift[2]*100:.1f}% centroids inside boundary")
```

Kết quả:
```
Δlon = +0.501°, Δlat = -0.004° → 99.5% centroids inside boundary
```

### 5.5. Kiểm tra extent sau shift

```python
SHIFT_LON = 0.501
SHIFT_LAT = -0.004

lons = [c.x + SHIFT_LON for c in centroids]
lats = [c.y + SHIFT_LAT for c in centroids]

print(f"DXF after shift: lon[{min(lons):.4f},{max(lons):.4f}] "
      f"lat[{min(lats):.4f},{max(lats):.4f}]")
print(f"OSM boundary:   lon[106.2198,106.5465] "
      f"lat[9.7921,9.9783]")

# Kết quả mong đợi:
# DXF after shift: lon[106.2221,106.5448] lat[9.7936,9.9721]
# → Dữ liệu phủ hoàn toàn OSM boundary
```

---

## 6. Xử lý shift tọa độ + clip + gán mã màu

### 6.1. Script hoàn chỉnh

```python
#!/usr/bin/env python3
"""
Process DXF→GeoJSON for web map display:
1. Apply coordinate shift
2. Clip to administrative boundary
3. Assign land use codes from text labels
4. Assign colors
5. Simplify (sample lines, remove points)
"""

import json, pickle, random
from shapely.geometry import shape, Point, Polygon, MultiPolygon, \
    LineString, MultiLineString
from shapely.affinity import translate
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid
from collections import Counter

# ===== CẤU HÌNH =====
SHIFT_LON = 0.501
SHIFT_LAT = -0.004
LINE_SAMPLE_SIZE = 2000  # Số lượng line giữ lại
RANDOM_SEED = 42

# ===== LOAD DỮ LIỆU =====
print("Loading data...")
with open('dxf_export.geojson') as f:
    data = json.load(f)
with open('boundary.pkl', 'rb') as f:
    boundary = pickle.load(f)

# ===== HÀM TIỆN ÍCH =====
def safe_shape(geojson_geom):
    """Convert GeoJSON geometry to shapely, handle errors."""
    try:
        return shape(geojson_geom)
    except Exception:
        return None

def safe_clip(geom, boundary):
    """Clip geometry to boundary, handle degenerate results."""
    if not geom.intersects(boundary):
        return None
    try:
        if not geom.is_valid:
            geom = geom.buffer(0)
        clipped = geom.intersection(boundary)
        if clipped.is_empty:
            return None
        # Xử lý GeometryCollection
        if clipped.geom_type == 'GeometryCollection':
            parts = [g for g in clipped.geoms
                     if g.geom_type in ('Polygon', 'MultiPolygon',
                                        'LineString', 'MultiLineString')]
            if not parts:
                return None
            if len(parts) == 1:
                clipped = parts[0]
            else:
                clipped = unary_union(parts)
        # Kiểm tra kết quả
        valid_types = ('Polygon', 'MultiPolygon', 'LineString', 'MultiLineString')
        if clipped.is_empty or clipped.geom_type not in valid_types:
            return None
        # Bỏ polygon degenerate (< 4 điểm)
        if clipped.geom_type == 'Polygon' and len(clipped.exterior.coords) < 4:
            return None
        return clipped
    except Exception:
        return None

# ===== BƯỚC 1: SHIFT + CLIP =====
print("Shifting and clipping features...")
polys = []    # List of (feature, shapely_geom)
lines = []    # List of features

for feat in data['features']:
    g = feat['geometry']
    gt = g['type']
    
    # Bỏ Point và GeometryCollection
    if gt in ('Point', 'GeometryCollection'):
        continue
    
    # Convert to shapely
    shp = safe_shape(g)
    if shp is None:
        continue
    
    # Apply shift
    shifted = translate(shp, xoff=SHIFT_LON, yoff=SHIFT_LAT)
    
    # Clip to boundary
    clipped = safe_clip(shifted, boundary)
    if clipped is None:
        continue
    
    # Convert back to GeoJSON
    gj = clipped.__geo_interface__
    new_feat = {
        "type": "Feature",
        "properties": feat.get('properties', {}).copy(),
        "geometry": gj
    }
    
    if clipped.geom_type in ('Polygon', 'MultiPolygon'):
        polys.append((new_feat, clipped))
    else:
        lines.append(new_feat)

print(f"  Polygons: {len(polys)}, Lines: {len(lines)}")

# ===== BƯỚC 2: GÁN MÃ LOẠI ĐẤT =====
print("Assigning land use codes...")

# Lấy text labels từ DXF (Level 33, 34)
texts = []
for feat in data['features']:
    layer = feat['properties'].get('Layer', '')
    g = feat['geometry']
    if layer in ('Level 33', 'Level 34') and g['type'] == 'Point':
        txt = feat['properties'].get('Text', '').strip()
        if txt and len(txt) <= 5:
            pt = safe_shape(g)
            if pt:
                shifted_pt = translate(pt, xoff=SHIFT_LON, yoff=SHIFT_LAT)
                texts.append({
                    'pt': shifted_pt,
                    'code': txt.upper()
                })

text_pts = [t['pt'] for t in texts]
poly_shapes = [p[1] for p in polys]

if text_pts and poly_shapes:
    text_tree = STRtree(text_pts)
    poly_tree = STRtree(poly_shapes)
    
    # Phương pháp 1: Containment (text point nằm trong polygon)
    for t in texts:
        pt = t['pt']
        idxs = poly_tree.query(pt)
        for idx in idxs:
            if poly_shapes[idx].contains(pt):
                props = polys[idx][0]['properties']
                if not props.get('_code'):
                    props['_code'] = t['code']
                break
    
    # Phương pháp 2: Nearest neighbor (cho polygon chưa có mã)
    unmatched = [i for i, p in enumerate(polys)
                 if not p[0]['properties'].get('_code')]
    for i in unmatched:
        try:
            centroid = poly_shapes[i].centroid
            idxs = text_tree.query_nearest(centroid, 1)
            if len(idxs) > 0:
                idx = idxs[0]
                # Chỉ chấp nhận nếu khoảng cách < 500m
                if centroid.distance(texts[idx]['pt']) < 0.005:
                    polys[i][0]['properties']['_code'] = texts[idx]['code']
        except Exception:
            pass

matched = sum(1 for p in polys if p[0]['properties'].get('_code'))
print(f"  Matched: {matched}/{len(polys)} ({matched*100/len(polys):.1f}%)")

# ===== BƯỚC 3: GÁN MÀU =====
COLORS = {
    # Màu sắc theo Quyết định 65/2018/QĐ-UBND và thông dụng
    'CLN': '#2E7D32',  # Cây lâu năm
    'LUC': '#42A5F5',  # Lúa nước
    'NTS': '#00ACC1',  # Nuôi trồng thủy sản
    'BHK': '#FDD835',  # Đất ở nông thôn
    'LUA': '#64B5F6',  # Lúa (màu khác để phân biệt)
    'SKC': '#6D4C41',  # Sản xuất vật liệu xây dựng
    'ONT': '#EC407A',  # Đất ở đô thị
    'DGD': '#A1887F',  # Đất giáo dục
    'DHT': '#D7CCC8',  # Đất hỗn hợp
    'DVH': '#F48FB1',  # Đất văn hóa
    'TTN': '#FFCC80',  # Đất trồng trọt
    'NTD': '#FFAB91',  # Nhà ở
    'NKH': '#A5D6A7',  # Nuôi trồng khoa học
    'CQP': '#8D6E63',  # Cơ quan
    'CTS': '#29B6F6',  # Công trình sự nghiệp
    'DRA': '#0D47A1',  # Sông rạch
    'DTT': '#FF8A65',  # Đất đặc thù
    'ODT': '#F48FB1',  # Đô thị
    'CAN': '#66BB6A',  # Cây ăn quả
    'DDT': '#F4511E',  # Di tích
    'CSD': '#90A4AE',  # Cơ sở sản xuất
    'DYT': '#EF9A9A',  # Y tế
    'SKX': '#8D6E63',  # Sản xuất kinh doanh
    'RSX': '#1A237E',  # Rừng sản xuất
    'RPH': '#BDBDBD',  # Ranh phụ họa
    'SKK': '#BDBDBD',  # Sông/kênh
    'SON': '#80CBC4',  # Sông
    'COC': '#FFCC80',  # Cây có củ
    'DTL': '#CE93D8',  # Du lịch
    'DGT': '#9E9E9E',  # Giao thông
    'RSM': '#1565C0',  # Mặt nước
    'PNK': '#A1887F',  # Phi nông nghiệp khác
    'BKS': '#1E88E5',  # Bãi bồi
    'DON': '#33691E',  # Quốc phòng
    'TMD': '#FF6F00',  # Thương mại dịch vụ
    'TSC': '#E53935',  # SXKD phi nông nghiệp
    'TIN': '#26C6DA',  # Tín ngưỡng
    'SHT': '#CE93D8',  # Sinh hoạt
    'DLT': '#7B1FA2',  # Du lịch
    'DXH': '#F8BBD0',  # Đất xã hội
    'CKH': '#C5E1A5',  # Cây hàng năm
    'LNK': '#81C784',  # Lâm nghiệp
    'HNK': '#43A047',  # Hỗn hợp nông lâm
    'PHT': '#AB47BC',  # Phụ trợ
    'MTC': '#26C6DA',  # Mặt nước chuyên dùng
    'GPC': '#AED581',  # Gia phả
    'NHA': '#FFCC80',  # Nhà ở
    'OTH': '#D7CCC8',  # Khác
}

for p, _ in polys:
    code = p['properties'].get('_code') or 'OTH'
    p['properties']['_color'] = COLORS.get(code, '#BDBDBD')
    p['properties']['_code'] = code

# ===== BƯỚC 4: SAMPLE LINES + GHÉP =====
random.seed(RANDOM_SEED)
sampled_lines = random.sample(lines, min(len(lines), LINE_SAMPLE_SIZE))

all_features = [p[0] for p in polys] + sampled_lines
print(f"Total output features: {len(all_features)}")

# Lưu file GeoJSON
with open('dxf_display.geojson', 'w') as f:
    json.dump({"type": "FeatureCollection", "features": all_features}, f)

# ===== THỐNG KÊ =====
code_counts = Counter(p[0]['properties'].get('_code', '') for p in polys)
print("\n=== PHÂN BỐ LOẠI ĐẤT ===")
for code, count in code_counts.most_common(20):
    color = COLORS.get(code, '#BDBDBD')
    print(f"  {color} {code}: {count}")

# Kiểm tra alignment
valid_polys = [p[1] for p in polys if p[1].is_valid]
inside = sum(1 for g in valid_polys if boundary.contains(g.centroid))
print(f"\nAlignment: {inside}/{len(valid_polys)} "
      f"({inside*100/len(valid_polys):.1f}%) centroids inside boundary")
```

### 6.2. File màu mapping cho JavaScript

```javascript
// color_mapping.js — dùng trên web map
const LAND_NAMES = {
  'BHK':'Đất ở nông thôn',    'CLN':'Cây lâu năm',
  'LUC':'Lúa nước',           'NTS':'Nuôi trồng thủy sản',
  'LUA':'Lúa',                'SKC':'SX vật liệu xây dựng',
  'ONT':'Đất ở đô thị',       'DGD':'Đất giáo dục',
  'DHT':'Đất hỗn hợp',        'DVH':'Đất văn hóa',
  'TTN':'Đất trồng trọt',     'NTD':'Nhà ở',
  'NKH':'Nuôi trồng KH',      'CQP':'Cơ quan',
  'CTS':'CT sự nghiệp',       'DRA':'Sông rạch',
  'DTT':'Đất đặc thù',        'ODT':'Đô thị',
  'CAN':'Cây ăn quả',         'DDT':'Di tích',
  'CSD':'CS sản xuất',        'DYT':'Y tế',
  'SKX':'SXKD',               'RSX':'Rừng SX',
  'RPH':'Ranh phụ họa',       'SKK':'Sông/kênh',
  'SON':'Sông',               'COC':'Cây có củ',
  'DTL':'Du lịch',            'DGT':'Giao thông',
  'RSM':'Mặt nước',           'PNK':'Phi NN khác',
  'BKS':'Bãi bồi',            'DON':'Quốc phòng',
  'TMD':'Thương mại DV',      'TSC':'SXKD phi NN',
  'TIN':'Tín ngưỡng',         'SHT':'Sinh hoạt',
  'DLT':'Du lịch',            'DXH':'Đất xã hội',
  'CKH':'Cây hàng năm',       'LNK':'Lâm nghiệp',
  'HNK':'Hỗn hợp NL',         'PHT':'Phụ trợ',
  'MTC':'Mặt nước CD',        'GPC':'Đất gia phả',
  'NHA':'Nhà ở',              'OTH':'Khác'
};

const LAYER_NAMES = {
  'Level 5':  'Đường giao thông',
  'Level 30': 'Thửa đất',
  'Level 23': 'Ranh giới',
  'Level 21': 'Giao thông',
  'Level 40': 'Ranh quy hoạch',
  'Level 6':  'Ranh phụ',
  'Level 7':  'Ranh phụ'
};
```

---

## 7. Tải ranh giới hành chính từ OSM

### 7.1. Tìm relation ID

Truy cập: `https://nominatim.openstreetmap.org/search?q=Châu+Thành+Trà+Vinh&format=json`

Hoặc dùng Overpass Turbo: `http://overpass-turbo.eu/`

```sql
[out:json];
area[name="Trà Vinh"]->.a;
rel(area.a)[name="Châu Thành"][admin_level=7];
out geom;
```

### 7.2. Tải dữ liệu

```bash
# Dùng wget
wget -O boundary.osm "https://api.openstreetmap.org/api/0.6/relation/7151606/full"

# Dùng overpass-api
curl -X POST -d '[out:json];relation(7151606);out geom;' \
  "https://overpass-api.de/api/interpreter" -o boundary.json
```

### 7.3. Chuyển OSM → GeoJSON

```python
import json, requests

# Cách đơn giản: dùng OSMnx
import osmnx as ox
gdf = ox.geocode_to_gdf("Châu Thành, Trà Vinh, Vietnam", which_result=1)
gdf.to_file("boundary.geojson", driver="GeoJSON")

# Cách thủ công: parse OSM XML
import xml.etree.ElementTree as ET
tree = ET.parse('boundary.osm')
root = tree.getroot()

# Tìm ways thuộc relation boundary
# Tạo LineString từ mỗi way
# Ghép thành polygon
```

---

## 8. Hiển thị lên Web Map (OpenLayers)

### 8.1. Cấu trúc file HTML

```
/tmp/
├── map_dxf.html           # Trang web map
├── dxf_display.geojson    # Dữ liệu đã xử lý (11MB)
├── chau_thanh_boundary.geojson  # Ranh giới OSM
└── color_mapping.json     # (tùy chọn) mapping màu
```

### 8.2. Giải thích các thành phần

| Thành phần | Mô tả |
|------------|-------|
| **Lớp OSM** | Bản đồ nền (OpenStreetMap tiles) |
| **Lớp boundary** | Ranh giới huyện, đường đỏ nét đậm |
| **Lớp DXF polygons** | Thửa đất, tô màu theo mã loại |
| **Lớp DXF lines** | Đường giao thông, sông rạch, nét xám |
| **Popup hover** | Hiện thông tin khi rê chuột 200ms |
| **Chú giải** | Bảng màu + mã loại đất |

### 8.3. Cơ chế popup

```javascript
// Khi di chuột, đợi 200ms rồi hiện popup
map.on('pointermove', function(evt) {
  // Clear timer cũ
  if (hoverTimer) { clearTimeout(hoverTimer); }
  
  // Tìm feature tại pixel
  var hit = map.forEachFeatureAtPixel(evt.pixel, function(f) { return f; });
  
  if (hit && hit.getGeometry().getType() === 'Polygon') {
    hoverTimer = setTimeout(function() {
      // Lấy thông tin từ feature properties
      var code = hit.get('_code');
      var color = hit.get('_color');
      var layer = hit.get('Layer');
      
      // Tính diện tích (web mercator → WGS84)
      var area = formatArea(hit.getGeometry());
      
      // Hiển thị popup
      showPopup(evt.pixel, {code, color, layer, area});
    }, 200);
  } else {
    popupEl.style.display = 'none';
  }
});
```

### 8.4. Tính diện tích trên client

```javascript
function formatArea(geom) {
  // Chuyển từ web mercator (EPSG:3857) về WGS84 (EPSG:4326)
  var poly = geom.clone().transform('EPSG:3857', 'EPSG:4326');
  var coords = poly.getCoordinates();
  
  if (poly.getType() === 'Polygon') {
    coords = coords[0]; // exterior ring
    var area = 0;
    for (var i = 0; i < coords.length - 1; i++) {
      // Chuyển độ sang mét (xấp xỉ)
      var x1 = coords[i][0] * 111320 * Math.cos(coords[i][1] * Math.PI / 180);
      var y1 = coords[i][1] * 110540;
      var x2 = coords[i+1][0] * 111320 * Math.cos(coords[i+1][1] * Math.PI / 180);
      var y2 = coords[i+1][1] * 110540;
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) / 2;
    
    if (area > 10000) return (area / 10000).toFixed(1) + ' ha';
    if (area > 100)   return area.toFixed(0) + ' m²';
    return area.toFixed(1) + ' m²';
  }
  return '';
}
```

---

## 9. Chạy web server

### 9.1. Khởi động server

```bash
python3 -m http.server 8899 --directory /tmp
```

### 9.2. Mở trình duyệt

Truy cập: **http://localhost:8899/map_dxf.html**

### 9.3. Nếu cần restart

```bash
# Kill server cũ
pkill -f "python3 -m http.server 8899"

# Khởi động lại
python3 -c "
import subprocess, time
subprocess.Popen(['python3', '-m', 'http.server', '8899', '--directory', '/tmp'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
import urllib.request
r = urllib.request.urlopen('http://localhost:8899/map_dxf.html', timeout=5)
print(f'OK: HTTP {r.status}')
"
```

---

## 10. Toàn bộ file HTML

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>BDQH - Bản đồ quy hoạch sử dụng đất</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v7.5.2/ol.css">
<script src="https://cdn.jsdelivr.net/npm/ol@v7.5.2/dist/ol.js"></script>
<style>
  html,body,#map{width:100%;height:100%;margin:0;padding:0;font-family:sans-serif}
  #info{position:absolute;top:12px;left:12px;background:rgba(255,255,255,.93);padding:14px 18px;border-radius:10px;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,.12);max-width:360px;font-size:14px;line-height:1.5}
  #info h2{margin:0 0 4px;font-size:15px}
  #loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px 28px;border-radius:10px;z-index:200;box-shadow:0 2px 16px rgba(0,0,0,.15)}
  #legend-btn{position:absolute;bottom:30px;right:12px;background:#fff;border:none;border-radius:6px;padding:10px 14px;cursor:pointer;z-index:100;box-shadow:0 1px 6px rgba(0,0,0,.15);font-size:14px;font-weight:600}
  #legend-btn:hover{background:#f0f0f0}
  #legend{position:absolute;bottom:75px;right:12px;background:rgba(255,255,255,.97);padding:12px 16px;border-radius:8px;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.15);max-height:70vh;overflow-y:auto;display:none;min-width:200px;font-size:13px}
  #legend h3{margin:0 0 8px;font-size:14px}
  #legend .item{display:flex;align-items:center;margin:3px 0;gap:8px}
  #legend .swatch{width:18px;height:14px;border-radius:3px;flex-shrink:0;border:1px solid rgba(0,0,0,.1)}
  #legend .count{color:#666;margin-left:auto;font-size:11px}
  #popup{position:absolute;background:#fff;border-radius:8px;box-shadow:0 3px 20px rgba(0,0,0,.25);z-index:400;padding:0;display:none;min-width:250px;max-width:340px;font-size:13px;overflow:hidden}
  #popup .head{padding:10px 14px;color:#fff;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center}
  #popup .head .close{cursor:pointer;opacity:.8;font-size:16px;line-height:1}
  #popup .head .close:hover{opacity:1}
  #popup .body{padding:10px 14px 12px}
  #popup .row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0}
  #popup .row:last-child{border:none}
  #popup .label{color:#888;font-weight:500}
  #popup .value{text-align:right;font-weight:500;max-width:180px}
  #popup .area{font-weight:600;color:#1565C0}
  #attribution{position:absolute;bottom:4px;right:50%;transform:translateX(50%);color:#666;font-size:11px;z-index:50;background:rgba(255,255,255,.7);padding:2px 8px;border-radius:4px}
</style>
</head>
<body>
<div id="loading">⏳ Đang tải dữ liệu quy hoạch...</div>
<div id="map"></div>
<div id="info">
  <h2>Bản đồ quy hoạch sử dụng đất Châu Thành, Trà Vinh</h2>
  <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">
    <span><span style="display:inline-block;width:14px;height:3px;background:#e74c3c"></span> Ranh huyện</span>
    <span><span style="display:inline-block;width:14px;height:3px;background:#555"></span> Đường/Sông</span>
  </div>
  <div style="margin-top:6px;font-size:12px;color:#888">Rê chuột vào thửa đất để xem thông tin</div>
</div>
<button id="legend-btn">Chú giải</button>
<div id="legend"><h3>Chú giải loại đất</h3><div id="legend-items"></div></div>
<div id="popup">
  <div class="head" id="popup-head">
    <span id="popup-title">Thông tin thửa đất</span>
    <span class="close" id="popup-close">&times;</span>
  </div>
  <div class="body" id="popup-body"></div>
</div>
<div id="attribution">Nguồn: Sở TN&MT Trà Vinh · Quy hoạch đến 2020</div>

<script>
(function(){
  var loadingEl = document.getElementById('loading');
  var popupEl = document.getElementById('popup');
  var popupBody = document.getElementById('popup-body');
  var popupTitle = document.getElementById('popup-title');
  var popupClose = document.getElementById('popup-close');
  popupClose.onclick = function() { popupEl.style.display = 'none'; };

  // Tên loại đất
  var LAND_NAMES = {
    'BHK':'Đất ở nông thôn','CLN':'Cây lâu năm','LUC':'Lúa nước',
    'NTS':'Nuôi trồng thủy sản','LUA':'Lúa','SKC':'SX VLXD',
    'ONT':'Đất ở đô thị','DGD':'Đất giáo dục','DHT':'Đất hỗn hợp',
    'DVH':'Đất văn hóa','TTN':'Đất trồng trọt','NTD':'Nhà ở',
    'NKH':'Nuôi trồng KH','CQP':'Cơ quan','CTS':'CT sự nghiệp',
    'DRA':'Sông rạch','DTT':'Đất đặc thù','ODT':'Đô thị',
    'CAN':'Cây ăn quả','DDT':'Di tích','CSD':'CS sản xuất',
    'DYT':'Y tế','SKX':'SXKD','RSX':'Rừng SX','RPH':'Ranh phụ',
    'SKK':'Sông/kênh','SON':'Sông','COC':'Cây có củ',
    'DTL':'Du lịch','DGT':'Giao thông','RSM':'Mặt nước',
    'PNK':'Phi NN khác','BKS':'Bãi bồi','DON':'Quốc phòng',
    'TMD':'Thương mại DV','TSC':'SXKD phi NN','TIN':'Tín ngưỡng',
    'SHT':'Sinh hoạt','DLT':'Du lịch','DXH':'Đất xã hội',
    'CKH':'Cây hàng năm','LNK':'Lâm nghiệp','HNK':'Hỗn hợp NL',
    'PHT':'Phụ trợ','MTC':'Mặt nước CD','GPC':'Đất gia phả',
    'NHA':'Nhà ở','OTH':'Khác'
  };

  var LAYER_NAMES = {
    'Level 5':'Đường giao thông','Level 30':'Thửa đất',
    'Level 23':'Ranh giới','Level 21':'Giao thông',
    'Level 40':'Ranh quy hoạch','Level 6':'Ranh phụ'
  };

  // Tính diện tích
  function formatArea(geom) {
    try {
      var poly = geom.clone().transform('EPSG:3857','EPSG:4326');
      var coords = poly.getCoordinates();
      if (poly.getType() !== 'Polygon') return '';
      coords = coords[0];
      var area = 0;
      for (var i = 0; i < coords.length-1; i++) {
        var x1 = coords[i][0]*111320*Math.cos(coords[i][1]*Math.PI/180);
        var y1 = coords[i][1]*110540;
        var x2 = coords[i+1][0]*111320*Math.cos(coords[i+1][1]*Math.PI/180);
        var y2 = coords[i+1][1]*110540;
        area += x1*y2 - x2*y1;
      }
      area = Math.abs(area)/2;
      if (area > 10000) return (area/10000).toFixed(1)+' ha';
      if (area > 100) return area.toFixed(0)+' m²';
      return area.toFixed(1)+' m²';
    } catch(e) { return ''; }
  }

  // Load boundary
  var xhr1 = new XMLHttpRequest();
  xhr1.open('GET', '/chau_thanh_boundary.geojson', true);
  xhr1.onload = function() {
    var boundary = JSON.parse(xhr1.responseText);

    // Load DXF data
    var xhr2 = new XMLHttpRequest();
    xhr2.open('GET', '/dxf_display.geojson', true);
    xhr2.onload = function() {
      try {
        var dxfData = JSON.parse(xhr2.responseText);

        // === Xây dựng legend ===
        var codes = {};
        dxfData.features.forEach(function(f) {
          var c = f.properties._code;
          if (c) {
            if (!codes[c]) codes[c] = {color: f.properties._color, count: 0};
            codes[c].count++;
          }
        });
        var sorted = Object.keys(codes)
          .sort(function(a,b){return codes[b].count-codes[a].count});
        document.getElementById('legend-items').innerHTML = sorted.map(function(c){
          return '<div class="item"><span class="swatch" style="background:'+
            codes[c].color+'"></span> '+(LAND_NAMES[c]||c)+
            '<span class="count">'+codes[c].count+'</span></div>';
        }).join('');

        document.getElementById('legend-btn').addEventListener('click',
          function() {
            var el = document.getElementById('legend');
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
          });

        // === Lớp boundary ===
        var boundaryLayer = new ol.layer.Vector({
          source: new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(
              boundary, {featureProjection: 'EPSG:3857'})
          }),
          style: new ol.style.Style({
            stroke: new ol.style.Stroke({color: '#e74c3c', width: 3}),
            fill: new ol.style.Fill({color: 'rgba(231,76,60,0.04)'})
          })
        });

        // === Lớp DXF ===
        var dxfLayer = new ol.layer.Vector({
          source: new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(
              dxfData, {featureProjection: 'EPSG:3857'})
          }),
          style: function(feature) {
            var geom = feature.getGeometry().getType();
            var color = feature.get('_color');
            if (geom === 'Polygon' || geom === 'MultiPolygon') {
              return new ol.style.Style({
                stroke: new ol.style.Stroke({color: '#333', width: 0.4}),
                fill: new ol.style.Fill({color: (color || '#ccc')+'cc'})
              });
            }
            return new ol.style.Style({
              stroke: new ol.style.Stroke({color: '#555', width: 0.7})
            });
          }
        });

        // === Map ===
        var map = new ol.Map({
          target: 'map',
          layers: [
            new ol.layer.Tile({source: new ol.source.OSM()}),
            dxfLayer,
            boundaryLayer
          ],
          view: new ol.View({
            center: ol.proj.fromLonLat([106.35, 9.88]),
            zoom: 11
          })
        });

        // === Hover popup ===
        var hoverTimer = null;
        map.on('pointermove', function(evt) {
          if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }

          var hit = map.forEachFeatureAtPixel(evt.pixel,
            function(f) { return f; });

          if (hit) {
            var code = hit.get('_code');
            var geom = hit.getGeometry();
            var props = hit.getProperties();

            if (geom.getType() === 'Polygon' ||
                geom.getType() === 'MultiPolygon') {
              hoverTimer = setTimeout(function() {
                var color = hit.get('_color') || '#888';
                var area = formatArea(geom);
                var landName = LAND_NAMES[code] || 'Không xác định';
                var layerName = LAYER_NAMES[props.Layer] ||
                  props.Layer || 'N/A';

                var html = '';
                html += '<div class="row"><span class="label">Loại đất</span>'+
                  '<span class="value" style="color:'+color+'">'+
                  landName+' ('+code+')</span></div>';
                if (area) {
                  html += '<div class="row"><span class="label">Diện tích</span>'+
                    '<span class="value area">'+area+'</span></div>';
                }
                html += '<div class="row"><span class="label">Lớp</span>'+
                  '<span class="value">'+layerName+'</span></div>';
                html += '<div class="row"><span class="label">Loại hình</span>'+
                  '<span class="value">'+
                  (geom.getType()==='Polygon'?'Polygon':'Đa Polygon')+
                  '</span></div>';

                popupBody.innerHTML = html;
                popupTitle.innerHTML = landName;
                document.getElementById('popup-head').style.background = color;
                popupEl.style.display = 'block';

                // Đặt vị trí popup
                var rect = map.getTargetElement().getBoundingClientRect();
                var x = evt.pixel[0] + 15;
                var y = evt.pixel[1] - 10;
                popupEl.style.left = x + 'px';
                popupEl.style.top = y + 'px';
              }, 200);
            } else { popupEl.style.display = 'none'; }
          } else { popupEl.style.display = 'none'; }
        });

        loadingEl.remove();
      } catch(e) {
        loadingEl.innerHTML = '❌ Lỗi: ' + e.message;
      }
    };
    xhr2.send();
  };
  xhr1.send();
})();
</script>
</body>
</html>
```

---

## 11. Bảng mã màu loại đất

| Mã | Màu | Tên đầy đủ | Ghi chú |
|-----|------|-------------|---------|
| CLN | `#2E7D32` | Cây lâu năm | Vườn cây ăn quả, cà phê, cao su... |
| LUC | `#42A5F5` | Lúa nước | Ruộng lúa |
| NTS | `#00ACC1` | Nuôi trồng thủy sản | Ao, hồ cá, tôm |
| BHK | `#FDD835` | Đất ở nông thôn | Đất thổ cư nông thôn |
| LUA | `#64B5F6` | Lúa (nương rẫy) | Phân biệt với LUC |
| SKC | `#6D4C41` | SX vật liệu xây dựng | Gạch, ngói, cát, đá |
| ONT | `#EC407A` | Đất ở đô thị | Đất thổ cư thành phố |
| DRA | `#0D47A1` | Sông, rạch, kênh | Thủy hệ |
| DGT | `#9E9E9E` | Đất giao thông | Đường xá |
| RSM | `#1565C0` | Mặt nước chuyên dùng | Hồ chứa, kênh thủy lợi |
| TMD | `#FF6F00` | Thương mại dịch vụ | Chợ, siêu thị, trung tâm |
| DYT | `#EF9A9A` | Y tế | Bệnh viện, trạm y tế |
| DGD | `#A1887F` | Giáo dục | Trường học |
| DDT | `#F4511E` | Di tích lịch sử | Đền, chùa, di tích |
| TSC | `#E53935` | SXKD phi nông nghiệp | Nhà máy, xí nghiệp |
| DON | `#33691E` | Quốc phòng | Doanh trại, căn cứ |
| CKH | `#C5E1A5` | Cây hàng năm khác | Mía, đậu, lạc... |
| OTH | `#D7CCC8` | Khác / Không xác định | |

---

## 12. Xử lý lỗi thường gặp

### 12.1. DGN không đọc được

```
Lỗi: ERROR 1: DGN driver doesn't support DGNv8 files
→ Giải pháp: Export từ MicroStation sang DXF.
  GDAL chỉ hỗ trợ DGNv7.
```

### 12.2. ogr2ogr lỗi "Unable to open"

```
Lỗi: Unable to open datasource
→ Kiểm tra đường dẫn volume trong Docker.
  Dùng -v đúng: -v /home/user/data:/data
→ Kiểm tra file tồn tại: ls -l input.dxf
```

### 12.3. Dữ liệu lệch 40-50km

```
Triệu chứng: Dữ liệu hiển thị cách xa ranh giới OSM
→ Nguyên nhân: Chọn sai -s_srs
→ Cách fix:
  1. Kiểm tra tọa độ thô trong DXF: grep -A1 '^ 10$' file.dxf | head
  2. Xác định UTM zone từ tọa độ easting:
     - Easting 100K-300K → Zone 47 (CM=99°E)
     - Easting 400K-700K → Zone 48 (CM=105°E)
     - Easting 700K-900K → Zone 49 (CM=111°E)
  3. Thử lại với EPSG tương ứng
```

### 12.4. GeoJSON quá lớn (>30MB)

```
→ Giải pháp 1: Giảm số lượng features
  - Giữ nguyên polygons (quan trọng)
  - Sample lines: 2000/44542 (≈5%)
  - Bỏ hết Point features

→ Giải pháp 2: Simplification
  ogr2ogr -f GeoJSON -simplify 0.001 \
    output_simple.geojson input.geojson

→ Giải pháp 3: Vector tiles
  Dùng Tippecanoe hoặc Martin để tạo tiles
```

### 12.5. Spatial join không tìm thấy text

```
Triệu chứng: Chỉ match được ~20% polygon
→ Nguyên nhân: Text labels nằm ngoài polygon,
  hoặc không có text trong file

→ Cách fix:
  1. Kiểm tra text labels tồn tại:
     grep -c '\n1\n' file.dxf  (group code 1)
  2. Dùng buffer cho containment:
     poly.buffer(0.001).contains(point)
  3. Dùng nearest neighbor nếu containment thất bại
```

### 12.6. OpenLayers không hiển thị

```
→ Kiểm tra console browser (F12) cho lỗi JavaScript
→ Kiểm tra GeoJSON hợp lệ:
  python3 -c "import json; json.load(open('file.geojson'))"
→ Kiểm tra CORS nếu serve từ domain khác
→ Kiểm tra dung lượng file >50MB có thể timeout
```

### 12.7. Popup không hiện

```
→ Kiểm tra feature có property _color và _code
→ Kiểm tra geometry type là Polygon/MultiPolygon
→ Kiểm tra map.forEachFeatureAtPixel trả về feature
```

---

## 13. Tham khảo

### 13.1. File trong dự án

| File | Vị trí | Kích thước | Mô tả |
|------|--------|------------|-------|
| DGN gốc | `BDQH_hchauthanh.dgn` | 3.9MB | Bản đồ quy hoạch DGNv8 |
| DXF export | `BDQH_hchauthanh.dxf` | 33MB | Export từ MicroStation |
| GeoJSON thô | `tmp_dxf_export.geojson` | 24MB | GDAL convert, 57.817 features |
| GeoJSON đã xử lý | `/tmp/dxf_display.geojson` | 11MB | Shift+clip+sample, 12.038 features |
| Boundary OSM | `/tmp/chau_thanh_boundary.geojson` | 53KB | Ranh giới huyện (relation 7151606) |
| Boundary polygon | `/tmp/chau_thanh_polygon.pkl` | 4KB | Đã polygonize |
| Web map | `/tmp/map_dxf.html` | 8KB | OpenLayers + OSM |

### 13.2. EPSG codes cho Việt Nam

- `EPSG:32648` → WGS84 / UTM zone 48N
- `EPSG:3405` → VN2000 / UTM zone 48N  
- `EPSG:4756` → VN2000 (geographic, không projection)
- `EPSG:4326` → WGS84 (kinh/vĩ độ)
- `EPSG:3857` → Web Mercator (OpenLayers, Google Maps)

### 13.3. Công cụ hữu ích

- **OpenLayers**: `https://cdn.jsdelivr.net/npm/ol@v7.5.2/dist/ol.js`
- **OpenStreetMap Nominatim**: `https://nominatim.openstreetmap.org/`
- **Overpass API**: `https://overpass-api.de/`
- **GDAL Docker**: `ghcr.io/osgeo/gdal:ubuntu-full-latest`
- **Shapely**: `pip install shapely`
- **OSMnx**: `pip install osmnx`

### 13.4. Tham khảo thêm

- [OpenLayers Documentation](https://openlayers.org/en/latest/doc/)
- [GDAL ogr2ogr](https://gdal.org/programs/ogr2ogr.html)
- [Shapely Documentation](https://shapely.readthedocs.io/)
- [VN2000 coordinate system](https://epsg.io/3405)
- [Overpass Turbo](https://overpass-turbo.eu/)
- [Mapshaper - GeoJSON simplification](https://mapshaper.org/)
