# Hướng Dẫn Triển Khai Mekong WebGIS

## Yêu Cầu Hệ Thống

| Phần mềm | Phiên bản | Mục đích |
|----------|-----------|----------|
| Java | 17+ | Backend Spring Boot |
| Node.js | 20+ | Frontend Next.js + Datacenter |
| MySQL | 8.0+ | Database |
| Python | 3.10+ | TiTiler (tile server) |
| GDAL | 3.6+ | Convert GeoTIFF → COG |

---

## 1. Clone & Cấu Hình

```bash
git clone https://github.com/vanhoangtvu/mekongSL.git Mekong
cd Mekong
```

### File `.env` (thư mục gốc)

```env
# S3 Storage (bắt buộc)
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key

# Mekong API (cho datacenter)
MEKONG_USERNAME=your_username
MEKONG_PASSWORD=your_password
MEKONG_CUSTOMER_CODE=your_code
MEKONG_PROVINCE_CODE=your_province_code
MEKONG_DEVICE_UUID=your_device_uuid

# Ecowitt API (cho datacenter)
ECOWITT_ACCOUNT=your_email@gmail.com
ECOWITT_PASSWORD=your_password
ECOWITT_DEVICE_ID=your_device_id
```

### File `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://your-server-ip:8084/api
NEXT_PUBLIC_SITE_URL=https://mekongsaltlab.org
NEXT_PUBLIC_TITILER_URL=http://your-server-ip:8001
NEXT_PUBLIC_USE_TITILER=false
```

> **Lưu ý**: `NEXT_PUBLIC_API_URL` dùng để frontend gọi backend **trực tiếp** (bỏ qua proxy Next.js), giúp tăng tốc tải tile lên **4 lần**.

---

## 2. Các Dịch Vụ

### 2.1 Backend (Spring Boot, port 8084)

```bash
cd backend
./mvnw clean package -DskipTests
java -jar target/mekongsaltlab-0.0.1-SNAPSHOT.jar
# Hoặc chạy dev:
./mvnw spring-boot:run
```

**CORS**: Backend tự động cho phép các origin:
- `http://localhost:3004`, `http://localhost:3000`
- `http://your-server-ip:3004`
- `https://mekongsaltlab.org`

### 2.2 Frontend (Next.js, port 3004)

```bash
cd frontend
npm install
npm run dev      # Dev mode
# hoặc
npm run build && npm run start  # Production
```

### 2.3 Datacenter (Node.js cron, nền)

```bash
cd datacenter
npm install
node cron-wrapper.mjs    # Chạy nền
```

### 2.4 TiTiler (Tile Server, port 8001) — Tùy chọn

```bash
# Cài đặt
python3 -m venv ~/titiler-env
source ~/titiler-env/bin/activate
pip install titiler uvicorn boto3 python-multipart

# Chạy
cd Mekong && nohup ./scripts/titiler-start.sh > titiler.log 2>&1 &

# Hoặc qua manage.sh → chọn [10]
```

> **Khi nào cần TiTiler?** Khi hiệu năng render raster chưa đạt yêu cầu.  
> TiTiler chuyển GeoTIFF → PNG tile, giảm dung lượng 90%, tăng FPS lên 60.

---

## 3. Quản Lý Với `manage.sh`

```bash
./manage.sh
```

```
┌──────────────────────────────────────────────────────┐
│                  MEKONG MANAGEMENT                   │
├──────────────────────────────────────────────────────┤
│  TRẠNG THÁI HỆ THỐNG                                 │
│  ● Backend  │ 1234  │ 8084  │ ---  │ 2d 3h  │ 256MB │
│  ● Frontend │ 5678  │ 3004  │ Dev  │ 2d 3h  │ 793MB │
│  ● TiTiler  │ 9012  │ 8001  │ Tile │ 5h 12m │ 128MB │
├──────────────────────────────────────────────────────┤
│  [1] Khởi động backend     [6] Build & Restart       │
│  [2] FE Dev mode           [7] Xem log backend       │
│  [3] FE Production mode    [8] Xem log frontend      │
│  [4] Dừng backend          [9] Đổi IP               │
│  [5] Dừng frontend        [10] Start TiTiler         │
│  [C] Auto convert COG     [11] Stop TiTiler          │
│  [0] Thoát                [A] Restart tất cả         │
└──────────────────────────────────────────────────────┘
```

- **Đổi IP** (menu 9): Tự động cập nhật cả frontend + backend CORS
- **Auto convert COG** (menu C): Quét S3, tự động tối ưu file GeoTIFF
- **Restart tất cả** (menu A): Dừng + khởi động lại Backend, Frontend, TiTiler

---

## 4. Tối Ưu Dữ Liệu

### 4.1 Convert GeoTIFF → COG (Tự động)

Script `scripts/auto-cog-watch.sh` tự động quét S3, chuyển GeoTIFF sang COG:

| Dữ liệu | Trước | Sau | Giảm |
|---------|:-----:|:---:|:----:|
| Landuse Classification (35 files) | **227 MB** | **10 MB** | **95%** |
| Landsat Imagery (84 files) | **545 MB** | **134 MB** | **75%** |

