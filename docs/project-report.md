<br/>
<div align="center">

# BÁO CÁO KẾT QUẢ BÀN GIAO

## 🌊 Hệ thống bản đồ số giám sát môi trường Đồng bằng sông Cửu Long
---

**Tên dự án:** Mekongsaltlab
**phát triển:** Nguyễn Vắn Hoàng
**Thời gian thực hiện:** 1/05/2026 → 31/07/2026
**Ngày lập báo cáo:** 21/07/2026  
</div>

---

## MỤC LỤC

*(Giữ nguyên như cũ)*

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
| **Layer** | Một lớp dữ liệu trên bản đồ (ví dụ: lớp sông, lớp đất, lớp ảnh vệ tinh) | OpenLayers Layer (raster/vector) |

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
   - 1.1. [Thông tin dự án](#11-thông-tin-dự-án)
   - 1.2. [Mục tiêu](#12-mục-tiêu)
   - 1.3. [Phạm vi](#13-phạm-vi)
   - 1.4. [Kết quả bàn giao](#14-kết-quả-bàn-giao)
       - 1.4.1. [Bàn giao các module WebGIS](#141-bàn-giao-các-module-webgis)
       - 1.4.2. [Import dữ liệu thuộc tính ngoài bản đồ](#142-import-dữ-liệu-thuộc-tính-ngoài-bản-đồ)
       - 1.4.3. [Thiết lập hình ảnh các trạm đo](#143-thiết-lập-hình-ảnh-các-trạm-đo)
   - 1.5. [Danh mục hồ sơ bàn giao](#15-danh-mục-hồ-sơ-bàn-giao)
2. [Công nghệ sử dụng](#2-công-nghệ-sử-dụng)
3. [Các lỗi đã xử lý](#3-các-lỗi-đã-xử-lý)
4. [Bảng tóm tắt công việc](#4-bảng-tóm-tắt-công-việc)
   - 4.1. [Công việc đã hoàn thành](#41-công-việc-đã-hoàn-thành)
   - 4.2. [Công việc còn lại](#42-công-việc-còn-lại)
5. [Kết luận](#5-kết-luận)

---

## 1. Tổng quan dự án

### 1.1. Thông tin dự án

| Mục | Chi tiết |
|-----|----------|
| **Tên dự án** | Mekongsaltlab |
| **Mô tả** | Trang web bản đồ số giúp theo dõi, xem và phân tích dữ liệu sông nước, thời tiết, môi trường tại Đồng bằng sông Cửu Long. Dành cho cán bộ quản lý tài nguyên nước, nhà nghiên cứu và người dân quan tâm. |
| **Đơn vị phát triển** | Nguyễn Vắn Hoàng |
| **Số lượng commit** | 122 commits |
| **Tổng số file** | 308 files |
| **Ngày bắt đầu** | 01/05/2026 |
| **Ngày kết thúc** | 31/07/2026 |

### 1.2. Mục tiêu

Xây dựng WebGIS giám sát dữ liệu tài nguyên nước, thủy văn và môi trường Đồng bằng sông Cửu Long, tỉnh Trà Vinh.

### 1.3. Phạm vi

| Thành phần | Mô tả |
|------------|-------|
| **Frontend** (giao diện) | Trang web hiển thị bản đồ, được xây dựng bằng Next.js và OpenLayers — 2 công nghệ web hiện đại |
| **Backend** (xử lý) | Máy chủ chứa dữ liệu và xử lý các yêu cầu từ trang web, viết bằng Java Spring Boot |
| **Storage** (kho chứa file) | Nơi lưu trữ tập trung tất cả file bản đồ, ảnh, dữ liệu (dùng công nghệ S3-compatible) |
| **Database** (cơ sở dữ liệu) | Nơi lưu thông tin tài khoản, bài viết, thông số kỹ thuật (MySQL) |

---

### 1.4. Kết quả bàn giao

---

### 1.4.1. Bàn giao các module WebGIS

#### a) Mục tiêu

Bàn giao hệ thống bản đồ số đầy đủ các chức năng đã xây dựng.

#### b) Nội dung thực hiện

| Module | Công nghệ | Mô tả dễ hiểu | Chi tiết kỹ thuật |
|--------|-----------|---------------|-------------------|
| **Bản đồ tương tác** | OpenLayers | Hiển thị bản đồ với 8 nền khác nhau (bản đồ đường, ảnh vệ tinh...), có thể phóng to/thu nhỏ | OpenLayers 10.9, hỗ trợ UTM 48N |
| **Timeline & Timelapse** | OpenLayers + GeoTIFF | Xem dữ liệu theo thời gian (giờ, ngày, tháng, năm), phát tự động | Điều khiển thời gian, phát lại raster |
| **Map Inspector** | OpenLayers + WebGL | Bấm vào bản đồ để xem thông tin chi tiết tại điểm đó | Xem giá trị pixel, thuộc tính vector, tọa độ |
| **Trạm thời tiết** | API + Biểu đồ | Xem nhiệt độ, độ ẩm, gió, mưa từ các trạm thời tiết | Popup trạm, biểu đồ sparkline |
| **Chất lượng nước** | Backend API | Xem thông số chất lượng nước và ảnh chụp thực tế tại từng trạm | Trạm surface/ground water, ảnh hiện trường |
| **Phân loại sử dụng đất** | GeoTIFF + COG | Xem bản đồ các loại đất: lúa, tôm, cây ăn trái, dân cư... Thống kê diện tích từng loại | 7 lớp raster, thống kê diện tích theo năm |
| **Quy hoạch sử dụng đất** | GeoJSON | Bản đồ quy hoạch 9 huyện Trà Vinh, chuyển từ bản vẽ AutoCAD | 9 huyện, dữ liệu vector từ DXF |
| **Ảnh vệ tinh** | GeoTIFF + COG | Ảnh vệ tinh Landsat từ 2014-2025, 7 dải màu khác nhau | 7 bands, 12 năm dữ liệu |
| **Thủy văn** | Backend API | Dữ liệu độ mặn, thủy triều, pH cập nhật liên tục | Salinity, Tidal, pH realtime |
| **Quản lý file** | S3 Explorer | Tải lên, tải xuống, xóa, đổi tên file dữ liệu (giống Google Drive) | Upload/Download/Delete/Rename S3 |
| **Đăng nhập & phân quyền** | JWT | Hệ thống tài khoản, phân quyền: người xem, người quản lý dữ liệu, quản trị viên | 3 role: USER, DATA_MANAGER, ADMIN |
| **Trang quản trị** | Admin Dashboard | Quản lý tài khoản, bài viết, sao lưu dữ liệu | Quản lý users, articles, backup |
| **Tin tức** | Articles CRUD | Đăng tải thông tin, bài viết lên trang chủ | Đăng tải thông tin, công khai |

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
| Entities JPA | 21 entities |
| Database tables | 18+ tables |
| File GIS trên S3 | 1.126 files |
| Dung lượng S3 | 765 MB |

---

### 1.4.2. Import dữ liệu thuộc tính ngoài bản đồ

#### a) Mục tiêu

Đưa toàn bộ dữ liệu bản đồ, ảnh vệ tinh, sông ngòi, đất đai lên hệ thống.

#### b) Chuẩn bị dữ liệu

Dữ liệu đầu vào bao gồm:
- **File DXF/DGN** bản đồ quy hoạch sử dụng đất 9 huyện Trà Vinh
- **GeoTIFF** ảnh vệ tinh Landsat 7 bands (2014-2025)
- **GeoTIFF** dữ liệu phân loại sử dụng đất (7 class × 5 năm)
- **GeoTIFF** dữ liệu thủy văn (Salinity, Tidal, pH)
- **Shapefile/GeoJSON** hệ thống kênh rạch, giao thông, hành chính
#### c) Quá trình import dữ liệu

Dữ liệu được import qua S3 API:
- Upload file GeoTIFF, GeoJSON lên S3 bucket
- Hỗ trợ định dạng: `.tif`, `.tiff`, `.geojson`, `.kml`, `.zip`, `.vct`, `.vdc`, `.dbf`

**Tối ưu dữ liệu:**
Sau khi import, hệ thống tự động chuyển đổi GeoTIFF → Cloud Optimized GeoTIFF (COG) để tăng tốc hiển thị:

| Loại dữ liệu | Số file | Dung lượng gốc | Dung lượng COG | Giảm |
|-------------|:-------:|:--------------:|:--------------:|:----:|
| Landsat Imagery | 84 | 546 MB | 135 MB | **75%** |
| Landuse Classification | 35 | 227 MB | 10 MB | **95%** |
| **Tổng** | **119** | **773 MB** | **145 MB** | **81%** |

#### d) Kết quả bàn giao

| Danh mục | Số file | Dung lượng | Nguồn dữ liệu |
|----------|:-------:|:----------:|---------------|
| 🌊 Hydrology - Salinity | 286 | 8.5 MB | |
| 🌊 Hydrology - pH | 282 | 8.5 MB | |
| 🌊 Hydrology - Tidal | 270 | 8.2 MB | |
| 🛰️ Landsat Band 1-7 | 84 | 546 MB (gốc) → 135 MB (COG) | Landsat 8, 9 |
| 🌿 Landuse Classification | 35 | 227 MB (gốc) → 10 MB (COG) | Landsat GIS Interpretation |
| 📐 Landuse Planning | 3 | 18.4 MB | DXF → GeoJSON |
| 🚧 Channel System | 16 | 6.6 MB | DXF → GeoJSON |
| 🗺️ Administration | 6 | 0.5 MB | GIS Website Vinh Long |
| 🌊 Flooding Modeling | 2 | 13.0 MB | Mô hình số |
| **Tổng** | **1.126** | **765 MB** | |

---

### 1.4.3. Thiết lập hình ảnh các trạm đo

#### a) Mục tiêu

Gắn ảnh chụp thực tế cho từng trạm đo chất lượng nước, giúp người xem biết trạm đó trông như thế nào.

#### b) Thu thập và xử lý hình ảnh

- Ảnh hiện trường được thu thập từ thực địa
- Xử lý: đặt tên theo mã trạm, upload lên S3 bucket
- Đường dẫn lưu trữ: `station-data/manual-stations/`
- Quyền truy cập: public (không cần xác thực)

#### c) Quá trình triển khai

- Ảnh được liên kết với trạm qua trường `imageCode` trong bảng `manual_station`
- Khi xem chi tiết trạm, hệ thống tự động tải và hiển thị ảnh từ S3
- Hỗ trợ nhiều ảnh cho một trạm (danh sách phân cách bằng dấu phẩy)
- Cơ chế click để xem ảnh phóng to (preview modal)

#### d) Kết quả bàn giao

| Hạng mục | Kết quả |
|----------|:-------:|
| Số trạm đã thiết lập ảnh | Đã có dữ liệu trong hệ thống |
| Định dạng ảnh | JPEG |
| Đường dẫn lưu trữ | `station-data/manual-stations/` |
| Quyền truy cập | Public (không cần xác thực) |

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
| 10 | `docs/mekong-data-import.md` | Markdown | Import dữ liệu Mekong |
| 11 | Source code | Git | GitHub: vanhoangtvu/mekongSL |
| 12 | Database | MySQL | Schema + data |
| 13 | API Documentation | Swagger | `/swagger-ui.html` (khi backend chạy) |
| 14 | Tài khoản mặc định | — | admin/admin123, manager/manager123 |

---

### 1.6. Hình ảnh minh họa

*(Chưa có ảnh chụp. Hướng dẫn chụp và chèn ảnh bên dưới)*

#### 1.6.1. Hướng dẫn chụp ảnh màn hình

Truy cập hệ thống tại `https://mekongsaltlab.org`, đăng nhập tài khoản **admin** / **admin123**, sau đó chụp ảnh các màn hình sau:

| STT | Mục | Đường dẫn | Thao tác cần làm |
|:---:|-----|-----------|-----------------|
| 1 | Bản đồ chính | Trang chủ | Load đủ 1-2 lớp dữ liệu, hiển thị rõ sidebar + timeline |
| 2 | Chọn lớp dữ liệu | Sidebar bên trái | Mở rộng dataset tree, chọn 1 lớp raster + 1 lớp vector |
| 3 | Timeline | Thanh dưới bản đồ | Chọn khung giờ, bật timelapse |
| 4 | Map Inspector | Bản đồ | Click vào 1 điểm trên bản đồ để xem Inspector |
| 5 | Trạm chất lượng nước | Bản đồ | Click vào trạm WQ để hiện popup + ảnh hiện trường |
| 6 | Trạm thời tiết | Bản đồ | Hover/click vào trạm Ecowitt |
| 7 | Landuse Inspector | Bản đồ | Hover vào vùng đất để xem thông tin |
| 8 | S3 Explorer | `/data` | Upload/download file |
| 9 | Admin Dashboard | `/dashboard` | Quản lý users, articles |

#### 1.6.2. Vị trí lưu ảnh

Lưu ảnh vào thư mục `docs/images/` với tên file:

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

## 2. Công nghệ sử dụng

| Layer | Công nghệ | Phiên bản | Mục đích |
|-------|-----------|:---------:|----------|
| **Frontend** | Next.js | 15 | Framework React |
| | React | 19 | UI components |
| | TypeScript | 5.8 | Static typing |
| | OpenLayers | 10.9 | Bản đồ tương tác |
| | Recharts | 3.8 | Biểu đồ |
| | Proj4 | 2.20 | Projection UTM 48N |
| **Backend** | Java | 17 | Ngôn ngữ |
| | Spring Boot | 4.0.6 | Framework |
| | Spring Security | 6.x | Xác thực + phân quyền |
| | JPA/Hibernate | 7.x | ORM |
| | JWT (jjwt) | 0.12.3 | Token |
| | AWS SDK S3 | 2.20.26 | S3 client |
| | Apache POI | 5.2.5 | Excel |
| | Lombok | — | Boilerplate |
| **Database** | MySQL | 8.0 | Cơ sở dữ liệu |
| **Storage** | S3 (backup.hci.vn) | — | File storage |
| **GIS** | GDAL | 3.8.4 | COG conversion |

---

## 3. Các lỗi đã xử lý

| Lỗi | Nguyên nhân | Giải pháp |
|-----|------------|-----------|
| **403 khi tải ảnh station** | Backend yêu cầu auth cho S3 download | Mở public prefix `station-data/`, `news-images/` |
| **Thiếu Tidal trong danh sách** | S3 listObjectsV2 không phân trang | Thêm pagination loop |
| **File GeoTIFF 6.5MB chậm** | Không tiled, không compress | Chuyển sang COG (tiled 256×256, DEFLATE) |
| **Polygon lớn che polygon nhỏ** | Thứ tự vẽ theo file gốc | Sắp xếp theo diện tích (nhỏ ở trên) |
| **"Maximum update depth"** | pointermove gọi setState liên tục | Dùng ref, so sánh tọa độ trước khi set |
| **Không inspect vector trên mobile** | Click handler chỉ check raster | Gọi inspectAtPixel cho cả raster + vector |

---

## 4. Bảng tóm tắt công việc

### 4.1. Công việc đã hoàn thành

| STT | Công việc | Thời gian | Commit |
|:---:|----------|:----------:|:------:|
| 1 | Khởi tạo dự án, cấu trúc Spring Boot + Next.js | 25-31/05/2026 | `first commit` → `up` |
| 2 | Xây dựng core: Frontend (MapStage, layers) + Backend (Auth, S3, API) | 02-09/06/2026 | `okaddrastorvector` → `flooding ok` |
| 3 | Hoàn thiện giao diện, Landsat, Landuse, Channel System | 10/06-13/07/2026 | `giaod dein chinh xac` → `hthanh gd 1` |
| 4 | Landuse Compute, Analytics, VCT Parser, Auto-detect UTM | 10-13/07/2026 | `MySQL cache` → `hthanh gd 1` |
| 5 | Channel System hierarchy, Upload form, S3 Path | 13-15/07/2026 | `update` → `khoa download` |
| 6 | COG conversion, S3 Pagination, Direct Backend, Render Optimization | 19-20/07/2026 | `converr process` → `fn 22` |
| 7 | Tài liệu, báo cáo bàn giao | 20-21/07/2026 | `puh 2` → hiện tại |
| | **Tổng cộng: 122 commits, 56 ngày** | **25/05 → 20/07/2026** | |

### 4.2. Công việc còn lại

| STT | Công việc | Mô tả | Ưu tiên | Dự kiến |
|:---:|----------|-------|:-------:|:--------:|
| 1 | Upload file RGB Landsat | Composite RGB chưa có trên S3 | Trung | Tháng 8/2026 |
| 2 | Cấu hình HTTPS | Let's Encrypt + Nginx reverse proxy | Trung | Tháng 9/2026 |

---

## 5. Kết luận

Dự án **Mekongsaltlab** đã hoàn thành bàn giao các hạng mục chính bao gồm:

- ✅ **13 module WebGIS** chức năng: bản đồ tương tác, timeline, inspector, trạm thời tiết, chất lượng nước, phân loại sử dụng đất, quy hoạch sử dụng đất, Landsat, thủy văn, quản lý tập trung, xác thực, quản trị, tin tức
- ✅ **1.126 file dữ liệu GIS** (765 MB) đã được import và tối ưu
- ✅ **119 file GeoTIFF** đã chuyển sang COG (giảm 81% dung lượng)
- ✅ **18 controllers, 21 entities, 18+ tables** hoàn chỉnh
- ✅ **Tài liệu kỹ thuật** đầy đủ (11 file)

Hệ thống đang vận hành thực tế tại địa chỉ `http://123.22.61.134:3004` và `https://mekongsaltlab.org`.

---

<div align="center">

**Kết thúc báo cáo**

---

*Báo cáo được lập bởi **Nguyễn Vắn Hoàng** · 21/07/2026*  
*Mekongsaltlab © 2026*

</div>
