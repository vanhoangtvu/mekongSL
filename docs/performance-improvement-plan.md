# Kế Hoạch Cải Thiện Hiệu Năng Map Raster

**Mục tiêu**: Load dữ liệu < 3 giây, không lag khi pan/zoom, GPU usage thấp.

---

## 🔍 Chẩn Đoán Hiện Tại

### Kiến trúc hiện tại

```
Browser ← HTTP Range → Next.js /api/tif → Spring Boot /api/s3/render → S3
  │                                                                   
  ├── WebGLTileLayer #1 (GeoTIFF source) ← vd: hydro-salinity        
  ├── WebGLTileLayer #2 (GeoTIFF source) ← vd: hydro-temp            
  ├── WebGLTileLayer #3 (GeoTIFF source) ← vd: landuse-class-1       
  └── ... (mỗi dataset = 1 WebGL layer riêng)                        
```

### Bottlenecks chính

| # | Vấn đề | Mức độ | Mô tả |
|---|--------|--------|-------|
| 1 | **File GeoTIFF không có tiling/pyramid** | 🔴 Nặng | Mỗi tile request phải tải metadata + data nguyên khối, không hỗ trợ range request hiệu quả |
| 2 | **Mỗi dataset = 1 WebGL layer riêng** | 🔴 Nặng | 7+ layers × GeoTIFF source = 7× download + 7× decode + 7× draw call |
| 3 | **Proxy không cache** | 🟠 Trung | `Cache-Control: no-store` trước đây (đã fix thành `max-age=86400`) |
| 4 | **Reprojection UTM 48N → Web Mercator** | 🟠 Trung | OL phải reproject từng tile, tốn CPU/GPU |
| 5 | **Không giới hạn zoom** | 🟢 Nhẹ | Layer tải tile ở zoom cao không cần thiết (đã fix `maxZoom: 17`) |
| 6 | **WaitForLayerRender poll GPU** | 🟢 Nhẹ | getData() gây stall pipeline (đã fix 16ms → 200ms) |

---

## 📋 Kế Hoạch Chi Tiết

### Phase 1: Frontend Optimizations (Code, không cần hạ tầng)

#### 1.1 Tối ưu GeoTIFF source configuration
- **File**: `useS3LayerRenderer.ts`
- **Thêm** `cacheSize: 256` vào GeoTIFF source để tăng cache tile trong bộ nhớ
- **Thêm** `blockPoolSize` để tái sử dụng bộ nhớ decode
- **Giảm** thời gian timeout của proxy (60s → 15s để không treo lâu)

#### 1.2 Gộp landuse classification thành single raster
- **Vấn đề**: 7 class riêng = 7 GeoTIFF sources × 7 WebGL layers
- **Giải pháp**: 
  - Tạo 1 GeoTIFF tổng hợp (multi-band hoặc indexed) chứa tất cả classes
  - Dùng `buildClassifiedStyle` với color map multi-class thay vì 1 màu
  - Giảm từ 7 layers → 1 layer
- **Hiệu quả**: Giảm ~85% data transfer + GPU draw calls

#### 1.3 Thêm tile preload
- **File**: `useS3DatasetLayers.ts` / `map-stage.tsx`
- Khi phát hiện người dùng pan theo hướng nào, preload tile hướng đó
- Dùng `ol/source/GeoTIFF` preload option

#### 1.4 WebWorker cho GeoTIFF decoding
- **File**: `lib/workers/geotiff-worker.ts` (tạo mới)
- Di chuyển decode GeoTIFF từ main thread → WebWorker
- Chỉ gửi kết quả (ImageData/array) về main thread để render
- **Hiệu quả**: UI không bị block khi decode file lớn

#### 1.5 Giới hạn zoom động
- Tự động giảm `maxZoom` khi nhiều raster layers active
- Ví dụ: 1 layer → maxZoom 17, 5+ layers → maxZoom 15

---

### Phase 2: Server-Side Tối Ưu (Cần truy cập S3)

#### 2.1 Chuyển GeoTIFF → Cloud Optimized GeoTIFF (COG)
- **Công cụ**: `gdal_translate` / `rio cogeo`
- **Cấu hình**:
  ```bash
  gdal_translate input.tif output_cog.tif \
    -co TILED=YES \
    -co BLOCKXSIZE=256 \
    -co BLOCKYSIZE=256 \
    -co COMPRESS=LZW \
    -co COPY_SRC_OVERVIEWS=YES \
    -of COG
  ```
- **Thêm overviews (pyramid)**:
  ```bash
  gdaladdo -r average output_cog.tif 2 4 8 16
  ```
- **Hiệu quả**: 
  - Tile request chỉ tải 256×256 block thay vì entire strip
  - Overviews cho phép zoom ra xem nhanh mà không cần tải full-res
  - ⏱ Giảm thời gian load từ 5-10s xuống 0.5-1s

