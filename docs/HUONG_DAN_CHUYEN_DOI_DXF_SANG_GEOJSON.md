# Hướng dẫn chuyển đổi DXF → GeoJSON

Quy trình xử lý file DXF quy hoạch sử dụng đất thành GeoJSON hiển thị trên web map.

## 1. Yêu cầu

- Docker (chạy GDAL)
- Python 3 với thư viện: `shapely`, `json`, `random`, `collections`

## 2. Chuyển đổi DXF → GeoJSON bằng GDAL

```bash
docker run --rm -v /home/hv/DuAn/Mekong:/data \
  ghcr.io/osgeo/gdal:alpine-normal-latest \
  ogr2ogr -f GeoJSON \
  -s_srs EPSG:32648 \
  -t_srs EPSG:4326 \
  /data/tmp_export.geojson \
  /data/input.dxf \
  -lco COORDINATE_PRECISION=6
```

**Giải thích:**
- `-s_srs EPSG:32648`: DXF gốc ở UTM 48N (meters)
- `-t_srs EPSG:4326`: Xuất ra WGS84 (độ)
- `COORDINATE_PRECISION=6`: Làm tròn đến 6 số lẻ

> **Lưu ý:** DXF không có CRS được định nghĩa trong file, nhưng tọa độ thực tế là UTM 48N. Bắt buộc phải có `-s_srs` nếu không GDAL sẽ báo lỗi.

## 3. Xác định độ dịch chuyển (Shift)

DXF có tọa độ UTM 48N nhưng bị lệch so với WGS84 thực tế. Cần xác định độ dịch bằng cách so sánh với ranh giới OSM.

### 3.1. Tải ranh giới OSM

Dùng Overpass API để tải ranh giới huyện:

```python
import urllib.request, json

# Ví dụ: Càng Long
query = '[out:json][timeout:30];relation(OSM_RELATION_ID);out geom;'
url = 'https://overpass-api.de/api/interpreter'
data = urllib.parse.urlencode({'data': query}).encode()
req = urllib.request.Request(url, data, {'User-Agent': 'curl/8.5', 'Content-Type': 'application/x-www-form-urlencoded'})
resp = urllib.request.urlopen(req, timeout=30)
result = json.loads(resp.read())
# Lưu boundary
```

### 3.2. Grid Search tìm Shift tối ưu

```python
from shapely.geometry import shape, Point
from shapely.affinity import translate
import json

# Load ranh giới OSM
boundary = ...  # shapely Polygon

# Load GeoJSON đã convert
with open('tmp_export.geojson') as f:
    data = json.load(f)

# Grid search
best_shift = None
best_pct = 0

for dlon_off in range(-10, 25, 2):   # -0.010 đến 0.025
    for dlat_off in range(-20, 10, 2):  # -0.020 đến 0.010
        dlon = 0.490 + dlon_off / 1000.0
        dlat = 0.000 + dlat_off / 1000.0
        
        inside = 0
        total = 0
        for feat in data['features']:
            g = feat['geometry']
            if g['type'] != 'Point':
                shp = shape(g)
                shifted = translate(shp, xoff=dlon, yoff=dlat)
                if boundary.contains(shifted.centroid if shifted.geom_type != 'Point' else shifted):
                    inside += 1
                total += 1
        
        pct = inside / total * 100 if total > 0 else 0
        if pct > best_pct:
            best_pct = pct
            best_shift = (dlon, dlat)

print(f"Best shift: Δlon={best_shift[0]:+.3f}°, Δlat={best_shift[1]:+.3f}° → {best_pct:.1f}% centroids inside boundary")
```

**Kết quả đã xác định (cho Trà Vinh):** `SHIFT_LON = 0.501`, `SHIFT_LAT = -0.004`

## 4. Script xử lý hoàn chỉnh

