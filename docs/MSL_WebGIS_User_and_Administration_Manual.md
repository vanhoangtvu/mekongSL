# SỔ TAY HƯỚNG DẪN SỬ DỤNG VÀ QUẢN TRỊ WEBGIS MEKONG SALT LAB

**Tên đề xuất:** Sổ tay hướng dẫn sử dụng, cập nhật dữ liệu và quản trị WebGIS Mekong Salt Lab  
**Tên tiếng Anh:** WebGIS User and Administration Manual  

> **Phiên bản:** 1.0 | **Cập nhật:** 25/07/2026  
> **Hệ thống:** MekongSaltLab – Nền tảng giám sát & trực quan hóa dữ liệu không gian địa lý Đồng bằng sông Cửu Long

---

## MỤC LỤC

- [Giới thiệu](#giới-thiệu)
- [Phần A. Hướng dẫn người dùng](#phần-a-hướng-dẫn-người-dùng)
  - [A.1 Truy cập portal](#a1-truy-cập-portal)
  - [A.2 Đăng nhập / Đăng ký](#a2-đăng-nhập--đăng-ký)
  - [A.3 Khám phá bản đồ WebGIS](#a3-khám-phá-bản-đồ-webgis)
  - [A.4 Bật và tắt layer](#a4-bật-và-tắt-layer)
  - [A.5 Xem chú giải](#a5-xem-chú-giải)
  - [A.6 Xem thông tin đối tượng (Inspector)](#a6-xem-thông-tin-đối-tượng-inspector)
  - [A.7 Xem biểu đồ](#a7-xem-biểu-đồ)
  - [A.8 Lọc dữ liệu](#a8-lọc-dữ-liệu)
  - [A.9 Tải dữ liệu](#a9-tải-dữ-liệu)
  - [A.10 In hoặc xuất bản đồ](#a10-in-hoặc-xuất-bản-đồ)
  - [A.11 Xem dữ liệu Cồn Chim và Hòa Lợi](#a11-xem-dữ-liệu-cồn-chim-và-hòa-lợi)
  - [A.12 Xem tin tức & bài viết](#a12-xem-tin-tức--bài-viết)
- [Phần B. Hướng dẫn quản trị](#phần-b-hướng-dẫn-quản-trị)
  - [B.1 Đăng nhập quản trị](#b1-đăng-nhập-quản-trị)
  - [B.2 Dashboard tổng quan](#b2-dashboard-tổng-quan)
  - [B.3 Quản lý S3 Storage](#b3-quản-lý-s3-storage)
  - [B.4 Quản lý dữ liệu GIS](#b4-quản-lý-dữ-liệu-gis)
  - [B.5 Thêm dataset](#b5-thêm-dataset)
  - [B.6 Cập nhật thuộc tính](#b6-cập-nhật-thuộc-tính)
  - [B.7 Tải dữ liệu quan trắc mới](#b7-tải-dữ-liệu-quan-trắc-mới)
  - [B.8 Quản lý trạm quan trắc](#b8-quản-lý-trạm-quan-trắc)
  - [B.9 Quản lý chất lượng nước](#b9-quản-lý-chất-lượng-nước)
  - [B.10 Thêm ảnh](#b10-thêm-ảnh)
  - [B.11 Cấu hình popup](#b11-cấu-hình-popup)
  - [B.12 Cấu hình legend](#b12-cấu-hình-legend)
  - [B.13 Phân quyền tài khoản](#b13-phân-quyền-tài-khoản)
  - [B.14 Quản lý bài viết](#b14-quản-lý-bài-viết)
  - [B.15 Sao lưu](#b15-sao-lưu)
  - [B.16 Phục hồi](#b16-phục-hồi)
  - [B.17 Data Fetch & Export](#b17-data-fetch--export)
  - [B.18 Tính toán Landuse](#b18-tính-toán-landuse)
  - [B.19 Cấu hình CORS và IP](#b19-cấu-hình-cors-và-ip)
- [Phụ lục](#phụ-lục)
  - [Bảng quyền hạn chi tiết](#bảng-quyền-hạn-chi-tiết)
  - [Thông tin truy cập](#thông-tin-truy-cập)
  - [Thuật ngữ](#thuật-ngữ)

---

## GIỚI THIỆU

**MekongSaltLab** là nền tảng giám sát và trực quan hóa dữ liệu không gian địa lý (WebGIS) dành cho khu vực Đồng bằng sông Cửu Long, với phạm vi tập trung chính vào tỉnh **Trà Vinh**. Hệ thống được phát triển nhằm hỗ trợ công tác quản lý tài nguyên nước, khí tượng thủy văn và môi trường thông qua các công cụ bản đồ tương tác mạnh mẽ.

Sổ tay này được chia làm hai phần:

- **Phần A – Hướng dẫn người dùng:** Dành cho tất cả người dùng (USER) muốn khám phá và sử dụng hệ thống.
- **Phần B – Hướng dẫn quản trị:** Dành cho quản lý dữ liệu (DATA_MANAGER) và quản trị viên (ADMIN) với các thao tác quản lý, cập nhật dữ liệu và cấu hình hệ thống.

---

## Phần A. HƯỚNG DẪN NGƯỜI DÙNG

### A.1 Truy cập portal

Hệ thống MekongSaltLab có thể truy cập qua các địa chỉ sau:

| Thông tin | Giá trị |
|-----------|---------|
| **URL Frontend** | `https://mekongsaltlab.org` |
| **Yêu cầu trình duyệt** | Google Chrome, Firefox, Microsoft Edge (phiên bản mới nhất) |
| **Hỗ trợ thiết bị** | Máy tính để bàn, máy tính bảng, điện thoại thông minh |

### A.2 Đăng nhập / Đăng ký

#### A.2.1 Đăng ký tài khoản mới

| Bước | Thao tác |
|:----:|----------|
| 1 | Tại trang chủ, nhấn nút **Login** ở góc phải header. |
| 2 | Chuyển sang tab **Sign Up**. |
| 3 | Điền **Username**, **Email**, **Password** (tối thiểu 6 ký tự). |
| 4 | Nhấn **Sign Up** để hoàn tất. Hệ thống tự động đăng nhập và chuyển về trang chủ. |

#### A.2.2 Đăng nhập

| Bước | Thao tác |
|:----:|----------|
| 1 | Nhấn nút **Login** trên header. |
| 2 | Tab **Sign In** được chọn mặc định. Nhập **Username** và **Password**. |
| 3 | Nhấn **Sign In**. Sau khi thành công, header hiển thị tên tài khoản và vai trò. |

#### A.2.3 Đăng xuất

Nhấn nút **Sign Out** ở góc phải header.

### A.3 Khám phá bản đồ WebGIS

#### A.3.1 Giao diện chính

| Khu vực | Vị trí | Chức năng |
|---------|:------:|-----------|
| **Thanh Header** | Phía trên cùng | Logo, slogan, nút Login/Sign Out, nút Quản trị (nếu có quyền) |
| **Thanh Tab** | Dưới Header | 3 tab: Data Sets, Additional Criteria, Results |
| **Sidebar trái** | Bên trái | Danh sách 8 danh mục dữ liệu dạng cây, checkbox chọn layer, nút Apply |
| **Khung bản đồ** | Trung tâm | Bản đồ OpenLayers với đầy đủ điều khiển phóng to/thu nhỏ |
| **Thanh công cụ bản đồ** | Dưới bản đồ | Layers, Download, Timeline, Time-Lapse, Change base layer |
| **Thanh Footer** | Phía dưới cùng | Liên kết nhanh, bản quyền |

#### A.3.2 Danh sách 8 danh mục dữ liệu

| Danh mục | Mô tả | Các lớp con | Loại |
|----------|-------|-------------|:----:|
| **Landsat Imagery** | 8 bands ảnh vệ tinh Landsat | Band 1-7, Composite RGB | Raster |
| **Administration** | Ranh giới hành chính Trà Vinh | Province, Commune, Hamlet | Vector |
| **Baseline Environment** | Dữ liệu nền môi trường | Landuse Planning (9 huyện), Soil Type, Channel System, Ground Water, Road, Landuse Classification | Raster & Vector |
| **Ecology** | Dữ liệu sinh thái | Biodiversity, NDVI, Habitat, Species, Mangroves | Vector |
| **Flooding Modeling** | Mô phỏng ngập lụt | Flooding Distribution, Flood Depth | Vector |
| **Hydrology Environment** | Dữ liệu thủy văn realtime | Salinity, Tidal, pH (theo giờ) | Raster |
| **Weather** | Dữ liệu thời tiết Ecowitt | Trạm thời tiết dạng marker | Điểm đo |
| **Water Quality** | Chất lượng nước | Surface Water, Ground Water | Điểm đo + biểu đồ |

### A.4 Bật và tắt layer

1. **Mở rộng danh mục:** Nhấn nút **+** bên trái tên danh mục.
2. **Chọn lớp:** Đánh dấu **checkbox** vào lớp muốn hiển thị.
3. **Chọn loại hiển thị:** Với lớp hỗ trợ cả Raster (R) và Vector (V), chọn nút tương ứng.
4. **Áp dụng:** Nhấn nút **Apply** ở cuối sidebar.

Để tắt layer, bỏ chọn checkbox và nhấn **Apply** lại.

### A.5 Xem chú giải

Nhấn nút **Layers** trên thanh công cụ bản đồ để mở bảng chú giải (legend). Bảng này hiển thị:

- Danh sách các layer đang hoạt động trên bản đồ
- Màu sắc và ký hiệu tương ứng cho từng lớp
- Có thể bật/tắt từng layer trực tiếp từ bảng chú giải

### A.6 Xem thông tin đối tượng (Inspector)

| Thao tác | Kết quả |
|----------|---------|
| **Hover** chuột lên lớp dữ liệu | Popup hiển thị thông tin chi tiết: thuộc tính, giá trị pixel, tọa độ |
| **Click vào trạm thời tiết** | Popup hiển thị nhiệt độ, độ ẩm, gió, mưa kèm biểu đồ sparkline |
| **Click vào trạm chất lượng nước** | Popup hiển thị thông số chất lượng nước và ảnh hiện trường |

### A.7 Xem biểu đồ

Hệ thống cung cấp biểu đồ cho các dữ liệu sau:

- **Thủy văn (Hydrology):** Biểu đồ diễn biến độ mặn, pH, thủy triều theo thời gian
- **Thời tiết (Weather):** Biểu đồ sparkline nhiệt độ, độ ẩm, gió, mưa trong popup trạm
- **Chất lượng nước:** Biểu đồ so sánh các thông số theo các đợt quan trắc
- **Sử dụng đất (Landuse):** Biểu đồ tròn/cột thống kê diện tích từng loại đất theo năm

### A.8 Lọc dữ liệu

Sử dụng tab **Additional Criteria** bên cạnh Data Sets để lọc dữ liệu theo:

- **Thời gian:** Chọn khoảng thời gian (ngày, tháng, năm) qua Timeline
- **Thông số:** Lọc theo loại dữ liệu (Salinity, pH, Tidal...)
- **Khu vực:** Lọc theo địa giới hành chính (huyện, xã)

Kết quả lọc hiển thị trong tab **Results**.

### A.9 Tải dữ liệu

#### A.9.1 Tải dữ liệu GIS công khai

| Bước | Thao tác |
|:----:|----------|
| 1 | Nhấn nút **Download data** trên thanh công cụ bản đồ. |
| 2 | Chọn lớp dữ liệu muốn tải. |
| 3 | Chọn định dạng (GeoJSON, Shapefile, GeoTIFF...). |
| 4 | Nhấn **Download**. File được tải về máy. |

#### A.9.2 Tải dữ liệu Excel

Người dùng DATA_MANAGER và ADMIN có thể xuất dữ liệu thủy văn ra Excel qua tab **Dữ liệu** > **Export Excel**.

### A.10 In hoặc xuất bản đồ

Hiện tại, người dùng có thể chụp ảnh màn hình bản đồ để in hoặc chia sẻ. Tính năng in trực tiếp từ hệ thống sẽ được phát triển trong phiên bản tiếp theo.

### A.11 Xem dữ liệu Cồn Chim và Hòa Lợi

**Cồn Chim** (xã Cồn Chim, huyện Càng Long) và **Hòa Lợi** (xã Hòa Lợi, huyện Càng Long) là hai khu vực nghiên cứu điển hình (case study) thuộc tỉnh Trà Vinh. Các lớp dữ liệu liên quan được nhóm trong danh mục **Cồn Chim và Hòa Lợi** trên sidebar.

Để xem dữ liệu:

1. Trên sidebar **Data Sets**, mở rộng danh mục **Cồn Chim và Hòa Lợi**.
2. Chọn các lớp dữ liệu mong muốn:
   - Lớp **Sử dụng đất** – bản đồ hiện trạng sử dụng đất từng thửa tại hai khu vực.
   - Lớp **Kênh rạch** – hệ thống kênh rạch nội đồng phục vụ tưới tiêu.
   - Lớp **Điểm quan trắc** – các điểm đo chất lượng nước mặt.
   - Lớp **Ảnh vệ tinh** – ảnh Landsat phủ khu vực.
3. Nhấn **Apply** để hiển thị lên bản đồ.

> **Mẹo:** Dùng **Zoom to Layer** để bản đồ tự động phóng tới đúng phạm vi khu vực Cồn Chim hoặc Hòa Lợi.

### A.12 Xem tin tức & bài viết

1. Truy cập trang **News** qua header hoặc footer.
2. Danh sách bài viết hiển thị dạng thẻ (card) với tiêu đề, tóm tắt, ngày đăng.
3. Nhấn vào bài viết để xem chi tiết.
4. Có thể lọc bài viết theo danh mục hoặc tìm kiếm bằng từ khóa.

---

## Phần B. HƯỚNG DẪN QUẢN TRỊ

### B.1 Đăng nhập quản trị

#### B.1.1 Tài khoản mặc định

| Vai trò | Username | Password |
|---------|----------|----------|
| DATA_MANAGER | `manager` | `manager123` |
| ADMIN | `admin` | `admin123` |

> **Lưu ý:** Đổi mật khẩu ngay sau khi đăng nhập lần đầu!

#### B.1.2 Truy cập trang Quản trị

1. Đăng nhập với tài khoản DATA_MANAGER hoặc ADMIN.
2. Nhấn nút **Quản trị** trên header để vào trang `/data`.
3. Giao diện quản trị gồm các tab: **Tổng quan**, **Storage**, **Dữ liệu**, **GIS**, **Bài viết**, **Users** (ADMIN).

### B.2 Dashboard tổng quan

Tab **Overview** hiển thị:

- Thông tin tài khoản đang đăng nhập (username, email, role, ngày tạo)
- Thống kê hệ thống: tổng người dùng, số file S3, dung lượng lưu trữ
- Nút **Trigger Backup** (ADMIN): kích hoạt sao lưu thủ công

### B.3 Quản lý S3 Storage

#### B.3.1 Giao diện S3 Explorer

| Khu vực | Chức năng |
|---------|-----------|
| **Cây thư mục (trái)** | Duyệt cấu trúc thư mục S3 |
| **Danh sách file (phải)** | Hiển thị file trong thư mục đang chọn |
| **Thanh công cụ** | Upload, New Folder, Download, Rename, Copy, Delete, Get Signed URL |

#### B.3.2 Cấu trúc thư mục S3

| Thư mục gốc | Mô tả | Định dạng |
|:-----------:|-------|:---------:|
| `gis-data/` | Dữ liệu GIS (raster & vector) | .tif, .geojson, .shp, .kml... |
| `station-data/` | Dữ liệu trạm thủ công | .csv |
| `monitoring-data/` | Dữ liệu trạm tự động | .csv |
| `news-images/` | Hình ảnh bài viết | .jpg, .png, .webp |

#### B.3.3 Upload file

1. Duyệt đến thư mục đích trong cây thư mục.
2. Nhấn **Upload** > chọn file từ máy tính.
3. Nhập **S3 Key** (tùy chọn) để đặt tên khác.
4. Bật **Overwrite** nếu muốn ghi đè.
5. Nhấn **Upload**.

#### B.3.4 Tạo thư mục mới

1. Nhấn **New Folder**.
2. Nhập tên thư mục.
3. Nhấn **Create**.

#### B.3.5 Sao chép & Di chuyển file

- **Copy:** Chọn file > Copy > duyệt đến thư mục đích > Paste
- **Rename:** Chọn file > Rename > nhập tên mới > Save
- **Move:** Copy + Paste sau đó Delete file gốc

#### B.3.6 Xóa file

> **Cảnh báo:** Hành động xóa là **vĩnh viễn**, không thể khôi phục.

1. Chọn file > nhấn **Delete**.
2. Xác nhận trong hộp thoại.

### B.4 Quản lý dữ liệu GIS

#### B.4.1 Giao diện tab GIS

| Khu vực | Chức năng |
|---------|-----------|
| **Danh sách Layer (trái)** | Tất cả GIS layers, hiển thị ID, tên, loại (RASTER/VECTOR) |
| **Cây thư mục Folder (phải trên)** | Cấu trúc folder trong layer đang chọn |
| **Khu vực thao tác (phải dưới)** | New Folder, Upload File, Delete |

#### B.4.2 Quản lý Folder trong Layer

| Thao tác | Các bước |
|----------|----------|
| **Xem cây thư mục** | Chọn Layer > cây thư mục tự động hiển thị |
| **Tạo folder mới** | New Folder > nhập tên > chọn folder cha > Save |
| **Xóa folder** | Chọn folder > Delete > xác nhận (xóa cả file con) |

### B.5 Thêm dataset

Dataset là một lớp dữ liệu trong hệ thống WebGIS. Để thêm dataset mới, ADMIN cần thao tác qua MySQL (hiện chưa có giao diện quản trị cho chức năng này). Vui lòng liên hệ quản trị viên hệ thống để được hỗ trợ.

### B.6 Cập nhật thuộc tính

Để cập nhật thuộc tính của một lớp dữ liệu:

1. Vào tab **GIS** > chọn Layer.
2. Chọn Folder chứa file dữ liệu.
3. Upload file dữ liệu mới (ghi đè lên file cũ nếu cần).
4. Hệ thống tự động cập nhật hiển thị trên bản đồ.

### B.7 Tải dữ liệu quan trắc mới

#### B.7.1 Upload dữ liệu trạm thủ công (Station Data)

1. Vào tab **Storage**.
2. Duyệt đến `station-data/{stationCode}/{parameter}/{year}/{month}/{day}/`.
3. Nhấn **Upload** > chọn file CSV.

### B.8 Quản lý trạm quan trắc

#### B.8.1 Xem danh sách trạm

Vào tab **Dữ liệu** > **Manual Stations** để xem bảng danh sách trạm với các thông tin: Station ID, Type (surface_water/groundwater), Location, Tọa độ (Lat/Lng), Image Code, Trạng thái.

#### B.8.2 Thêm trạm mới

1. Nhấn **Add Station**.
2. Nhập Station ID, chọn Type, nhập Location, Lat/Lng.
3. Nhập Image Code (tùy chọn).
4. Nhấn **Save**.

#### B.8.3 Import Excel danh sách trạm

1. Nhấn **Import Excel**.
2. Chọn file Excel (các cột: Station ID, Type, Location, Lat, Lng, Image Code).
3. Nhấn **Open**. Hệ thống tự động thêm các trạm vào cơ sở dữ liệu.

#### B.8.4 Sửa / Xóa trạm

- **Sửa:** Nhấn vào trạm > form chỉnh sửa > thay đổi thông tin > **Save**.
- **Xóa:** Nhấn **Delete** > xác nhận (xóa cả dữ liệu liên quan).

### B.9 Quản lý chất lượng nước

#### B.9.1 Preview file Excel

1. Tab **Dữ liệu** > **Water Quality** > **Preview Excel**.
2. Chọn file Excel > chọn Sample Date > **Preview**.
3. Hệ thống hiển thị dữ liệu xem trước kèm so sánh QCVN.

#### B.9.2 Import dữ liệu

1. Sau khi preview thành công, nhấn **Import**.
2. Bật **Overwrite** nếu muốn ghi đè.
3. Nhấn **Confirm Import**.

#### B.9.3 Xóa mẫu

Nhấn **Delete** bên cạnh mẫu muốn xóa > xác nhận.

### B.10 Thêm ảnh

#### B.10.1 Ảnh trạm quan trắc

1. Upload ảnh lên S3 tại `station-data/manual-stations/`.
2. Ghi lại mã ảnh (imageCode).
3. Cập nhật imageCode vào trạm tương ứng qua tab **Manual Stations**.

#### B.10.2 Ảnh bài viết

1. Upload ảnh lên S3 tại `news-images/{article-slug}/`.
2. Khi tạo/sửa bài viết, nhập đường dẫn ảnh vào trường **Image URL**.

### B.11 Cấu hình popup

Popup thông tin đối tượng được cấu hình ở backend. Để thay đổi nội dung popup:

1. Sửa file cấu hình trong source code backend.
2. Deploy lại backend.

> *Hiện tại chưa có giao diện quản trị để cấu hình popup. Tính năng này sẽ được phát triển trong phiên bản sau.*

### B.12 Cấu hình legend

Legend (chú giải) được tự động tạo dựa trên dữ liệu layer. Để thay đổi:

1. Cập nhật style/màu sắc trong file cấu hình frontend.
2. Deploy lại frontend.

### B.13 Phân quyền tài khoản

#### B.13.1 Xem danh sách người dùng (ADMIN)

Vào tab **Users** để xem bảng danh sách: ID, Username, Email, Role, Enabled, Created At.

#### B.13.2 Thêm người dùng mới (ADMIN)

1. Nhấn **Add User**.
2. Nhập Username, Email, Password.
3. Chọn Role (USER / DATA_MANAGER / ADMIN).
4. Bật Enabled nếu muốn kích hoạt ngay.
5. Nhấn **Save**.

#### B.13.3 Sửa thông tin người dùng (ADMIN)

1. Nhấn **Edit** bên cạnh người dùng.
2. Thay đổi thông tin (để trống Password nếu không đổi).
3. Nhấn **Save**.

> **Lưu ý:** ADMIN không thể tự thay đổi role của chính mình.

#### B.13.4 Vô hiệu hóa / Xóa người dùng (ADMIN)

- **Vô hiệu hóa:** Tắt **Enabled** > Save. Có thể kích hoạt lại bất kỳ lúc nào.
- **Xóa:** Nhấn **Delete** > xác nhận. **Không thể khôi phục.**

### B.14 Quản lý bài viết

#### B.14.1 Tạo bài viết mới (ADMIN)

1. Vào tab **Bài viết** > **New Article**.
2. Nhập **Title** (tự động tạo slug).
3. Chọn **Category:** Cập nhật hệ thống, Dữ liệu, Thông báo, Sự kiện, Tính năng mới, Hướng dẫn.
4. Nhập **Content** (hỗ trợ HTML/rich text).
5. Nhập **Excerpt** (tóm tắt 2-3 câu).
6. Nhập **Tags** (phân cách bằng dấu phẩy).
7. Nhập **Image URL** (ảnh đại diện).
8. Bật **Featured** nếu muốn gắn nhãn "Nổi bật".
9. Bật **Published** để xuất bản ngay (tắt = lưu nháp).
10. Nhấn **Save**.

#### B.14.2 Sửa / Xóa bài viết (ADMIN)

- **Sửa:** Nhấn **Edit** > thay đổi > **Save**.
- **Xóa:** Nhấn **Delete** > **Confirm**.

### B.15 Sao lưu

#### B.15.1 Backup tự động

| Thông số | Giá trị |
|----------|---------|
| **Lịch chạy** | Mỗi ngày lúc **00:00** |
| **Nội dung** | Toàn bộ database MySQL |
| **Định dạng** | `backup/mekong-{yyyyMMdd}_{HHmmss}.sql.gz` |
| **Nơi lưu** | S3 bucket, prefix `backup/` |

#### B.15.2 Backup thủ công (ADMIN)

1. Vào tab **Overview**.
2. Nhấn nút **Trigger Backup**.
3. Hệ thống thực hiện: dump database > nén GZip > upload lên S3.
4. Kiểm tra file backup tại tab **Storage** > prefix `backup/`.

### B.16 Phục hồi

Để phục hồi dữ liệu từ file backup:

1. Tải file `.sql.gz` từ S3 (tab **Storage** > prefix `backup/`).
2. Giải nén: `gunzip backup-file.sql.gz`.
3. Import vào MySQL: `mysql -u root -p mekong < backup-file.sql`.

> **Cảnh báo:** Thao tác này chỉ dành cho ADMIN và cần thực hiện trực tiếp trên server.

### B.17 Data Fetch & Export

#### B.17.1 Kích hoạt fetch dữ liệu thủ công

**Ecowitt (Dữ liệu thời tiết):**

1. Tab **Dữ liệu** > chọn nguồn **Ecowitt**.
2. Chọn thiết bị (device) từ danh sách.
3. Chọn ngày > nhấn **Fetch Data**.

**Mekong API (Dữ liệu thủy văn):**

1. Tab **Dữ liệu** > chọn nguồn **Mekong**.
2. Chọn ngày > nhấn **Fetch Data**.

#### B.17.2 Export dữ liệu Excel

1. Nhấn **Export Excel** trong tab Dữ liệu.
2. Chọn chế độ: **Monthly** (theo tháng) hoặc **Daily** (theo ngày).
3. Chọn Metric (Salinity, pH, WaterLevel, Alkalinity).
4. Chọn Tỉnh (Trà Vinh, Bến Tre, Vĩnh Long).
5. Chọn Thời gian > nhấn **Export**.

### B.18 Tính toán Landuse

1. Vào tab **GIS** > **Landuse Compute**.
2. Xem thống kê diện tích sử dụng đất theo năm.
3. Nhấn **Compute** để chạy lại tính toán (bất đồng bộ).
4. Theo dõi tiến độ qua **Compute Status**.
5. Nhấn **Inventory** để kiểm tra file raster đã xử lý.

### B.19 Cấu hình CORS và IP

Khi địa chỉ IP máy chủ thay đổi:

- **Khuyên dùng:** Chạy `./manage.sh` > chọn `9` (Đổi IP).
- **Thủ công:** Sửa `application.yaml` (allowedOrigins) và `.env.local` (NEXT_PUBLIC_API_URL).

Để thay đổi Role người dùng qua MySQL trong trường hợp khẩn cấp:

```sql
USE mekong;
-- Xem danh sách người dùng
SELECT id, username, email, role, enabled FROM users;
-- Thay đổi role
UPDATE users SET role = 'DATA_MANAGER' WHERE username = 'user';
-- Vô hiệu hóa tài khoản
UPDATE users SET enabled = false WHERE username = 'old_user';
```

> **Cảnh báo:** Sao lưu dữ liệu trước khi thao tác trực tiếp trên MySQL!

---

## Phụ lục

### Bảng quyền hạn chi tiết

| Chức năng | USER | DATA_MANAGER | ADMIN |
|-----------|:----:|:------------:|:-----:|
| Xem bản đồ WebGIS | Có | Có | Có |
| Xem tin tức | Có | Có | Có |
| Tải dữ liệu công khai | Có | Có | Có |
| Đăng nhập/Đăng ký | Có | Có | Có |
| Dashboard tổng quan | Không | Có | Có |
| Upload file S3 | Không | Có | Có |
| Xóa file S3 | Không | Có | Có |
| Tạo/Copy/Rename folder S3 | Không | Có | Có |
| Quản lý GIS Layers | Không | Có | Có |
| Quản lý trạm quan trắc | Không | Có | Có |
| Import chất lượng nước | Không | Có | Có |
| Quản lý bài viết (CRUD) | Không | Không | Có |
| Kích hoạt fetch dữ liệu | Không | Có | Có |
| Export Excel | Không | Có | Có |
| Tính toán Landuse | Không | Có | Có |
| Quản lý người dùng | Không | Không | Có |
| Trigger backup | Không | Không | Có |

### Thông tin truy cập

| Thông tin | Giá trị |
|-----------|---------|
| **URL Frontend** | `https://mekongsaltlab.org` |
| **URL Backend API** | `http://103.54.251.212:8084` |
| **Swagger API Docs** | `https://mekongsaltlab.org/swagger-ui/` |

### Tài khoản mặc định

| Vai trò | Username | Password |
|---------|----------|----------|
| USER | `user` | `user123` |
| DATA_MANAGER | `manager` | `manager123` |
| ADMIN | `admin` | `admin123` |

> **Lưu ý:** Đổi mật khẩu ngay sau khi đăng nhập lần đầu!

### Thuật ngữ

| Thuật ngữ | Giải thích |
|-----------|------------|
| **WebGIS** | Hệ thống thông tin địa lý trên nền web, sử dụng OpenLayers 10.9 |
| **Frontend** | Giao diện người dùng (Next.js 15 + React 19) |
| **Backend** | Máy chủ xử lý (Spring Boot 4.0, Java 17) |
| **API** | Giao tiếp giữa Frontend và Backend (RESTful, JSON) |
| **S3** | Kho chứa file tập trung (S3-compatible object storage) |
| **GeoTIFF** | File ảnh có kèm thông tin tọa độ bản đồ |
| **COG** | Cloud Optimized GeoTIFF – tối ưu cho web |
| **GeoJSON** | Định dạng vector JSON cho dữ liệu không gian |
| **DXF** | Bản vẽ kỹ thuật từ AutoCAD, đã chuyển sang GeoJSON |
| **JWT** | JSON Web Token – xác thực người dùng |
| **UTM 48N** | Hệ tọa độ bản đồ (EPSG:32648) cho Đồng bằng sông Cửu Long |
| **Layer** | Một lớp dữ liệu trên bản đồ (raster/vector) |
| **Raster** | Dữ liệu dạng ảnh lưới (pixel) |
| **Vector** | Dữ liệu dạng đối tượng hình học (điểm, đường, đa giác) |

---

*Bản quyền 2026 MekongSaltLab. Sổ tay hướng dẫn sử dụng và quản trị WebGIS – Phiên bản 1.0.*  
*Tài liệu do Hoàng và Duy lập bản thảo.*