#### 2.2 Tối ưu proxy /api/tif
- **File**: `frontend/src/app/api/tif/route.ts` ✅ (đã fix cache)
- **Thêm** cache server-side (ví dụ: Redis hoặc CDN)
- **Thêm** `Accept-Encoding: gzip` để nén dữ liệu
- **Thêm** `X-Cache: HIT/MISS` headers để debug

#### 2.3 Cache headers cho S3 render
- **File**: `backend/.../S3Controller.java`
- Thêm ETag/Last-Modified từ S3 response → cho phép conditional requests (304 Not Modified)

---

### Phase 3: Kiến Trúc Lại Rendering

#### 3.1 Tile server (khuyến nghị cao)
- **Công cụ**: [TiTiler](https://github.com/developmentseed/titiler) (Python) hoặc tự viết
- **Luồng mới**:
  ```
  Browser ← XYZ tiles (PNG/WebP) ← TiTiler ← COG trên S3
  ```
- **Thay** `WebGLTileLayer` với `ol/source/XYZ` mặc định
- **Lợi ích**:
  - Tile đã render sẵn (PNG) → không cần client decode GeoTIFF
  - Kích thước tile nhỏ (~10KB thay vì ~500KB)
  - GPU chỉ cần blit texture, không cần WebGL shader phức tạp
  - Cache CDN dễ dàng

#### 3.2 Dùng Image Layer cho dữ liệu tĩnh
- Cho dataset có `timeScale: "year"` (chỉ thay đổi 1 lần/năm), dùng `ImageLayer` với `ImageStatic` source
- Load 1 ảnh lớn 1 lần, cache đến khi thay đổi năm
- Tránh hàng trăm tile requests không cần thiết

#### 3.3 Giảm số lượng WebGL layers
- Gom các dataset không chồng lấn vào cùng 1 WebGL layer với `style` condition
- Dùng `ol/layer/Group` để quản lý thay vì layer riêng rẽ

---

### Phase 4: CDN & Network

#### 4.1 Thêm CDN (Cloudflare / CloudFront)
- Đặt CDN trước S3 để tile được cache tại edge
- Giảm latency từ 50-100ms xuống 5-10ms

#### 4.2 HTTP/2 multiplexing
- Đảm bảo server hỗ trợ HTTP/2 để request nhiều tile song song qua 1 connection

---

## 📊 Dự Kiến Hiệu Quả

| Cải thiện | Load time | Pan/Zoom | GPU usage | Khó khăn |
|-----------|:---------:|:---------:|:---------:|:--------:|
| **COG + overviews** 🔥 | 0.5-1s | ✅ Mượt | ✅ Thấp | Trung (cần xử lý file) |
| **Gộp layers** | -30% | ✅ Mượt | ✅ Giảm | Thấp |
| **Tile server** | 0.3-0.5s | ✅ Rất mượt | ✅ Rất thấp | Cao (cần deploy service) |
| **WebWorker** | -20% | ✅ Mượt | ⚠️ Ko đổi | Thấp |
| **CDN** | -40% latency | ✅ Mượt | ✅ Ko đổi | Thấp (cấu hình DNS) |

---

## 🎯 Ưu Tiên Thực Hiện

```
Ngay lập tức (1-2 ngày):
  ├── Phase 1.1: cacheSize + blockPoolSize
  ├── Phase 1.2: Gộp landuse layers
  └── Phase 1.5: Giới hạn zoom động

Ngắn hạn (1 tuần):
  ├── Phase 2.1: Chuyển GeoTIFF → COG
  ├── Phase 2.3: ETag/Last-Modified
  └── Phase 1.4: WebWorker

Trung hạn (2-4 tuần):
  ├── Phase 3.1: Triển khai TiTiler
  └── Phase 4.1: CDN

Dài hạn:
  └── Phase 3.2: ImageLayer cho dữ liệu tĩnh
```

---

## 🔧 Công Cụ Cần Chuẩn Bị

- **GDAL** (gdal_translate, gdaladdo, gdalinfo) — cài `apt install gdal-bin`
- **rio-cogeo** — `pip install rio-cogeo`
- **TiTiler** (nếu deploy tile server)
- **cogvalidator** — `pip install cogvalidator` kiểm tra file COG

---

## 📐 Kiểm Tra Kết Quả

```bash
# Kiểm tra file có phải COG không
gdalinfo -stats file.tif | grep -E "BlockSize|Overviews|Tiling"

# Kiểm tra thời gian load
curl -o /dev/null -w "time_total: %{time_total}s, size: %{size_download} bytes\n" \
  "http://localhost:8084/api/s3/download?key=gis-data/.../file.tif"

# Đo FPS trên browser
# Dùng Chrome DevTools → Performance → frame rate
```
