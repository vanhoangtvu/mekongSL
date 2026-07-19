# Kế Hoạch Tối Ưu Landuse Planning (Vector)

## Hiện Trạng

| Chỉ số | Giá trị |
|--------|---------|
| File | `dxf_display.geojson` |
| Dung lượng | **11.2 MB** |
| Features | **10,993** (8,972 Polygon, 1,983 LineString, ...) |
| Loại | Vector (GeoJSON) |
| Render | OpenLayers VectorLayer + Canvas |
| Thời gian load | 5-15 giây (download + parse + render) |

## Vấn Đề

1. **File lớn** (11.2 MB) → download chậm
2. **Parse JSON client-side** → CPU nặng, block UI
3. **11K features render cùng lúc** → Canvas overload, lag khi pan/zoom

## Kế Hoạch Tối Ưu (3 Phase)

### Phase 1: Nén + Tối ưu Frontend (Ngay lập tức, 1 ngày)

#### 1.1 Nén GeoJSON với gzip
- Bật gzip compression trên proxy `/api/tif` → giảm 11MB → ~2-3MB
- Thêm `Content-Encoding: gzip` vào response

#### 1.2 Giảm precision tọa độ
```bash
# Giảm từ ~15 chữ số thập phân → 6 (độ chính xác ~0.1m)
ogr2ogr -f GeoJSON output.geojson input.geojson -lco COORDINATE_PRECISION=6
```
- File giảm: 11MB → ~7MB

#### 1.3 Tối ưu style function
- Hiện tại: `landuseStyleFunction` được gọi cho từng feature (10,993 lần)
- Fix: dùng `style cache` (đã có `landuseStyleCache`), tối ưu thêm

#### 1.4 Thêm `renderBuffer` và `renderOrder`
- Giảm số lượng feature render lại khi pan

### Phase 2: FlatGeobuf (1-2 ngày)

FlatGeobuf là định dạng binary, không cần parse JSON, load nhanh hơn 10x.

```bash
# Convert GeoJSON → FlatGeobuf
ogr2ogr -f FlatGeobuf output.fgb input.geojson
```

**Kết quả dự kiến:**
| Format | Size | Parse time |
|--------|:----:|:----------:|
| GeoJSON (hiện tại) | 11.2 MB | ~500ms |
| GeoJSON + gzip | ~2.5 MB | ~500ms |
| **FlatGeobuf** | **~8 MB** | **~20ms** |

**Frontend thay đổi:**
```typescript
// Dùng FlatGeobuf source thay vì GeoJSON
import FlatGeobuf from 'ol/format/FlatGeobuf';
// OL tự động parse, rất nhanh
```

### Phase 3: Vector Tiles (MVT) (2-3 ngày, tối ưu nhất)

Chia nhỏ dữ liệu thành các tile 256×256, chỉ tải tile nào cần.

```bash
# Dùng Tippecanoe
tippecanoe -o output.mbtiles -zg -l landuse input.geojson
# Trích xuất MVT tiles
mb-util output.mbtiles tiles/
```

**Kết quả dự kiến:**
| Chỉ số | Hiện tại | MVT |
|--------|:--------:|:---:|
| Lần đầu load | 11.2 MB | **~500 KB** (chỉ tile đầu tiên) |
| Pan/Zoom | Lag (11K features) | **60fps** (chỉ render tile visible) |
| Server | Không đổi | Cần tile server hoặc static tiles |

## Ưu Tiên

```
Ngay lập tức: Phase 1 (gzip + precision)
   ├── Chỉ cần sửa proxy, chạy 1 lệnh ogr2ogr
   └── Hiệu quả: 11MB → ~2.5MB (-77%)

Ngắn hạn: Phase 2 (FlatGeobuf)
   ├── Frontend cần thêm ol/format/FlatGeobuf
   └── Hiệu quả: parse 500ms → 20ms

Trung hạn: Phase 3 (MVT)
   ├── Cần tiling server hoặc script
   └── Hiệu quả: load 500KB thay vì 11MB, 60fps
```

## Công Cụ Cần Cài

```bash
# GDAL (đã có)
apt install gdal-bin

# Tippecanoe (cho MVT)
apt install tippecanoe
# hoặc build từ source
```