File gốc được **giữ nguyên** tại `gis-data/`.  
File COG lưu tại `gis-data/cog/`.

**Crontab** (tự động chạy mỗi 5 phút):
```bash
crontab -e
*/5 * * * * /home/hv/DuAn/Mekong/scripts/auto-cog-watch.sh >> /tmp/auto-cog.log 2>&1
```

### 4.2 Cấu Trúc S3 Sau Tối Ưu

```
S3 Bucket (c01-mekong-prod-01)
├── gis-data/
│   ├── hydrology/           ← Dữ liệu gốc
│   ├── landsat-imagery/     ← Dữ liệu gốc
│   ├── baseline-environment/ ← Dữ liệu gốc
│   ├── cog/                 ← Raster đã tối ưu (COG)
│   └── fgb/                 ← Vector đã tối ưu (hiện không dùng)
├── station-data/            ← Ảnh hiện trường
├── monitoring-data/         ← Dữ liệu giám sát
└── news-images/             ← Ảnh bài viết
```

---

## 5. Thay Đổi Quan Trọng

### Backend

| Thay đổi | Mô tả |
|----------|-------|
| **S3 Pagination** | `listFiles()` giờ hỗ trợ phân trang (trước chỉ lấy 601/953 files, thiếu Tidal) |
| **Public download** | `GET /api/s3/download` cho phép public với prefix `gis-data/`, `station-data/`, `news-images/` |
| **CORS động** | Tự động thêm IP hiện tại vào allowed origins |

### Frontend

| Thay đổi | Mô tả |
|----------|-------|
| **Direct backend URL** | Tile raster gọi thẳng backend (bỏ Next.js proxy), **nhanh hơn 4 lần** |
| **COG path ưu tiên** | Tìm file COG trong `gis-data/cog/` trước, fallback về gốc |
| **Remove fade animation** | Layer hiển thị ngay, không chờ fade |
| **Remove waitForLayerRender** | Không poll GPU, source ready là hiển thị |
| **Cache TIF proxy** | `Cache-Control: public, max-age=86400` |
| **maxZoom: 17** | Giới hạn zoom raster để tránh tải tile không cần thiết |
| **renderOrder vector** | Sắp xếp polygon nhỏ ở trên, lớn ở dưới |
| **Station marker labels** | Hiển thị mã trạm trên marker (vd: SL 7) |
| **Inspector** | Hiển thị đầy đủ tên layer cha→con, tọa độ UTM 48N |
| **Fix infinite loop** | Dùng ref cho mouseCoords trong pointermove handler |

### Scripts

| Script | Chức năng |
|--------|-----------|
| `manage.sh` | Quản lý tất cả dịch vụ (có menu) |
| `scripts/auto-cog-watch.sh` | Tự động convert GeoTIFF → COG |
| `scripts/convert-to-cog.sh` | Convert 1 file thủ công |
| `scripts/titiler-start.sh` | Khởi động TiTiler tile server |

---

## 6. Kiểm Tra Sau Khi Chạy

```bash
# Backend
curl http://localhost:8084/api/s3/download?key=station-data/test.jpeg
# → 404 (file không tồn tại nhưng backend hoạt động)

# Frontend
curl http://localhost:3004/
# → 200 (trang chủ)

# Datacenter
tail -f datacenter/logs/fetch-*.log
# → Dữ liệu được fetch định kỳ

# TiTiler (nếu bật)
curl http://localhost:8001/
# → {"title":"TiTiler",...}

# S3 list (kiểm tra pagination)
curl http://localhost:8084/api/s3/list?prefix=gis-data/
# → Phải trả về ĐỦ 953+ files (không thiếu Tidal)
```

---

## 7. Xử Lý Sự Cố

| Vấn đề | Nguyên nhân | Fix |
|--------|------------|-----|
| 403 khi tải ảnh station | Backend chưa được restart sau khi fix security | `./manage.sh` → [6] Build & Restart |
| Thiếu Tidal trong danh sách | Backend chưa có pagination fix | `./manage.sh` → [6] Build & Restart |
| File vẫn 6.5MB (chậm) | File chưa được convert COG | `./manage.sh` → [C] Auto convert |
| Frontend lỗi "Maximum update depth" | Cache cũ | `Ctrl+Shift+R` hard reload |
| TiTiler không start | Thiếu Python packages | `pip install titiler uvicorn` |

---

## 8. Triển Khai Nhanh (Sau Khi Git Pull)

```bash
# 1. Clone/cập nhật code
git pull

# 2. Cấu hình
cp .env.example .env
# Sửa .env với thông tin của bạn

# 3. Cài đặt dependencies
cd frontend && npm install && cd ..
cd datacenter && npm install && cd ..

# 4. Build backend
cd backend && ./mvnw clean package -DskipTests && cd ..

# 5. Chạy tất cả
./manage.sh
# → Chọn [A] Restart tất cả
# → Chọn [C] Auto convert COG (nếu có dữ liệu mới)
```

---

## 9. Liên Hệ

Phát triển bởi **hoangtvu** · [github.com/vanhoangtvu](https://github.com/vanhoangtvu)
