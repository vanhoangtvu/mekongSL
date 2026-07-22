<br/>
<div align="center">

# BÁO CÁO KẾT QUẢ BÀN GIAO

## 🌊 Hệ thống bản đồ số giám sát môi trường Đồng bằng sông Cửu Long

---

**Tên dự án:** Mekongsaltlab
**Đơn vị phát triển:** Nguyễn Lê Duy
**Thời gian thực hiện:** 01/05/2026 → 31/07/2026
**Ngày lập báo cáo:** 21/07/2026  
</div>

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
   - 1.1. [Thông tin dự án](#11-thông-tin-dự-án)
   - 1.2. [Mục tiêu](#12-mục-tiêu)
   - 1.3. [Phạm vi](#13-phạm-vi)
   - 1.4. [Kết quả bàn giao](#14-kết-quả-bàn-giao)
       - 1.4.1. [Bàn giao các module WebGIS](#141-bàn-giao-các-module-webgis)
       - 1.4.2. [Import dữ liệu GIS và khởi chạy hệ thống WebGIS](#142-import-dữ-liệu-gis-và-khởi-chạy-hệ-thống-webgis)
       - 1.4.3. [Thiết lập hình ảnh các trạm đo](#143-thiết-lập-hình-ảnh-các-trạm-đo)
       - 1.4.4. [Lưu trữ và truy xuất dữ liệu các trạm thời tiết](#144-lưu-trữ-và-truy-xuất-dữ-liệu-các-trạm-thời-tiết)
   - 1.5. [Danh mục hồ sơ bàn giao](#15-danh-mục-hồ-sơ-bàn-giao)
2. [Công nghệ sử dụng](#2-công-nghệ-sử-dụng)
3. [Các lỗi đã xử lý](#3-các-lỗi-đã-xử-lý)
4. [Bảng tóm tắt công việc](#4-bảng-tóm-tắt-công-việc)
5. [Kết luận](#5-kết-luận)

---

## Giới thiệu cách đọc báo cáo

Báo cáo này được viết theo 2 lớp:

1. **📖 Lớp phổ thông** — dành cho người không chuyên về CNTT. Dùng ngôn ngữ đời thường, giải thích rõ các khái niệm.
2. **⚙️ Lớp chuyên ngành** — dành cho kỹ thuật viên, lập trình viên. Có thông số kỹ thuật, tên công nghệ, cấu hình chi tiết.

> **Mẹo đọc:** Nếu bạn không rành về IT, hãy đọc phần mô tả bằng chữ thường. Phần có code (`chữ như thế này`) hoặc bảng công nghệ là dành cho kỹ thuật.

### Giải thích từ ngữ

| Thuật ngữ | Giải thích đơn giản | Giải thích kỹ thuật |
|-----------|--------------------|--------------------|
| **WebGIS** | Trang web có bản đồ tương tác, xem được dữ liệu không gian (sông, rạch, đất đai) trên bản đồ | Hệ thống thông tin địa lý trên nền web, sử dụng OpenLayers 10.9 |
| **Frontend** | Phần giao diện người dùng nhìn thấy (màn hình, nút bấm, bản đồ) | Ứng dụng Next.js 15 + React 19 chạy trên trình duyệt |
| **Backend** | Phần xử lý phía server, nơi chứa dữ liệu và các quy tắc nghiệp vụ | Spring Boot 4.0 REST API, Java 17 |
| **API** | Cầu nối để các phần mềm giao tiếp với nhau | RESTful API, JSON format |
| **S3** | Kho chứa file tập trung (giống Google Drive nhưng dùng cho hệ thống) | S3-compatible object storage (backup.hci.vn) |
| **GeoTIFF** | File ảnh có kèm thông tin tọa độ bản đồ | File raster GeoTIFF, hỗ trợ UTM 48N |
| **COG** | File ảnh đã được tối ưu, xem nhanh hơn trên bản đồ | Cloud Optimized GeoTIFF (tiled, nén, có overviews) |
| **GeoJSON** | File dữ liệu bản đồ dạng text, mô tả các đối tượng (sông, đường, nhà) | Định dạng vector JSON cho dữ liệu không gian |
| **DXF** | File bản vẽ kỹ thuật từ AutoCAD | Định dạng CAD, đã chuyển sang GeoJSON |
| **JWT** | Thẻ định danh điện tử, dùng để xác thực người dùng | JSON Web Token, 24h expiration |
| **UTM 48N** | Hệ tọa độ bản đồ dùng cho khu vực Đồng bằng sông Cửu Long | EPSG:32648, UTM zone 48N |

---

## 1. Tổng quan dự án

### 1.1. Thông tin dự án

| Mục | Chi tiết |
|-----|----------|
| **Tên dự án** | Mekongsaltlab |
| **Mô tả** | Trang web bản đồ số giúp theo dõi, xem và phân tích dữ liệu sông nước, thời tiết, môi trường tại Đồng bằng sông Cửu Long. Dành cho cán bộ quản lý tài nguyên nước, nhà nghiên cứu và người dân quan tâm. |
| **Đơn vị phát triển** | Nguyễn Lê Duy |
| **Số lượng commit** | 122 commits |
| **Tổng số file** | 308 files |
| **Ngày bắt đầu** | 01/05/2026 |
| **Ngày kết thúc** | 31/07/2026 |

### 1.2. Mục tiêu

Xây dựng WebGIS giám sát dữ liệu tài nguyên nước, thủy văn và môi trường Đồng bằng sông Cửu Long, tỉnh Trà Vinh.

### 1.3. Phạm vi

| Thành phần | Mô tả dễ hiểu | Chi tiết kỹ thuật |
|------------|--------------|-------------------|
| **Frontend** (giao diện) | Trang web hiển thị bản đồ, được xây dựng bằng công nghệ web hiện đại | Next.js 15 + React 19 + OpenLayers 10.9 |
| **Backend** (xử lý) | Máy chủ chứa dữ liệu và xử lý các yêu cầu từ trang web | Spring Boot 4.0, Java 17 |
| **Storage** (kho chứa file) | Nơi lưu trữ tập trung tất cả file bản đồ, ảnh, dữ liệu | S3-compatible (backup.hci.vn) |
| **Database** (cơ sở dữ liệu) | Nơi lưu thông tin tài khoản, bài viết, thông số kỹ thuật | MySQL 8.0 |

---

### 1.4. Kết quả bàn giao

---

### 1.4.1. Bàn giao các module WebGIS

#### a) Mục tiêu

Bàn giao hệ thống bản đồ số đầy đủ các chức năng đã xây dựng.

#### b) Nội dung thực hiện

| Module | Công nghệ | Mô tả dễ hiểu | Chi tiết kỹ thuật |
|--------|-----------|---------------|-------------------|
| **Bản đồ tương tác** | OpenLayers | Hiển thị bản đồ với 8 nền khác nhau, phóng to/thu nhỏ | OpenLayers 10.9, UTM 48N |
| **Timeline & Timelapse** | OpenLayers + GeoTIFF | Xem dữ liệu theo thời gian, phát tự động | Điều khiển thời gian, phát lại raster |
| **Map Inspector** | OpenLayers + WebGL | Bấm vào bản đồ để xem thông tin chi tiết | Pixel value, vector properties |
| **Chất lượng nước** | Backend API | Xem thông số chất lượng nước + ảnh thực tế tại trạm | Trạm surface/ground water |
| **Phân loại sử dụng đất** | GeoTIFF + COG | Bản đồ các loại đất (lúa, tôm, cây ăn trái...) + thống kê | 7 lớp raster, thống kê yearly |
| **Quy hoạch sử dụng đất** | GeoJSON | Bản đồ quy hoạch 9 huyện Trà Vinh từ bản vẽ AutoCAD | Vector từ DXF |
| **Ảnh vệ tinh** | GeoTIFF + COG | Ảnh vệ tinh Landsat 2014-2025, 7 dải màu | 7 bands, 12 năm |
| **Thủy văn** | Backend API | Dữ liệu độ mặn, thủy triều, pH cập nhật liên tục | Salinity, Tidal, pH realtime |
| **Đăng nhập & phân quyền** | JWT | Hệ thống tài khoản, 3 cấp quyền | USER, DATA_MANAGER, ADMIN |
| **Trang quản trị** | Admin Dashboard | Quản lý tài khoản, bài viết, sao lưu | Users, articles, backup |
| **Tin tức** | Articles CRUD | Đăng tải thông tin, bài viết lên trang chủ | Công khai |

#### c) Quá trình triển khai

Hệ thống được triển khai trên server tại địa chỉ `123.22.61.134`:
- **Frontend:** port 3004
- **Backend:** port 8084
- **Domain:** `https://mekongsaltlab.org`

Quy trình triển khai:
1. Clone source code từ GitHub
2. Cấu hình file `.env` (S3 keys, API keys)
3. Build backend bằng Maven, frontend bằng npm
4. Khởi động các dịch vụ qua script `manage.sh`

#### d) Kết quả bàn giao

| Hạng mục | Số lượng |
|----------|:--------:|
| Màn hình giao diện | 9 pages |
| API Controllers | 18 controllers |
| Database tables | 18+ tables |

---

### 1.4.2. Import dữ liệu GIS và khởi chạy hệ thống WebGIS

#### a) Mục tiêu

Đưa toàn bộ dữ liệu bản đồ, ảnh vệ tinh, sông ngòi, đất đai lên hệ thống và khởi chạy thành công.

#### b) Thu thập và chuẩn hóa dữ liệu GIS

Dữ liệu đầu vào bao gồm:
- **File DXF/DGN** bản đồ quy hoạch sử dụng đất 9 huyện Trà Vinh
- **GeoTIFF** ảnh vệ tinh Landsat 7 bands (2014-2025)
- **GeoTIFF** dữ liệu phân loại sử dụng đất (7 class × 5 năm)
- **GeoTIFF** dữ liệu thủy văn (Salinity, Tidal, pH)
- **Shapefile/GeoJSON** hệ thống kênh rạch, giao thông, hành chính

#### c) Import dữ liệu GIS lên hệ thống

Dữ liệu được import qua S3 API:
- Upload file GeoTIFF, GeoJSON lên S3 bucket
- Hỗ trợ định dạng: `.tif`, `.tiff`, `.geojson`, `.kml`, `.zip`, `.vct`, `.vdc`, `.dbf`

**Tối ưu dữ liệu:**
Sau khi import, hệ thống tự động chuyển đổi GeoTIFF sang định dạng COG để xem nhanh hơn:

| Loại dữ liệu | Số file | Dung lượng gốc | Dung lượng COG | Giảm |
|-------------|:-------:|:--------------:|:--------------:|:----:|
| Landsat Imagery | 84 | 546 MB | 135 MB | **75%** |
| Landuse Classification | 35 | 227 MB | 10 MB | **95%** |
| **Tổng** | **119** | **773 MB** | **145 MB** | **81%** |

#### d) Cấu hình và khởi chạy hệ thống WebGIS

Hệ thống đã được cài đặt và khởi chạy thành công tại `https://mekongsaltlab.org`:
- Cấu hình kết nối S3, database MySQL
- Cấu hình tên miền, CORS
- Tạo tài khoản quản trị mặc định

#### e) Kết quả bàn giao

| Danh mục | Số file | Dung lượng |
|----------|:-------:|:----------:|
| 🌊 Hydrology - Salinity | 286 | 8.5 MB |
| 🌊 Hydrology - pH | 282 | 8.5 MB |
| 🌊 Hydrology - Tidal | 270 | 8.2 MB |
| 🛰️ Landsat Band 1-7 | 84 | 546 MB (gốc) → 135 MB (COG) |
| 🌿 Landuse Classification | 35 | 227 MB (gốc) → 10 MB (COG) |
| 📐 Landuse Planning | 3 | 18.4 MB |
| 🚧 Channel System | 16 | 6.6 MB |
| 🗺️ Administration | 6 | 0.5 MB |
| 🌊 Flooding Modeling | 2 | 13.0 MB |
| **Tổng** | **1.126** | **765 MB** |

---

### 1.4.3. Thiết lập hình ảnh các trạm đo

#### a) Mục tiêu

Gắn ảnh chụp thực tế cho từng trạm đo chất lượng nước, giúp người xem biết trạm đó trông như thế nào.

#### b) Thu thập hình ảnh các trạm đo

- Ảnh hiện trường được thu thập từ thực địa tại các trạm quan trắc
- Xử lý: đặt tên theo mã trạm, upload lên S3 bucket

#### c) Thiết lập hình ảnh trên hệ thống

- Đường dẫn lưu trữ: `station-data/manual-stations/`
- Quyền truy cập: public (không cần xác thực)

#### d) Liên kết hình ảnh với dữ liệu trạm

- Ảnh được liên kết với trạm qua trường `imageCode` trong bảng `manual_station`
- Khi xem chi tiết trạm, hệ thống tự động tải và hiển thị ảnh từ S3
- Hỗ trợ nhiều ảnh cho một trạm
- Click để xem ảnh phóng to

#### e) Kết quả bàn giao

| Hạng mục | Kết quả |
|----------|:-------:|
| Số trạm đã thiết lập ảnh | Đã có dữ liệu trong hệ thống |
| Định dạng ảnh | JPEG |
| Đường dẫn lưu trữ | `station-data/manual-stations/` |
| Quyền truy cập | Public |

---

### 1.4.4. Lưu trữ và truy xuất dữ liệu các trạm thời tiết

#### a) Mục tiêu

Thu thập, lưu trữ dữ liệu từ các trạm thời tiết và hiển thị trực quan trên bản đồ WebGIS.

#### b) Thu thập và lưu trữ dữ liệu các trạm thời tiết

Dữ liệu thời tiết được thu thập từ các trạm Ecowitt, bao gồm:
- Nhiệt độ, độ ẩm
- Tốc độ gió, hướng gió
- Lượng mưa
- Áp suất không khí
- Bức xạ mặt trời, chỉ số UV

Dữ liệu được đồng bộ định kỳ và lưu trữ trong cơ sở dữ liệu MySQL.

#### c) Xây dựng chức năng truy xuất dữ liệu trên WebGIS

Hệ thống cho phép:
- Xem dữ liệu thời tiết theo thời gian thực
- Tra cứu dữ liệu lịch sử theo ngày/tháng/năm
- Biểu đồ trực quan các thông số

#### d) Hiển thị dữ liệu trên hệ thống

- Trên bản đồ: hiển thị vị trí trạm thời tiết với mã trạm
- Click vào trạm: hiển thị popup thông tin chi tiết
- Popup bao gồm biểu đồ sparkline cho từng thông số

#### e) Kết quả bàn giao

| Hạng mục | Kết quả |
|----------|:-------:|
| Số trạm thời tiết | Đã kết nối và hiển thị trên bản đồ |
| Thông số thu thập | Nhiệt độ, ẩm, gió, mưa, áp suất, UV, bức xạ |
| Hiển thị | Popup + biểu đồ sparkline |

---

### 1.5. Danh mục hồ sơ bàn giao

| STT | Tên tài liệu | Định dạng | Ghi chú |
|:---:|-------------|:---------:|---------|
| 1 | `README.md` | Markdown | Tổng quan dự án, quick start |
| 2 | `DEPLOY.md` | Markdown | Hướng dẫn triển khai chi tiết |
| 3 | `docs/deployment.md` | Markdown | Hướng dẫn cài đặt và cấu hình |
| 4 | `docs/api-auth.md` | Markdown | Tài liệu API Authentication |
| 5 | `docs/roles.md` | Markdown | Phân quyền hệ thống |
| 6 | `docs/s3-storage.md` | Markdown | API S3 Storage |
| 7 | `docs/security.md` | Markdown | Bảo mật hệ thống |
| 8 | `docs/backup-strategy.md` | Markdown | Chiến lược sao lưu |
| 9 | `docs/data-upload.md` | Markdown | Hướng dẫn upload dữ liệu |
| 10 | Source code | Git | GitHub |
| 11 | Database | MySQL | Schema + data |
| 12 | API Documentation | Swagger | `/swagger-ui.html` |
| 13 | Tài khoản mặc định | — | admin/admin123, manager/manager123 |

---

## 2. Công nghệ sử dụng

| Layer | Công nghệ | Phiên bản | Mục đích |
|-------|-----------|:---------:|----------|
| **Frontend** | Next.js | 15 | Framework React |
| | React | 19 | UI components |
| | TypeScript | 5.8 | Static typing |
| | OpenLayers | 10.9 | Bản đồ tương tác |
| | Recharts | 3.8 | Biểu đồ |
| **Backend** | Java | 17 | Ngôn ngữ |
| | Spring Boot | 4.0.6 | Framework |
| | Spring Security | 6.x | Xác thực + phân quyền |
| | JPA/Hibernate | 7.x | ORM |
| | JWT (jjwt) | 0.12.3 | Token |
| | AWS SDK S3 | 2.20.26 | S3 client |
| | Apache POI | 5.2.5 | Excel |
| **Database** | MySQL | 8.0 | Cơ sở dữ liệu |
| **Storage** | S3 (backup.hci.vn) | — | File storage |
| **GIS** | GDAL | 3.8.4 | COG conversion |

---

## 3. Các lỗi đã xử lý

| Lỗi | Nguyên nhân | Giải pháp |
|-----|------------|-----------|
| **403 khi tải ảnh station** | Backend yêu cầu auth cho S3 download | Mở public prefix `station-data/`, `news-images/` |
| **Thiếu Tidal trong danh sách** | S3 list không phân trang | Thêm pagination loop |
| **File GeoTIFF 6.5MB chậm** | Không tiled, không compress | Chuyển sang COG |
| **Polygon lớn che polygon nhỏ** | Thứ tự vẽ theo file gốc | Sắp xếp theo diện tích |
| **"Maximum update depth"** | pointermove gọi setState liên tục | Dùng ref, so sánh tọa độ |
| **Không inspect vector trên mobile** | Click handler chỉ check raster | Gọi inspectAtPixel cho cả raster + vector |

---

## 4. Bảng tóm tắt công việc

### 4.1. Công việc đã hoàn thành

| STT | Công việc | Thời gian |
|:---:|----------|:----------:|
| 1 | Khởi tạo dự án, cấu trúc Backend + Frontend | 25-31/05/2026 |
| 2 | Xây dựng core: bản đồ + API + xác thực | 02-09/06/2026 |
| 3 | Hoàn thiện giao diện, dữ liệu Landsat, Landuse | 10/06-13/07/2026 |
| 4 | Phân tích landuse, VCT Parser | 10-13/07/2026 |
| 5 | Hệ thống kênh rạch, Upload form | 13-15/07/2026 |
| 6 | Tối ưu COG, phân trang S3, tối ưu render | 19-20/07/2026 |
| 7 | Tài liệu, báo cáo bàn giao | 20-21/07/2026 |
| | **Tổng cộng: 56 ngày** | **25/05 → 20/07/2026** |

### 4.2. Công việc còn lại

| STT | Công việc | Mô tả | Ưu tiên | Dự kiến |
|:---:|----------|-------|:-------:|:--------:|
| 1 | Upload file RGB Landsat | Composite RGB chưa có trên S3 | Trung | Tháng 8/2026 |
| 2 | Cấu hình HTTPS | Let's Encrypt + Nginx | Trung | Tháng 9/2026 |

---

## 5. Kết luận

Dự án **Mekongsaltlab** đã hoàn thành bàn giao các hạng mục chính bao gồm:

- ✅ **Bàn giao các module WebGIS**: bản đồ tương tác, timeline, inspector, chất lượng nước, phân loại đất, quy hoạch đất, ảnh vệ tinh, thủy văn, xác thực, quản trị, tin tức
- ✅ **Import dữ liệu GIS thành công**: 1.126 file dữ liệu (765 MB) đã được import và tối ưu (119 file COG, giảm 81% dung lượng)
- ✅ **Thiết lập hình ảnh trạm đo**: ảnh hiện trường các trạm chất lượng nước
- ✅ **Dữ liệu trạm thời tiết**: thu thập, lưu trữ và hiển thị trực quan trên bản đồ
- ✅ **Tài liệu kỹ thuật**: đầy đủ hồ sơ bàn giao

Hệ thống đang vận hành thực tế tại `http://123.22.61.134:3004` và `https://mekongsaltlab.org`.

---

<div align="center">

**Kết thúc báo cáo**

---

*Báo cáo được lập bởi **Nguyễn Lê Duy** · 21/07/2026*  
*Mekongsaltlab © 2026*

</div>
