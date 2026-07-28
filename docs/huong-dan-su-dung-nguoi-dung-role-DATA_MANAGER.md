# 📘 Hướng Dẫn Sử Dụng Hệ Thống MekongSaltLab — Vai Trò: **DATA_MANAGER**

> **Phiên bản:** 1.0 | **Cập nhật:** 25/07/2026  
> **Vai trò:** Quản lý dữ liệu — có quyền upload, xóa, quản lý dữ liệu GIS, trạm quan trắc, bài viết.

---

## Mục Lục

1. [Tổng quan quyền hạn](#1-tổng-quan-quyền-hạn)
2. [Đăng nhập với tài khoản DATA_MANAGER](#2-đăng-nhập-với-tài-khoản-datamanager)
3. [Truy cập trang Quản trị](#3-truy-cập-trang-quản-trị)
4. [Quản lý S3 Storage](#4-quản-lý-s3-storage)
   - 4.1 [Duyệt & xem file](#41-duyệt--xem-file)
   - 4.2 [Upload file](#42-upload-file)
   - 4.3 [Tạo thư mục](#43-tạo-thư-mục)
   - 4.4 [Download file](#44-download-file)
   - 4.5 [Xóa file](#45-xóa-file)
   - 4.6 [Sao chép & Di chuyển](#46-sao-chép--di-chuyển)
5. [Quản lý dữ liệu GIS](#5-quản-lý-dữ-liệu-gis)
   - 5.1 [Danh sách Layers](#51-danh-sách-layers)
   - 5.2 [Quản lý Folder trong Layer](#52-quản-lý-folder-trong-layer)
   - 5.3 [Upload file vào Layer](#53-upload-file-vào-layer)
6. [Quản lý Stations (Trạm)](#6-quản-lý-stations-trạm)
   - 6.1 [Xem danh sách trạm](#61-xem-danh-sách-trạm)
   - 6.2 [Thêm / Sửa / Xóa trạm](#62-thêm--sửa--xóa-trạm)
   - 6.3 [Import Excel danh sách trạm](#63-import-excel-danh-sách-trạm)
7. [Quản lý chất lượng nước (Water Quality)](#7-quản-lý-chất-lượng-nước-water-quality)
   - 7.1 [Preview file Excel](#71-preview-file-excel)
   - 7.2 [Import dữ liệu](#72-import-dữ-liệu)
   - 7.3 [Xem & Xóa mẫu](#73-xem--xóa-mẫu)
8. [Quản lý dữ liệu quan trắc tự động](#8-quản-lý-dữ-liệu-quan-trắc-tự-động)
9. [Data Fetch & Export](#9-data-fetch--export)
    - 9.1 [Kích hoạt fetch dữ liệu](#91-kích-hoạt-fetch-dữ-liệu)
    - 9.2 [Export dữ liệu Excel](#92-export-dữ-liệu-excel)
10. [Tính toán Landuse](#10-tính-toán-landuse)
11. [Bảo mật & Lưu ý](#11-bảo-mật--lưu-ý)

---

## 1. Tổng quan quyền hạn

Với vai trò **DATA_MANAGER**, bạn có tất cả quyền của **USER** và thêm các quyền sau:

| Module | Quyền |
|--------|-------|
| 🗺️ **Bản đồ WebGIS** | ✅ Xem đầy đủ |
| 📰 **Tin tức** | ✅ Xem danh sách & chi tiết |
| ☁️ **S3 Storage** | ✅ Upload, Delete, Copy, Rename, Tạo folder |
| 🗂️ **GIS Layers** | ✅ CRUD Layers, Datasets, Folders, Tags |
| 📍 **Trạm quan trắc** | ✅ CRUD + Import Excel |
| 💧 **Chất lượng nước** | ✅ Import Excel, Xóa mẫu |
| 📊 **Monitoring Data** | ✅ Upload, List, Download, Delete |
| 📥 **Download dữ liệu** | ✅ Tải file công khai |
| 🔄 **Data Fetch** | ✅ Kích hoạt fetch dữ liệu |

> **Tài khoản mặc định:** `manager` / `manager123`

---

## 2. Đăng nhập với tài khoản DATA_MANAGER

1. Truy cập trang chủ → nhấn **Login**.
2. Nhập username: `manager`, password: `manager123`.
3. Sau khi đăng nhập, header hiển thị:
   - Tên người dùng: `manager (DATA_MANAGER)`
   - Nút **Quản trị** (mới xuất hiện)

---

## 3. Truy cập trang Quản trị

Sau khi đăng nhập thành công với tài khoản DATA_MANAGER, nút **Quản trị** sẽ xuất hiện trên thanh header. Nhấn vào nút này để truy cập trang quản trị tại đường dẫn `/data`.

### 3.1 Bố cục trang Quản trị

Trang quản trị được chia thành các khu vực chức năng như sau:

| Khu vực | Vị trí | Chức năng | Mô tả chi tiết |
|---------|:------:|-----------|----------------|
| **Thanh Header** | Phía trên cùng | Điều hướng & thông tin tài khoản | Hiển thị logo MekongSaltLab (góc trái), tên tài khoản và vai trò (góc phải, ví dụ: `manager (DATA_MANAGER)`) cùng nút Sign Out. |
| **Thanh Tab điều hướng** | Bên dưới Header, hàng ngang | Chuyển đổi giữa các module quản trị | Gồm các tab: **Tổng quan** (Overview), **Storage** (S3 Manager), **Dữ liệu** (Data), **GIS**, **Bài viết** (News). Tab nào đang được chọn sẽ được làm nổi bật. |
| **Vùng nội dung chính** | Chiếm phần còn lại của màn hình | Hiển thị giao diện của tab đang chọn | Nội dung thay đổi tùy theo tab: bảng biểu, form nhập liệu, danh sách file, cây thư mục... |
| **Khu vực thông báo (Toast)** | Góc trên bên phải (xuất hiện khi cần) | Hiển thị thông báo kết quả thao tác | Thông báo dạng popup nhỏ với màu sắc phân biệt: xanh lá (thành công), đỏ (lỗi), xanh dương (thông tin). Tự động biến mất sau vài giây. |

### 3.2 Danh sách các tab có sẵn cho DATA_MANAGER

Tùy theo quyền hạn, DATA_MANAGER sẽ thấy các tab sau:

| Tab | Tên tiếng Anh | Biểu tượng | Mô tả chức năng | Đối tượng sử dụng |
|:---:|:-------------:|:----------:|-----------------|:-----------------:|
| **Tổng quan** | Overview | 📊 | Dashboard tổng quan hệ thống: hiển thị thông tin tài khoản đang đăng nhập (username, email, role, ngày tạo), các thống kê nhanh về hệ thống. | DATA_MANAGER, ADMIN |
| **Storage** | S3 Manager | ☁️ | Quản lý toàn bộ file trên S3: duyệt cây thư mục, upload file, tạo thư mục mới, download, rename, copy, xóa file. Hỗ trợ các thư mục `gis-data/`, `station-data/`, `monitoring-data/`, `news-images/`. | DATA_MANAGER, ADMIN |
| **Dữ liệu** | Data | 📋 | Xem và quản lý dữ liệu cảm biến: fetch dữ liệu Ecowitt/Mekong, export Excel, quản lý trạm thủ công (Manual Stations), import chất lượng nước (Water Quality), quản lý dữ liệu quan trắc tự động (Monitoring Data). | DATA_MANAGER, ADMIN |
| **GIS** | GIS | 🗺️ | Quản lý dữ liệu không gian địa lý: danh sách Layers, quản lý cây thư mục Folder trong từng Layer, upload file GIS vào Layer, tính toán Landuse. | DATA_MANAGER, ADMIN |
| **Bài viết** | News | 📰 | Xem danh sách bài viết tin tức (chỉ xem, không tạo/sửa/xóa — quyền này chỉ dành cho ADMIN). | DATA_MANAGER (chỉ xem), ADMIN (đầy đủ) |
| **Users** | Users | 👥 | Quản lý người dùng hệ thống. **Tab này chỉ hiển thị với tài khoản ADMIN**, DATA_MANAGER không nhìn thấy. | ADMIN |

### 3.3 Các thao tác cơ bản trên trang Quản trị

| Thao tác | Mô tả | Cách thực hiện |
|----------|-------|:---------------:|
| **Chuyển tab** | Di chuyển giữa các module quản trị | Nhấn vào tên tab trên thanh điều hướng ngang |
| **Xem thông báo** | Kiểm tra kết quả thao tác (thành công/thất bại) | Thông báo xuất hiện tự động ở góc trên bên phải sau mỗi thao tác |
| **Tải lại dữ liệu** | Làm mới dữ liệu trong tab hiện tại | Nhấn nút **Refresh** (🔄) nếu có, hoặc chuyển tab qua lại |
| **Quay về trang chủ** | Trở về giao diện bản đồ WebGIS | Nhấn vào logo MekongSaltLab ở header |

---

## 4. Quản lý S3 Storage

Tab **Storage** (Kho lưu trữ) là nơi quản lý tất cả các file dữ liệu được lưu trữ trên hệ thống S3-compatible storage. Đây là trung tâm quản lý dữ liệu tập trung của toàn bộ hệ thống MekongSaltLab.

### 4.1 Giao diện S3 Explorer

Khi truy cập tab **Storage**, giao diện **S3 Explorer** được chia làm hai khu vực chính:

| Khu vực | Vị trí | Chức năng | Mô tả chi tiết |
|---------|:------:|-----------|----------------|
| **Cây thư mục (Folder Tree)** | Bên trái | Duyệt cấu trúc thư mục | Hiển thị tất cả các thư mục dưới dạng cây phân cấp. Nhấn vào tên thư mục để mở rộng/xem nội dung. Thư mục đang chọn được làm nổi bật. |
| **Danh sách file (File List)** | Bên phải | Hiển thị nội dung thư mục | Khi chọn một thư mục bên trái, danh sách file trong thư mục đó hiện ra bên phải, bao gồm: tên file, kích thước, ngày sửa đổi lần cuối. |
| **Thanh công cụ** | Phía trên danh sách file | Các thao tác trên file/thư mục | Gồm các nút: **Upload** (tải lên), **New Folder** (tạo thư mục), **Download** (tải xuống), **Rename** (đổi tên), **Copy** (sao chép), **Delete** (xóa), **Get Signed URL** (tạo link tải có thời hạn). |

### 4.2 Cấu trúc thư mục S3

Hệ thống tổ chức dữ liệu trên S3 theo 4 thư mục chính:

| Thư mục gốc | Mô tả | Loại dữ liệu | Định dạng file | Ví dụ đường dẫn |
|:-----------:|-------|:-------------:|:--------------:|-----------------|
| **`gis-data/`** | Dữ liệu không gian địa lý: ảnh vệ tinh, bản đồ sử dụng đất, độ mặn, thủy văn, hành chính | GIS Raster & Vector | `.tif`, `.tiff`, `.geojson`, `.kml`, `.shp`, `.gpkg`, `.zip` | `gis-data/hydrology/salinity/2026/05/30/12-00/raster/salinity.tif` |
| **`station-data/`** | Dữ liệu quan trắc từ các trạm thủ công | Dữ liệu chuỗi thời gian | `.csv` | `station-data/{stationCode}/{parameter}/{year}/{month}/{day}/{time}/data.csv` |
| **`monitoring-data/`** | Dữ liệu từ các trạm quan trắc tự động | Dữ liệu chuỗi thời gian | `.csv` | `monitoring-data/{monitoringCode}/{parameter}/{year}/{month}/{day}/{time}/data.csv` |
| **`news-images/`** | Hình ảnh minh họa cho các bài viết tin tức | Hình ảnh | `.jpg`, `.png`, `.gif`, `.webp` | `news-images/{article-slug}/image.jpg` |

### 4.3 Hướng dẫn Upload file

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | **Duyệt đến thư mục đích** | Trong cây thư mục bên trái, nhấn chọn thư mục bạn muốn upload file vào (ví dụ: `gis-data/hydrology/salinity/`). |
| 2 | **Nhấn nút Upload** | Nhấn nút **Upload** (☁️) trên thanh công cụ. Một hộp thoại chọn file hiện ra. |
| 3 | **Chọn file từ máy tính** | Nhấn **Browse** hoặc **Choose File** để duyệt và chọn file từ ổ cứng máy tính của bạn. |
| 4 | **Nhập S3 Key** (tùy chọn) | Nếu muốn đặt tên khác cho file trên S3, nhập đường dẫn đầy đủ vào ô **S3 Key**. Nếu để trống, hệ thống sẽ lấy tên file gốc. |
| 5 | **Bật Overwrite** (tùy chọn) | Bật tùy chọn **Overwrite** nếu bạn muốn ghi đè lên file đã tồn tại cùng tên. |
| 6 | **Nhấn Upload** | Nhấn nút **Upload** để bắt đầu quá trình tải lên. Thanh tiến trình hiển thị % hoàn thành. Khi kết thúc, thông báo thành công hiện ra. |

**Danh sách định dạng file được hỗ trợ:**

| Loại dữ liệu | Phần mở rộng | Ghi chú |
|:------------:|:------------:|---------|
| **Raster** (ảnh lưới) | `.tif`, `.tiff` | File GeoTIFF có thể kèm world file (`.tfw`) |
| **Vector** (đối tượng hình học) | `.geojson`, `.shp`, `.kml`, `.gpkg`, `.zip` | Shapefile nên đóng gói `.zip` bao gồm `.shp`, `.dbf`, `.prj`, `.shx` |
| **Dữ liệu chuỗi thời gian** | `.csv` | File CSV với header và dữ liệu phân cách bằng dấu phẩy |
| **Hình ảnh** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | Dung lượng tối đa 10MB cho mỗi file ảnh |

### 4.4 Tạo thư mục mới

| Bước | Thao tác |
|:----:|----------|
| 1 | Duyệt đến thư mục cha nơi bạn muốn tạo thư mục con mới. |
| 2 | Nhấn nút **New Folder** (📁) trên thanh công cụ. |
| 3 | Một hộp thoại hiện ra, nhập **tên thư mục** (chỉ gồm chữ cái, số, dấu gạch ngang, gạch dưới). |
| 4 | Nhấn **Create** để hoàn tất. Thư mục mới sẽ xuất hiện trong cây thư mục. |

### 4.5 Download file

| Cách | Thao tác | Kết quả |
|:----:|----------|---------|
| **Tải trực tiếp** | Nhấn chuột vào tên file trong danh sách | File được tải về máy tính qua trình duyệt |
| **Signed URL** | Chọn file → nhấn **Get Signed URL** | Hệ thống tạo một đường dẫn tải có thời hạn (mặc định 1 giờ). Bạn có thể copy đường dẫn này để chia sẻ cho người khác. |

### 4.6 Xóa file

| Bước | Thao tác |
|:----:|----------|
| 1 | Trong danh sách file, nhấn chọn file cần xóa (tích vào checkbox hoặc nhấn vào hàng). |
| 2 | Nhấn nút **Delete** (🗑️) trên thanh công cụ. |
| 3 | Một hộp thoại xác nhận hiện ra: *"Bạn có chắc chắn muốn xóa file này? Hành động này không thể hoàn tác."* |
| 4 | Nhấn **Confirm** (Xác nhận) để xóa, hoặc **Cancel** để hủy bỏ. |

> ⚠️ **Cảnh báo quan trọng:** Hành động xóa file trên S3 là **vĩnh viễn** và **không thể khôi phục**. Hãy kiểm tra kỹ trước khi xóa. Nếu không chắc chắn, hãy tải file về máy trước khi xóa.

### 4.7 Sao chép và Di chuyển file

| Thao tác | Các bước thực hiện | Ghi chú |
|----------|-------------------|---------|
| **Copy** (Sao chép) | 1. Chọn file cần copy → nhấn **Copy**.<br>2. Duyệt đến thư mục đích.<br>3. Nhấn **Paste** để dán file vào thư mục mới. | File gốc vẫn còn nguyên tại thư mục cũ. |
| **Rename** (Đổi tên) | 1. Chọn file cần đổi tên → nhấn **Rename**.<br>2. Nhập tên mới cho file.<br>3. Nhấn **Save** để lưu lại. | Chỉ thay đổi tên, không thay đổi nội dung file. |
| **Move** (Di chuyển) | Thực hiện Copy file đến thư mục đích, sau đó quay lại thư mục cũ và Delete file gốc. | Hiện tại chưa có chức năng Move trực tiếp, cần kết hợp Copy + Delete. |

---

## 5. Quản lý dữ liệu GIS

Tab **GIS** là nơi quản lý toàn bộ dữ liệu không gian địa lý của hệ thống. Tại đây, bạn có thể quản lý các Layer (lớp dữ liệu), Folder (thư mục) và upload file GIS lên hệ thống.

### 5.1 Giao diện tab GIS

Khi truy cập tab **GIS**, giao diện gồm các khu vực sau:

| Khu vực | Vị trí | Chức năng |
|---------|:------:|-----------|
| **Danh sách Layer** | Bên trái | Hiển thị tất cả các GIS layer có trong hệ thống dưới dạng danh sách. Mỗi layer hiển thị: ID (số thứ tự), **Layer Name** (tên lớp dữ liệu), **Layer Type** (loại: RASTER hoặc VECTOR). |
| **Cây thư mục Folder** | Bên phải (phần trên) | Khi chọn một layer, cây thư mục của layer đó hiện ra, cho phép xem cấu trúc phân cấp các folder. |
| **Khu vực thao tác** | Bên phải (phần dưới) | Chứa các nút chức năng: **New Folder** (tạo thư mục mới), **Upload File** (tải file lên), **Delete** (xóa folder). |

### 5.2 Xem danh sách Layers

| Thông tin hiển thị | Mô tả |
|:------------------:|-------|
| **ID** | Mã định danh duy nhất của layer trong hệ thống |
| **Layer Name** | Tên của lớp dữ liệu, ví dụ: "Landsat Imagery", "Hydrology Salinity" |
| **Layer Type** | Phân loại: `RASTER` (dữ liệu ảnh lưới), `VECTOR` (dữ liệu đối tượng hình học) |

> Mỗi layer tương ứng với một danh mục dữ liệu trong sidebar bản đồ WebGIS. Việc quản lý folder và file trong layer giúp tổ chức dữ liệu một cách có hệ thống.

### 5.3 Quản lý Folder trong Layer

Folder là các thư mục con bên trong mỗi Layer, dùng để phân loại và tổ chức các file dữ liệu GIS.

| Thao tác | Các bước thực hiện | Mô tả chi tiết |
|----------|-------------------|----------------|
| **Xem cây thư mục** | 1. Chọn một Layer từ danh sách bên trái.<br>2. Cây thư mục của layer đó tự động hiển thị bên phải. | Các folder được sắp xếp theo cấu trúc cha-con. Nhấn vào folder để xem các folder con bên trong. |
| **Tạo folder mới** | 1. Nhấn nút **New Folder**.<br>2. Nhập tên folder (nên đặt tên có ý nghĩa, ví dụ: "2026", "salinity", "landsat-b1").<br>3. Chọn **Folder cha** (parent folder) nếu muốn tạo folder con bên trong một folder khác.<br>4. Nhấn **Save**. | Tên folder không được trùng với folder đã có cùng cấp. |
| **Xóa folder** | 1. Chọn folder cần xóa trong cây thư mục.<br>2. Nhấn nút **Delete**.<br>3. Xác nhận hành động. | ⚠️ Xóa folder sẽ xóa tất cả file và folder con bên trong. Hãy kiểm tra kỹ trước khi xóa. |

### 5.4 Upload file vào Layer

Sau khi đã có cấu trúc folder, bạn có thể upload các file dữ liệu GIS vào layer tương ứng.

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | **Chọn Layer** | Trong danh sách bên trái, nhấn chọn layer muốn upload file vào. |
| 2 | **Chọn Folder đích** | Trong cây thư mục, nhấn chọn folder muốn lưu file. Nếu không chọn, file sẽ được upload vào thư mục gốc (root) của layer. |
| 3 | **Nhấn Upload File** | Nhấn nút **Upload File** trên thanh công cụ. |
| 4 | **Chọn file** | Nhấn **Browse** để duyệt và chọn file GIS từ máy tính. Các định dạng hỗ trợ: `.tif`, `.tiff`, `.geojson`, `.shp`, `.kml`, `.gpkg`, `.zip`. |
| 5 | **Chọn Category** (tùy chọn) | Nếu có, chọn danh mục phù hợp cho file dữ liệu (ví dụ: "default", "overview"). |
| 6 | **Nhấn Upload** | Nhấn nút **Upload** để bắt đầu tải file lên hệ thống. Hệ thống sẽ tự động: tạo bản ghi S3Object, liên kết với Layer và Folder, và thông báo kết quả. |

---

## 6. Quản lý Stations (Trạm quan trắc thủ công)

Trong tab **Dữ liệu** → phần **Manual Stations**, bạn có thể quản lý các trạm quan trắc thủ công (do con người thu thập số liệu tại thực địa).

### 6.1 Xem danh sách trạm

Danh sách các trạm quan trắc thủ công được hiển thị dưới dạng bảng với các thông tin sau:

| Cột thông tin | Mô tả | Ví dụ |
|:------------:|-------|:-----:|
| **Station ID** | Mã định danh duy nhất của trạm | `TV-01`, `SL-7` |
| **Type** | Loại trạm: `surface_water` (nước mặt) hoặc `groundwater` (nước ngầm) | `surface_water` |
| **Location** | Vị trí địa lý của trạm (xã, huyện) | "Xã Long Đức, TP Trà Vinh" |
| **Tọa độ (Lat/Lng)** | Vĩ độ và kinh độ theo hệ WGS84 | `9.8567, 106.2345` |
| **Image Code** | Mã hình ảnh hiện trường (nếu có) | `IMG_20260501` |
| **Trạng thái** | `Active` (đang hoạt động) / `Inactive` (ngừng hoạt động) | `Active` |

### 6.2 Thêm trạm mới

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | Nhấn nút **Add Station** | Nút nằm phía trên danh sách trạm. |
| 2 | Nhập **Station ID** | Mã định danh duy nhất cho trạm, nên đặt theo quy tắc thống nhất (ví dụ: `TV-01`, `TV-02`...). |
| 3 | Chọn **Type** | Chọn `surface_water` (nước mặt — sông, kênh, rạch) hoặc `groundwater` (nước ngầm — giếng khoan, giếng đào). |
| 4 | Nhập **Location** | Mô tả vị trí đặt trạm, ví dụ: "Ấp Ba Se, xã Long Đức, TP Trà Vinh". |
| 5 | Nhập **Lat / Lng** | Tọa độ địa lý của trạm (hệ WGS84). Có thể lấy từ thiết bị GPS hoặc Google Maps. |
| 6 | Nhập **Image Code** (tùy chọn) | Mã ảnh hiện trường nếu có ảnh chụp kèm theo. |
| 7 | Nhấn **Save** | Hệ thống sẽ lưu trạm mới vào cơ sở dữ liệu và cập nhật danh sách. |

### 6.3 Chỉnh sửa thông tin trạm

| Bước | Thao tác |
|:----:|----------|
| 1 | Trong danh sách trạm, nhấn chuột vào trạm cần sửa. |
| 2 | Một form chỉnh sửa hiện ra với các trường thông tin đã được điền sẵn. |
| 3 | Thay đổi các thông tin cần thiết (Station ID, Type, Location, tọa độ...). |
| 4 | Nhấn **Save** để lưu thay đổi. |

### 6.4 Xóa trạm

| Bước | Thao tác |
|:----:|----------|
| 1 | Nhấn nút **Delete** (🗑️) bên cạnh trạm muốn xóa. |
| 2 | Xác nhận hành động xóa trong hộp thoại. |
| 3 | Trạm sẽ bị xóa vĩnh viễn khỏi hệ thống. |

> ⚠️ **Lưu ý:** Khi xóa trạm, tất cả dữ liệu liên quan đến trạm đó (mẫu chất lượng nước, file dữ liệu) cũng sẽ bị ảnh hưởng.

### 6.5 Import Excel danh sách trạm

Tính năng này cho phép bạn thêm nhiều trạm cùng lúc từ một file Excel.

| Bước | Thao tác |
|:----:|----------|
| 1 | Nhấn nút **Import Excel**. |
| 2 | Chọn file Excel (`.xlsx` hoặc `.xls`) chứa danh sách trạm. File cần có các cột: Station ID, Type, Location, Lat, Lng, Image Code (nếu có). |
| 3 | Nhấn **Open** để tải file lên. |
| 4 | Hệ thống tự động phân tích dữ liệu từ file Excel và thêm các trạm vào cơ sở dữ liệu. |
| 5 | Thông báo kết quả hiện ra: số lượng trạm đã import thành công, số lượng bị lỗi (nếu có). |

---

## 7. Quản lý chất lượng nước (Water Quality)

Tab **Water Quality** cho phép bạn import dữ liệu chất lượng nước từ các file Excel theo mẫu, phục vụ công tác quan trắc và đánh giá chất lượng nước theo các tiêu chuẩn QCVN.

### 7.1 Preview file Excel (Xem trước dữ liệu)

Trước khi import chính thức, bạn nên xem trước dữ liệu để kiểm tra tính hợp lệ.

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | Trong tab **Dữ liệu**, kéo đến phần **Water Quality**. | |
| 2 | Nhấn nút **Preview Excel**. | Một hộp thoại chọn file hiện ra. |
| 3 | Chọn file Excel (`.xlsx` hoặc `.xls`) chứa dữ liệu chất lượng nước. | File cần đúng cấu trúc: các cột thông số (pH, EC, Salinity, DO...), hàng tiêu đề, hàng dữ liệu. |
| 4 | Chọn **Sample Date** (ngày lấy mẫu). | Ngày mà các mẫu nước được thu thập tại thực địa. |
| 5 | Nhấn **Preview**. | Hệ thống phân tích file và hiển thị dữ liệu xem trước dưới dạng bảng: danh sách các thông số, giá trị đo được, đơn vị, so sánh với tiêu chuẩn QCVN (nếu có). |

### 7.2 Import dữ liệu chính thức

Sau khi preview và kiểm tra dữ liệu hợp lệ:

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | Nhấn nút **Import** | Nút này chỉ khả dụng sau khi preview thành công. |
| 2 | Bật **Overwrite** (tùy chọn) | Bật nếu bạn muốn ghi đè lên dữ liệu đã có cùng ngày và trạm. Nếu không, dữ liệu trùng sẽ bị bỏ qua. |
| 3 | Nhấn **Confirm Import**. | Hệ thống lưu các mẫu chất lượng nước vào cơ sở dữ liệu: mỗi mẫu (sample) chứa nhiều thông số (parameter) như pH, EC, độ mặn, DO... |
| 4 | Kiểm tra kết quả. | Thông báo thành công hiện ra kèm số lượng mẫu đã import. |

### 7.3 Xem danh sách mẫu đã import

| Thông tin hiển thị | Mô tả |
|:------------------:|-------|
| **Trạm** | Tên trạm quan trắc đã lấy mẫu |
| **Ngày lấy mẫu** | Thời điểm thu thập mẫu nước |
| **Số lượng thông số** | Số thông số chất lượng nước được đo trong mẫu (pH, EC, Salinity, DO, TDS...) |
| **QCVN** | Tiêu chuẩn áp dụng (nếu có) |

### 7.4 Xóa mẫu

| Bước | Thao tác |
|:----:|----------|
| 1 | Trong danh sách mẫu, nhấn nút **Delete** (🗑️) bên cạnh mẫu muốn xóa. |
| 2 | Xác nhận hành động xóa. |
| 3 | Mẫu và tất cả các thông số liên quan sẽ bị xóa khỏi cơ sở dữ liệu. |

---

## 8. Quản lý dữ liệu quan trắc tự động (Monitoring Data)

Phần **Monitoring Data** trong tab **Dữ liệu** dành cho việc quản lý dữ liệu từ các trạm quan trắc tự động (telemetry) — các trạm này tự động ghi nhận và truyền dữ liệu về hệ thống.

### 8.1 Xem danh sách trạm tự động

| Thông tin hiển thị | Mô tả |
|:------------------:|-------|
| **Mã trạm** | Mã định danh của trạm quan trắc tự động |
| **Tên trạm** | Tên mô tả của trạm |
| **Nguồn dữ liệu** | Nguồn thu thập (ví dụ: API Mekong, Ecowitt) |
| **Trạng thái** | `Active` (đang hoạt động) / `Inactive` (ngừng hoạt động) |

### 8.2 Các thao tác quản lý

| Thao tác | Các bước thực hiện | Mô tả |
|----------|-------------------|-------|
| **Upload file CSV** | 1. Chọn trạm từ danh sách.<br>2. Nhấn **Upload**.<br>3. Chọn file CSV chứa dữ liệu.<br>4. Nhập thông số và ngày.<br>5. Nhấn **Upload**. | Dữ liệu CSV được lưu lên S3 và tạo bản ghi trong cơ sở dữ liệu. |
| **Download file** | 1. Chọn trạm.<br>2. Trong danh sách file dữ liệu, nhấn vào file cần tải. | File CSV được tải về máy. |
| **Xóa file** | 1. Chọn trạm.<br>2. Nhấn **Delete** bên cạnh file cần xóa.<br>3. Xác nhận. | File bị xóa khỏi S3 và cơ sở dữ liệu. |

> Dữ liệu được lưu trữ trên S3 theo cấu trúc: `monitoring-data/{stationCode}/{parameter}/{year}/{month}/{day}/{filename}`

---

## 9. Data Fetch & Export (Lấy và Xuất dữ liệu)

Tab **Dữ liệu** cung cấp các công cụ để lấy dữ liệu thủ công từ các nguồn API và xuất dữ liệu ra file Excel.

### 9.1 Kích hoạt fetch dữ liệu thủ công

Bạn có thể kích hoạt quá trình lấy dữ liệu từ hai nguồn chính:

#### Ecowitt (Dữ liệu thời tiết)

| Bước | Thao tác | Mô tả |
|:----:|----------|-------|
| 1 | Chọn nguồn **Ecowitt** từ bộ chọn nguồn dữ liệu. | Mặc định là Mekong. |
| 2 | Chọn **thiết bị** (device) từ danh sách xổ xuống. | Danh sách các trạm Ecowitt đã được đăng ký trong hệ thống. |
| 3 | Chọn **ngày** muốn lấy dữ liệu. | Mặc định là ngày hiện tại. Bạn có thể chọn ngày bất kỳ để lấy dữ liệu lịch sử. |
| 4 | Nhấn **Fetch Data**. | Hệ thống gọi API Ecowitt, lấy dữ liệu và lưu vào cơ sở dữ liệu. Quá trình có thể mất vài giây đến vài phút tùy dung lượng. |
| 5 | Kiểm tra kết quả. | Thông báo thành công hiện ra kèm số lượng bản ghi đã lấy. |

> Dữ liệu Ecowitt bao gồm: nhiệt độ, độ ẩm, tốc độ gió, lượng mưa, áp suất, bức xạ mặt trời, chỉ số UV — cập nhật theo từng phút.

#### Mekong API (Dữ liệu thủy văn)

| Bước | Thao tác | Mô tả |
|:----:|----------|-------|
| 1 | Chọn nguồn **Mekong** từ bộ chọn nguồn dữ liệu. | |
| 2 | Chọn **ngày** muốn lấy dữ liệu. | Mặc định là ngày hiện tại. |
| 3 | Nhấn **Fetch Data**. | Hệ thống gọi API Mekong (Rynan Mobile), lấy dữ liệu độ mặn, pH, mực nước, độ kiềm từ các cảm biến tại tỉnh Trà Vinh. |
| 4 | Kiểm tra kết quả. | Thông báo thành công hiện ra. |

> Dữ liệu Mekong API bao gồm: độ mặn (Salinity), pH, mực nước (WaterLevel), độ kiềm (Alkalinity) — cập nhật 5 lần mỗi ngày (00:00, 05:00, 10:00, 15:00, 20:00).

### 9.2 Export dữ liệu ra file Excel

Tính năng Export cho phép bạn xuất dữ liệu thủy văn ra file Excel để phục vụ báo cáo và phân tích ngoại tuyến.

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | Nhấn nút **Export Excel** (📥) trong tab Dữ liệu. | Một hộp thoại Export hiện ra. |
| 2 | Chọn **Chế độ xuất** (Mode). | **Monthly**: Xuất theo tháng (mỗi cột là một ngày trong tháng).<br>**Daily**: Xuất theo ngày cụ thể. |
| 3 | Chọn **Metric** (Thông số). | Salinity (Độ mặn), pH, WaterLevel (Mực nước), Alkalinity (Độ kiềm). |
| 4 | Chọn **Tỉnh** (Province). | Trà Vinh, Bến Tre, Vĩnh Long — tùy theo dữ liệu có sẵn. |
| 5 | Chọn **Thời gian** (Tháng/Năm). | Mặc định là tháng hiện tại. |
| 6 | Nhấn **Export**. | Hệ thống tạo file Excel và tải về máy tính của bạn. |

**Export hàng tháng có sẵn:**
Hệ thống tự động tạo các file export hàng tháng và lưu sẵn trong danh sách **Monthly Files**. Bạn có thể tải trực tiếp các file này mà không cần chờ tạo mới.

---

## 10. Tính toán Landuse (Sử dụng đất)

Tab **GIS** → **Landuse Compute** cung cấp công cụ phân tích biến động sử dụng đất dựa trên dữ liệu raster COG (Cloud Optimized GeoTIFF).

### 10.1 Xem thống kê sử dụng đất theo năm

| Thông tin hiển thị | Mô tả |
|:------------------:|-------|
| **Loại sử dụng đất** | Tên loại hình sử dụng đất (ví dụ: Aquaculture, Rice Cultivation, Perennial Crops...) |
| **Năm** | Năm phân tích |
| **Diện tích (ha)** | Diện tích tính bằng hecta |
| **Tỷ lệ (%)** | Phần trăm so với tổng diện tích khu vực nghiên cứu |
| **Số pixel** | Số lượng pixel đếm được từ ảnh raster |
| **Ngày tính toán** | Thời điểm chạy tính toán gần nhất |

### 10.2 Các thao tác

| Thao tác | Mô tả | Cách thực hiện |
|----------|-------|:---------------:|
| **Xem thống kê** | Hiển thị bảng thống kê diện tích các loại sử dụng đất theo năm | Kết quả hiển thị tự động khi vào tab Landuse Compute. |
| **Compute (Tính toán)** | Chạy lại quá trình tính toán landuse từ dữ liệu raster COG trên S3 | Nhấn nút **Compute**. Quá trình chạy bất đồng bộ — bạn có thể theo dõi tiến độ qua **Compute Status**. |
| **Inventory (Kiểm kê)** | So sánh dữ liệu trên S3 với dữ liệu đã được tính toán | Nhấn nút **Inventory** để xem danh sách các file raster đã được xử lý và chưa được xử lý. |
| **Theo dõi tiến độ** | Xem trạng thái của lần chạy Compute gần nhất | Phần **Compute Status** hiển thị: PENDING (đang chờ), RUNNING (đang chạy), COMPLETED (hoàn thành), FAILED (thất bại). |

> Quá trình tính toán Landuse sử dụng phương pháp đếm pixel trên ảnh raster COG trong hệ tọa độ UTM zone 48N, sau đó chuyển đổi sang diện tích hecta. Kết quả được lưu vào cơ sở dữ liệu để phục vụ tra cứu và hiển thị trên bản đồ.

---

## 11. Bảo mật và Lưu ý quan trọng

### 11.1 Nguyên tắc bảo mật

| Nguyên tắc | Mô tả | Mức độ ưu tiên |
|:----------:|-------|:--------------:|
| 🔑 **Không chia sẻ tài khoản** | Tuyệt đối không chia sẻ tên đăng nhập và mật khẩu với bất kỳ ai, kể cả đồng nghiệp. Mỗi người dùng nên có tài khoản riêng. | Cao |
| 🔐 **Đăng xuất sau khi sử dụng** | Luôn nhấn **Sign Out** sau khi kết thúc phiên làm việc, đặc biệt khi truy cập từ máy tính công cộng hoặc thiết bị dùng chung. | Cao |
| 📋 **Kiểm tra kỹ trước khi xóa** | Dữ liệu trên S3 khi đã xóa **không thể khôi phục**. Hãy kiểm tra kỹ hoặc tải file về máy trước khi thực hiện xóa. | Rất cao |
| 📂 **Tổ chức dữ liệu hợp lý** | Đặt tên file và thư mục theo quy tắc thống nhất, dễ hiểu. Tránh đặt tên file trùng lặp gây nhầm lẫn. | Trung bình |

### 11.2 Lưu ý kỹ thuật

| Lưu ý | Chi tiết |
|-------|----------|
| **Upload file dung lượng lớn** | File GIS (đặc biệt là raster GeoTIFF) có thể có dung lượng rất lớn (hàng trăm MB). Nên sử dụng kết nối internet ổn định, có băng thông tốt khi upload. |
| **Định dạng file Excel import** | File Excel dùng để import Manual Stations hoặc Water Quality phải đúng cấu trúc (số cột, tên cột, kiểu dữ liệu). Xem tài liệu kỹ thuật để biết mẫu chuẩn. |
| **Dữ liệu tự động từ cron job** | Hệ thống tự động lấy dữ liệu từ Ecowitt mỗi 15 phút và từ Mekong API 5 lần/ngày. Bạn không cần phải fetch thủ công trừ khi cần dữ liệu gấp hoặc dữ liệu lịch sử. |
| **Thời gian xử lý bất đồng bộ** | Một số tác vụ như Compute Landuse chạy bất đồng bộ (background). Nếu tab GIS không hiển thị kết quả ngay, hãy kiểm tra **Compute Status** để theo dõi tiến độ. |

---

## ❓ Câu hỏi thường gặp (FAQ)

| Câu hỏi | Trả lời |
|---------|---------|
| **Tôi upload file lên S3 nhưng không thấy hiển thị trên bản đồ WebGIS?** | Việc upload file lên S3 mới chỉ lưu file vào kho dữ liệu. Để file hiển thị trên bản đồ, bạn cần **đăng ký file vào Layer** qua tab **GIS**: chọn Layer → chọn Folder → nhấn **Upload File** để liên kết file với layer tương ứng. |
| **Tôi import Excel chất lượng nước nhưng báo lỗi?** | Kiểm tra các nguyên nhân sau: (1) File Excel không đúng cấu trúc mẫu — hãy đảm bảo các cột header và dữ liệu đúng định dạng; (2) Ngày tháng không hợp lệ; (3) Dữ liệu trùng lặp — hãy bật **Overwrite** nếu muốn ghi đè; (4) Ký tự đặc biệt trong dữ liệu. |
| **Làm thế nào để cập nhật dữ liệu thời tiết ngay lập tức?** | Vào tab **Dữ liệu** → chọn nguồn **Ecowitt** → chọn thiết bị → chọn ngày hôm nay → nhấn **Fetch Data**. Hệ thống sẽ gọi API Ecowitt và lấy dữ liệu mới nhất. |
| **Tôi có thể xóa nhiều file cùng lúc trên S3 không?** | Hiện tại chức năng S3 Explorer chỉ hỗ trợ xóa từng file một. Để xóa nhiều file, bạn có thể xóa cả thư mục chứa chúng. |
| **Làm sao để biết quá trình Compute Landuse đã hoàn thành?** | Vào tab **GIS** → **Landuse Compute** → xem phần **Compute Status**. Trạng thái `COMPLETED` nghĩa là đã xong. Bạn cũng có thể thấy kết quả thống kê hiển thị trong bảng bên dưới. |
| **Tôi có thể tạo tài khoản mới cho người dùng khác không?** | Với vai trò **DATA_MANAGER**, bạn **không có quyền** tạo/sửa/xóa tài khoản người dùng. Việc này chỉ dành cho **ADMIN**. Nếu cần thêm người dùng mới, vui lòng liên hệ quản trị viên. |
| **Dung lượng lưu trữ S3 có giới hạn không?** | Dung lượng phụ thuộc vào gói dịch vụ S3-compatible storage. Bạn có thể kiểm tra dung lượng đã sử dụng trong tab **Storage** → **Storage Stats** (thống kê hiển thị tổng dung lượng và số lượng file theo từng danh mục). |

---

## 📞 Hỗ trợ và Liên hệ

| Kênh hỗ trợ | Thông tin |
|:-----------:|-----------|
| **Website chính thức** | [https://mekongsaltlab.org](https://mekongsaltlab.org) |
| **Email** | Liên hệ qua địa chỉ email của các thành viên trong trang **About** |
| **Tài liệu hướng dẫn** | Các file hướng dẫn chi tiết theo từng vai trò trong thư mục `docs/` của dự án |
| **Báo cáo lỗi** | Gửi thông tin lỗi (kèm ảnh chụp màn hình nếu có) đến quản trị viên hệ thống |

---

*© 2026 MekongSaltLab. Tài liệu hướng dẫn dành cho Quản lý dữ liệu — Phiên bản 1.0.*