```python
#!/usr/bin/env python3
"""
Process DXF→GeoJSON for web map display:
1. Apply coordinate shift
2. Assign land use codes from text labels
3. Assign colors
4. Sample lines
"""

import json, random
from shapely.geometry import shape, Point, Polygon, MultiPolygon, LineString, MultiLineString
from shapely.affinity import translate
from shapely.strtree import STRtree
from collections import Counter

# ===== CẤU HÌNH =====
SHIFT_LON = 0.501      # Kinh độ
SHIFT_LAT = -0.004     # Vĩ độ
LINE_SAMPLE_SIZE = 2000
RANDOM_SEED = 42
INPUT_FILE = 'tmp_export.geojson'
OUTPUT_FILE = 'output_display.geojson'

# ===== BẢNG MÀU (48 mã) =====
COLORS = {
    'CLN': '#2E7D32', 'LUC': '#42A5F5', 'NTS': '#00ACC1', 'BHK': '#FDD835',
    'LUA': '#64B5F6', 'SKC': '#6D4C41', 'ONT': '#EC407A', 'DGD': '#A1887F',
    'DHT': '#D7CCC8', 'DVH': '#F48FB1', 'TTN': '#FFCC80', 'NTD': '#FFAB91',
    'NKH': '#A5D6A7', 'CQP': '#8D6E63', 'CTS': '#29B6F6', 'DRA': '#0D47A1',
    'DTT': '#FF8A65', 'ODT': '#F48FB1', 'CAN': '#66BB6A', 'DDT': '#F4511E',
    'CSD': '#90A4AE', 'DYT': '#EF9A9A', 'SKX': '#8D6E63', 'RSX': '#1A237E',
    'RPH': '#BDBDBD', 'SKK': '#BDBDBD', 'SON': '#80CBC4', 'COC': '#FFCC80',
    'DTL': '#CE93D8', 'DGT': '#9E9E9E', 'RSM': '#1565C0', 'PNK': '#A1887F',
    'BKS': '#1E88E5', 'DON': '#33691E', 'TMD': '#FF6F00', 'TSC': '#E53935',
    'TIN': '#26C6DA', 'SHT': '#CE93D8', 'DLT': '#7B1FA2', 'DXH': '#F8BBD0',
    'CKH': '#C5E1A5', 'LNK': '#81C784', 'HNK': '#43A047', 'PHT': '#AB47BC',
    'MTC': '#26C6DA', 'GPC': '#AED581', 'NHA': '#FFCC80', 'OTH': '#D7CCC8',
    'TON': '#A1887F', 'DCH': '#BDBDBD', 'RPN': '#D7CCC8', 'DSH': '#CE93D8',
    'DBV': '#F48FB1', 'BCS': '#90A4AE',
}

def safe_shape(gj):
    try: return shape(gj)
    except: return None

# ===== LOAD DỮ LIỆU =====
print("Loading data...")
with open(INPUT_FILE) as f:
    data = json.load(f)
print(f"  Total: {len(data['features'])} features")

# ===== BƯỚC 1: SHIFT TỌA ĐỘ =====
print("Shifting features...")
polys = []    # (feature, shapely_geom)
lines = []    # feature thuần

for feat in data['features']:
    g = feat['geometry']
    if g['type'] in ('Point', 'GeometryCollection'):
        continue
    shp = safe_shape(g)
    if shp is None:
        continue
    shifted = translate(shp, xoff=SHIFT_LON, yoff=SHIFT_LAT)
    gj = shifted.__geo_interface__
    new_feat = {"type": "Feature", "properties": feat.get('properties', {}).copy(), "geometry": gj}
    if shifted.geom_type in ('Polygon', 'MultiPolygon'):
        polys.append((new_feat, shifted))
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
                texts.append({'pt': shifted_pt, 'code': txt.upper()})

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
    unmatched = [i for i, p in enumerate(polys) if not p[0]['properties'].get('_code')]
    for i in unmatched:
        try:
            centroid = poly_shapes[i].centroid
            idxs = text_tree.query_nearest(centroid, 1)
            if len(idxs) > 0 and centroid.distance(texts[idxs[0]]['pt']) < 0.005:
                polys[i][0]['properties']['_code'] = texts[idxs[0]]['code']
        except: pass

matched = sum(1 for p in polys if p[0]['properties'].get('_code'))
print(f"  Matched: {matched}/{len(polys)} ({matched*100/len(polys):.1f}%)")

# ===== BƯỚC 3: GÁN MÀU =====
for p, _ in polys:
    code = p['properties'].get('_code') or 'OTH'
    p['properties']['_color'] = COLORS.get(code, '#BDBDBD')
    p['properties']['_code'] = code

# ===== BƯỚC 4: SAMPLE LINES + GHÉP =====
random.seed(RANDOM_SEED)
sampled_lines = random.sample(lines, min(len(lines), LINE_SAMPLE_SIZE))

all_features = [p[0] for p in polys] + sampled_lines
print(f"Total output: {len(all_features)} features")

with open(OUTPUT_FILE, 'w') as f:
    json.dump({"type": "FeatureCollection", "features": all_features}, f)

# ===== THỐNG KÊ =====
code_counts = Counter(p[0]['properties'].get('_code', '') for p in polys)
print("\n=== PHÂN BỐ LOẠI ĐẤT ===")
for code, count in code_counts.most_common(20):
    color = COLORS.get(code, '#BDBDBD')
    print(f"  {color} {code}: {count}")
```

## 5. Cấu trúc GeoJSON đầu ra

Mỗi feature polygon có properties:

```json
{
  "type": "Feature",
  "properties": {
    "Layer": "Level 30",
    "SubClasses": "AcDbEntity:AcDbHatch",
    "Linetype": "Continuous",
    "EntityHandle": "FA6",
    "Text": "SOLID",
    "_code": "LUC",
    "_color": "#42A5F5"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[106.5432, 9.8503], ...]]
  }
}
```

## 6. Upload lên S3

Dùng upload form trên web:
1. Dataset: `Baseline Environment`
2. Category: `Landuse Planning → <Tên huyện>`
3. File type: chọn **V** (vector)
4. Upload file `.geojson`

File sẽ được lưu tại:
```
gis-data/baseline-environment/<slug-huyện>/2026/vector/<tên_file>.geojson
```

## 7. Ghi chú quan trọng

- **Shift giá trị:** `+0.501°, -0.004°` được xác định bằng grid search cho Châu Thành. Các huyện khác trong cùng tỉnh (cùng nguồn DXF) dùng chung shift này.
- **Mã đất:** Lấy từ layer `Level 33` và `Level 34` (text labels). Tỉ lệ match thường > 95%.
- **Màu sắc:** Map 48 mã đất theo Quyết định 65/2018/QĐ-UBND. Mã không có trong bảng màu sẽ dùng `#BDBDBD` (xám).
- **Lines:** Giữ lại 2000 lines ngẫu nhiên (đường giao thông, ranh giới) để tránh file quá lớn.
