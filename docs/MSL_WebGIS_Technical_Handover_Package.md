# MSL WebGIS Technical Handover Package

## Gói Kỹ Thuật Số Bàn Giao Hệ Thống

**Tên đề xuất:** Gói kỹ thuật số bàn giao hệ thống WebGIS Mekong Salt Lab  
**Tên tiếng Anh:** Digital Technical Handover Package  
**Tên thư mục:** `MSL_WebGIS_Technical_Handover_Package`  
**Phiên bản:** 1.0 | **Cập nhật:** 25/07/2026

---

## Mục lục

- [Giới thiệu](#giới-thiệu)
- [Cấu trúc gói bàn giao](#cấu-trúc-gói-bàn-giao)
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
- [Thông tin hệ thống](#thông-tin-hệ-thống)
- [Liên hệ](#liên-hệ)

---

## Giới thiệu

Gói kỹ thuật số bàn giao hệ thống (Digital Technical Handover Package) là tập hợp toàn bộ mã nguồn, dữ liệu, tài liệu và cấu hình của hệ thống WebGIS MekongSaltLab. Gói này được đóng gói nhằm mục đích bàn giao cho đơn vị tiếp quản vận hành và bảo trì hệ thống sau dự án.

Gói bàn giao bao gồm **10 thư mục** chính, mỗi thư mục chứa một thành phần cụ thể của hệ thống.

---

## Cấu trúc gói bàn giao

```
MSL_WebGIS_Technical_Handover_Package/
│
├── 01_Source_Code/                  # Mã nguồn toàn bộ hệ thống
├── 02_Database_Backup/              # File sao lưu cơ sở dữ liệu
├── 03_GIS_Data/                     # Dữ liệu GIS (raster & vector)
├── 04_Monitoring_Data/              # Dữ liệu quan trắc môi trường
├── 05_Images_and_Documents/         # Ảnh hiện trường và tài liệu
├── 06_System_Configuration/         # Cấu hình hệ thống
├── 07_Installation_Instructions/    # Hướng dẫn cài đặt
├── 08_Backup_and_Recovery/          # Quy trình sao lưu và phục hồi
├── 09_Admin_Account_Handover/       # Thông tin tài khoản quản trị
└── 10_Version_and_File_Manifest/    # Phiên bản và danh mục file
```

---

### 01_Source_Code

**Mã nguồn toàn bộ hệ thống**

Thư mục này chứa toàn bộ mã nguồn của hệ thống MekongSaltLab, bao gồm cả Frontend và Backend.

| Thành phần | Công nghệ | Mô tả |
|-----------|-----------|-------|
| **Frontend** | Next.js 15 + React 19 + TypeScript 5.8 | Giao diện người dùng, bản đồ OpenLayers 10.9 |
| **Backend** | Java 17 + Spring Boot 4.0.6 | API RESTful, xử lý dữ liệu |
| **Database Scripts** | MySQL 8.0 + Flyway | Migration scripts (V001-V005) |
| **GIS Scripts** | Python + GDAL | Chuyển đổi COG, tối ưu raster |

**Cấu trúc thư mục:**

| Đường dẫn | Mô tả |
|-----------|-------|
| `frontend/` | Mã nguồn Frontend (Next.js) |
| `frontend/src/app/` | Các page và route |
| `frontend/src/components/` | Component React tái sử dụng |
| `frontend/src/features/` | Feature modules (map, admin, news...) |
| `frontend/src/lib/` | Thư viện và utilities |
| `backend/` | Mã nguồn Backend (Spring Boot) |
| `backend/src/main/java/` | Java source code |
| `backend/src/main/resources/` | Cấu hình (application.yaml) |
| `backend/db/mysql/` | Database migration scripts |
| `datacenter/` | Scripts xử lý dữ liệu tự động |
| `scripts/` | Scripts GIS và tiện ích |
| `docs/` | Tài liệu dự án |

**Cách clone mã nguồn:**

```bash
git clone https://github.com/vanhoangtvu/mekongSL.git
cd mekongSL
```

**Số liệu thống kê:**
- Tổng số commit: 122
- Tổng số file: 308
- Thời gian phát triển: 25/05/2026 → 20/07/2026 (56 ngày)

---

### 02_Database_Backup

**File sao lưu cơ sở dữ liệu**

Thư mục này chứa các file backup cơ sở dữ liệu MySQL được tạo tự động hàng ngày.

| Thông tin | Giá trị |
|-----------|---------|
| **Hệ quản trị CSDL** | MySQL 8.0 |
| **Tên database** | `mekong` |
| **Cơ chế backup** | Tự động hàng ngày lúc 00:00 + thủ công qua Trigger Backup |
| **Định dạng file** | `.sql.gz` (dump SQL nén GZip) |
| **Nơi lưu trữ** | S3 bucket, prefix `backup/` |
| **Dung lượng** | Phụ thuộc vào lượng dữ liệu (thường từ 5-50 MB) |

**Ví dụ tên file backup:**
```
backup/mekong-20260725_000000.sql.gz
backup/mekong-20260726_000000.sql.gz
backup/mekong-20260727_000000.sql.gz
```

**Các bảng chính trong database:**

| Bảng | Mô tả | Số dòng (ước tính) |
|------|-------|:------------------:|
| `users` | Tài khoản người dùng | 5-10 |
| `articles` | Bài viết tin tức | 10-20 |
| `gis_layers` | Lớp dữ liệu GIS | 10-15 |
| `gis_datasets` | Dataset GIS | 50-60 |
| `manual_stations` | Trạm quan trắc thủ công | 20-25 |
| `water_quality_samples` | Mẫu chất lượng nước | 100-500 |
| `ecowitt_data` | Dữ liệu thời tiết Ecowitt | 10.000+ |
| `mekong_sensor_data` | Dữ liệu cảm biến Mekong | 10.000+ |
| `landuse_statistics` | Thống kê sử dụng đất | 50-100 |

---

### 03_GIS_Data

**Dữ liệu GIS (Raster & Vector)**

Thư mục này chứa toàn bộ dữ liệu không gian địa lý đã được import và tối ưu trên hệ thống.

**Thống kê tổng quan:**

| Loại dữ liệu | Số file | Dung lượng | Ghi chú |
|-------------|:-------:|:----------:|---------|
| Hydrology - Salinity | 286 | 8.5 MB | Dữ liệu độ mặn realtime |
| Hydrology - pH | 282 | 8.5 MB | Dữ liệu pH realtime |
| Hydrology - Tidal | 270 | 8.2 MB | Dữ liệu thủy triều realtime |
| Landsat Band 1-7 | 84 | 135 MB (COG) | Tối ưu từ 546 MB |
| Landuse Classification | 35 | 10 MB (COG) | Tối ưu từ 227 MB |
| Landuse Planning | 3 | 18.4 MB | DXF → GeoJSON (9 huyện) |
| Channel System | 16 | 6.6 MB | Hệ thống kênh rạch |
| Administration | 6 | 0.5 MB | Ranh giới hành chính |
| Flooding Modeling | 2 | 13.0 MB | Mô hình ngập lụt |
| **Tổng cộng** | **1.126** | **765 MB** | |

**Cấu trúc thư mục trên S3:**

| Đường dẫn | Nội dung |
|-----------|----------|
| `gis-data/landsat/band1/` đến `band7/` | Ảnh vệ tinh Landsat từng band |
| `gis-data/landsat/composite/` | Ảnh RGB tổng hợp (đang chờ) |
| `gis-data/administration/province/` | Ranh giới tỉnh |
| `gis-data/administration/commune/` | Ranh giới xã |
| `gis-data/administration/hamlet/` | Ranh giới ấp |
| `gis-data/baseline/landuse-planning/` | Quy hoạch sử dụng đất (9 huyện) |
| `gis-data/baseline/soil-type/` | Bản đồ loại đất |
| `gis-data/baseline/channel/` | Hệ thống kênh rạch |
| `gis-data/baseline/ground-water/` | Nước ngầm |
| `gis-data/baseline/road/` | Đường giao thông |
| `gis-data/baseline/landuse-classification/` | Phân loại sử dụng đất (7 loại) |
| `gis-data/ecology/` | Dữ liệu sinh thái |
| `gis-data/flooding/` | Mô hình ngập lụt |
| `gis-data/hydrology/salinity/` | Độ mặn |
| `gis-data/hydrology/ph/` | Độ pH |
| `gis-data/hydrology/tidal/` | Thủy triều |

**Hệ tọa độ:**
- Raster: EPSG:32648 (UTM zone 48N)
- Vector: EPSG:32648 (UTM zone 48N)
- Điểm đo (Weather, WQ): EPSG:4326 (WGS84)

**Tối ưu COG:**
119 file GeoTIFF đã được chuyển đổi sang Cloud Optimized GeoTIFF (COG):
- Kích thước tile: 256×256
- Nén: DEFLATE
- Overviews: Có
- Giảm dung lượng: 81% (từ 773 MB xuống 145 MB)

---

### 04_Monitoring_Data

**Dữ liệu quan trắc môi trường**

Thư mục này chứa dữ liệu từ các trạm quan trắc tự động và thủ công.

**Dữ liệu thời tiết Ecowitt:**

| Thông số | Tần suất | Nguồn |
|----------|:--------:|-------|
| Nhiệt độ, độ ẩm, tốc độ gió, hướng gió, lượng mưa, áp suất, bức xạ mặt trời, chỉ số UV | 15 phút/lần | API Ecowitt |

**Số trạm Ecowitt:** 3 trạm (EW-TV-01, EW-TV-02, EW-TV-03)

**Dữ liệu thủy văn Mekong API:**

| Thông số | Tần suất | Nguồn |
|----------|:--------:|-------|
| Độ mặn (Salinity), độ pH, mực nước, độ kiềm | 5 lần/ngày (00:00, 05:00, 10:00, 15:00, 20:00) | API Rynan Mobile |

**Dữ liệu chất lượng nước thủ công:**

| Loại | Số trạm | Thông số |
|:----:|:-------:|----------|
| Nước mặt (Surface Water) | 16 | pH, EC, Salinity, DO, TDS, Turbidity, NH4+, NO3-... |
| Nước ngầm (Ground Water) | 4 | pH, EC, Salinity, DO, TDS... |

**Cấu trúc lưu trữ trên S3:**

| Đường dẫn | Nội dung |
|-----------|----------|
| `station-data/manual-stations/` | Ảnh hiện trường trạm thủ công |
| `station-data/{stationCode}/...` | Dữ liệu CSV trạm thủ công |
| `monitoring-data/{stationCode}/...` | Dữ liệu CSV trạm tự động |

---

### 05_Images_and_Documents

**Ảnh hiện trường và tài liệu**

Thư mục này chứa ảnh chụp hiện trường các trạm quan trắc và toàn bộ tài liệu dự án.

**Ảnh hiện trường:**
- Lưu trữ tại S3: `station-data/manual-stations/`
- Định dạng: JPEG
- Quyền truy cập: Public
- Số lượng: Theo số trạm đã thiết lập

**Tài liệu dự án (docs/):**

| File | Mô tả |
|------|-------|
| `README.md` | Tổng quan dự án |
| `DEPLOY.md` | Hướng dẫn triển khai |
| `huong-dan-su-dung-nguoi-dung.md` | Hướng dẫn sử dụng (mục lục) |
| `huong-dan-su-dung-nguoi-dung-role-USER.md` | Hướng dẫn vai trò USER |
| `huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md` | Hướng dẫn vai trò DATA_MANAGER |
| `huong-dan-su-dung-nguoi-dung-role-ADMIN.md` | Hướng dẫn vai trò ADMIN |
| `project-report.md` | Báo cáo dự án (Hoàng) |
| `project-report-duy.md` | Báo cáo dự án (Duy) |
| `MSL_WebGIS_User_and_Administration_Manual.md` | Sổ tay hướng dẫn (SP2) |
| `MSL_WebGIS_User_and_Administration_Manual_EN.md` | Sổ tay hướng dẫn tiếng Anh |
| `MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx` | Danh mục dữ liệu (SP3) |
| `MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx` | Hồ sơ kiểm thử (SP4) |
| `MSL_WebGIS_Technical_Handover_Package.md` | Gói bàn giao (SP5) |
| `api-auth.md` | Xác thực API |
| `backup-strategy.md` | Chiến lược sao lưu |
| `data-upload.md` | Upload dữ liệu |
| `deployment.md` | Triển khai hệ thống |
| `roles.md` | Phân quyền |
| `s3-storage.md` | Lưu trữ S3 |
| `security.md` | Bảo mật |
| `mekong-data-import.md` | Import dữ liệu Mekong |

**Hình ảnh giao diện (sẽ chụp bổ sung):**

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

**Cấu hình hệ thống**

Thư mục này chứa các file cấu hình quan trọng của hệ thống.

**File cấu hình Backend (`application.yaml`):**

| Tham số | Mô tả | Ghi chú |
|---------|-------|---------|
| `spring.datasource.url` | Kết nối MySQL | `jdbc:mysql://localhost:3306/mekong` |
| `spring.datasource.username` | Tên đăng nhập MySQL | `root` |
| `spring.datasource.password` | Mật khẩu MySQL | Thay đổi khi triển khai |
| `jwt.secret` | Khóa bí mật JWT | Thay đổi khi triển khai production |
| `jwt.expiration` | Thời hạn token | Mặc định: 24h |
| `s3.endpoint` | Endpoint S3 | `https://backup.hci.vn` |
| `s3.accessKey` | Access key S3 | Cấu hình trong `.env` |
| `s3.secretKey` | Secret key S3 | Cấu hình trong `.env` |
| `s3.bucket` | Bucket name | Biến môi trường |
| `cors.allowedOrigins` | Các origin được phép | Danh sách IP/domain |

**File cấu hình Frontend (`.env.local`):**

| Tham số | Mô tả |
|---------|-------|
| `NEXT_PUBLIC_API_URL` | URL backend API |
| `NEXT_PUBLIC_S3_ENDPOINT` | Endpoint S3 |
| `NEXT_PUBLIC_MAP_CENTER` | Tọa độ trung tâm bản đồ |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | Zoom mặc định |

**Script quản lý hệ thống (`manage.sh`):**

Script quản lý tập trung với menu các chức năng:
1. Khởi động Backend
2. Khởi động Frontend
3. Dừng Backend
4. Dừng Frontend
5. Xem trạng thái
6. Build Backend
7. Build Frontend
8. Restart all services
9. Đổi IP
10. Xem log

---

### 07_Installation_Instructions

**Hướng dẫn cài đặt**

Thư mục này chứa hướng dẫn chi tiết để cài đặt và triển khai hệ thống từ đầu.

**Yêu cầu hệ thống:**

| Thành phần | Yêu cầu |
|-----------|---------|
| **Hệ điều hành** | Linux (Ubuntu 20.04+/CentOS 7+) |
| **CPU** | Tối thiểu 2 cores |
| **RAM** | Tối thiểu 4 GB |
| **Ổ đĩa** | Tối thiểu 20 GB |
| **Java** | JDK 17 |
| **Node.js** | 18.x trở lên |
| **MySQL** | 8.0 trở lên |
| **Python** | 3.8 trở lên (cho GDAL) |
| **Nginx** | (Tùy chọn, cho HTTPS) |

**Quy trình cài đặt tóm tắt:**

1. **Cài đặt môi trường:**
   ```bash
   # Cài đặt Java 17
   apt-get install openjdk-17-jdk
   
   # Cài đặt Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt-get install nodejs
   
   # Cài đặt MySQL 8
   apt-get install mysql-server-8.0
   
   # Cài đặt Python + GDAL
   apt-get install python3-pip gdal-bin
   ```

2. **Clone mã nguồn:**
   ```bash
   git clone https://github.com/vanhoangtvu/mekongSL.git
   cd mekongSL
   ```

3. **Cấu hình Backend:**
   - Copy `.env.example` thành `.env`
   - Điền thông tin S3, database
   - Build: `cd backend && ./mvnw clean package -DskipTests`

4. **Cấu hình Frontend:**
   - Copy `.env.example` thành `.env.local`
   - Điền `NEXT_PUBLIC_API_URL`
   - Build: `cd frontend && npm install && npm run build`

5. **Khởi động hệ thống:**
   ```bash
   ./manage.sh
   ```
   Chọn menu 1 (Start Backend) và 2 (Start Frontend)

6. **Cấu hình Nginx (cho HTTPS):**
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

**Quy trình sao lưu và phục hồi**

Thư mục này chứa tài liệu và script liên quan đến sao lưu và phục hồi hệ thống.

**Sao lưu tự động:**

| Thông số | Giá trị |
|----------|---------|
| **Cơ chế** | Spring `@Scheduled` trong `BackupService.java` |
| **Lịch chạy** | Mỗi ngày lúc 00:00 |
| **Nội dung** | Toàn bộ database MySQL |
| **Định dạng** | `backup/mekong-{yyyyMMdd}_{HHmmss}.sql.gz` |
| **Nơi lưu** | S3 bucket, prefix `backup/` |

**Sao lưu thủ công:**
1. Đăng nhập với tài khoản ADMIN
2. Vào tab **Overview**
3. Nhấn nút **Trigger Backup**

**Phục hồi dữ liệu:**
```bash
# Bước 1: Tải file backup từ S3
# (tải qua tab Storage hoặc dùng AWS CLI)

# Bước 2: Giải nén
gunzip backup/mekong-20260725_000000.sql.gz

# Bước 3: Import vào MySQL
mysql -u root -p mekong < mekong-20260725_000000.sql
```

**Lịch trình bảo trì:**

| Tác vụ | Tần suất | Mô tả |
|--------|:--------:|-------|
| Kiểm tra backup | Hàng ngày | Đảm bảo file backup được tạo |
| Xóa backup cũ | Hàng tháng | Giữ lại 30 ngày gần nhất |
| Tải backup về máy | Hàng tuần | Dự phòng ngoại tuyến |
| Kiểm tra phục hồi | Hàng quý | Thử nghiệm phục hồi trên môi trường test |

---

### 09_Admin_Account_Handover

**Thông tin tài khoản quản trị**

Thư mục này chứa thông tin tài khoản quản trị hệ thống. **Lưu ý: Tài liệu này cần được bảo mật tuyệt đối.**

**Tài khoản mặc định:**

| Vai trò | Username | Password | Mô tả |
|---------|----------|----------|-------|
| **ADMIN** | `admin` | `admin123` | Quản trị viên toàn quyền |
| **DATA_MANAGER** | `manager` | `manager123` | Quản lý dữ liệu |
| **USER** | `user` | `user123` | Người dùng thường |

> **Lưu ý:** Đổi mật khẩu ngay sau khi nhận bàn giao!

**Tài khoản hệ thống:**

| Hệ thống | URL | Username | Ghi chú |
|----------|-----|----------|---------|
| **Server SSH** | `123.22.61.134` | Cung cấp riêng | Truy cập server |
| **MySQL** | `localhost:3306` | `root` | Database `mekong` |
| **S3 Storage** | `backup.hci.vn` | Cung cấp riêng | S3-compatible |
| **GitHub** | `github.com/vanhoangtvu/mekongSL` | Cung cấp riêng | Mã nguồn |
| **Ecowitt API** | `api.ecowitt.net` | Cung cấp riêng | Dữ liệu thời tiết |
| **Mekong API** | API Rynan Mobile | Cung cấp riêng | Dữ liệu thủy văn |
| **Domain** | `mekongsaltlab.org` | Cung cấp riêng | Tên miền |

**Danh sách quyền cần bàn giao:**
- [ ] Quyền truy cập server (SSH key / password)
- [ ] Quyền quản trị MySQL (root)
- [ ] Quyền truy cập S3 (access key + secret key)
- [ ] Quyền truy cập GitHub repository
- [ ] Quyền quản lý tên miền
- [ ] API keys (Ecowitt, Mekong)
- [ ] SSL/TLS certificates

---

### 10_Version_and_File_Manifest

**Phiên bản và danh mục file**

Thư mục này chứa thông tin về phiên bản hệ thống và danh mục toàn bộ file trong gói bàn giao.

**Thông tin phiên bản:**

| Thành phần | Phiên bản |
|-----------|:---------:|
| **Hệ thống** | 1.0.0 |
| **Frontend** | 1.0.0 |
| **Backend** | 1.0.0 |
| **Database Schema** | V005 |
| **API** | v1 |

**File manifest - Danh mục các package và thư viện:**

**Frontend (package.json):**

| Package | Phiên bản | Mục đích |
|---------|:---------:|----------|
| next | 15 | Framework React |
| react | 19 | UI library |
| typescript | 5.8 | Static typing |
| ol (OpenLayers) | 10.9 | Bản đồ tương tác |
| recharts | 3.8 | Biểu đồ |
| xlsx | 0.18.5 | Xử lý Excel |
| axios | 1.x | HTTP client |
| tailwindcss | 4.x | CSS framework |

**Backend (pom.xml):**

| Package | Phiên bản | Mục đích |
|---------|:---------:|----------|
| Spring Boot | 4.0.6 | Framework |
| Spring Security | 6.x | Xác thực + phân quyền |
| JPA / Hibernate | 7.x | ORM |
| jjwt (JWT) | 0.12.3 | Token authentication |
| AWS SDK S3 | 2.20.26 | S3 client |
| Apache POI | 5.2.5 | Xử lý Excel |
| Lombok | 1.x | Boilerplate code |
| Flyway | 9.x | Database migration |

**Database:** MySQL 8.0, 18+ tables

---

## Thông tin hệ thống

| Thông tin | Giá trị |
|-----------|---------|
| **Tên dự án** | MekongSaltLab |
| **Mô tả** | Hệ thống bản đồ số giám sát môi trường Đồng bằng sông Cửu Long |
| **URL Frontend** | `https://mekongsaltlab.org` |
| **URL Backend API** | `http://103.54.251.212:8084` |
| **Swagger** | `https://mekongsaltlab.org/swagger-ui/` |
| **Server IP** | `123.22.61.134` |
| **Đơn vị phát triển** | Nguyễn Vắn Hoàng & Nguyễn Lê Duy |
| **Ngày bắt đầu** | 01/05/2026 |
| **Ngày kết thúc** | 31/07/2026 |

---

## Liên hệ

| Thành viên | Vai trò | Email |
|-----------|---------|-------|
| Nguyễn Vắn Hoàng | Phát triển WebGIS | Liên hệ qua trang About |
| Nguyễn Lê Duy | Phát triển WebGIS | Liên hệ qua trang About |

---

*Bản quyền 2026 MekongSaltLab. Gói kỹ thuật số bàn giao hệ thống WebGIS – Phiên bản 1.0.*  
*Tài liệu do Hoàng và Duy lập bản thảo.*
