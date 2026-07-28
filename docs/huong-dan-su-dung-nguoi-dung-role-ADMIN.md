# 📘 Hướng Dẫn Sử Dụng Hệ Thống MekongSaltLab — Vai Trò: **ADMIN**

> **Phiên bản:** 1.0 | **Cập nhật:** 25/07/2026  
> **Vai trò:** Quản trị viên — toàn quyền trên hệ thống, bao gồm quản lý người dùng, backup, và tất cả quyền của DATA_MANAGER.

---

## Mục Lục

1. [Tổng quan quyền hạn](#1-tổng-quan-quyền-hạn)
2. [Đăng nhập với tài khoản ADMIN](#2-đăng-nhập-với-tài-khoản-admin)
3. [Dashboard tổng quan](#3-dashboard-tổng-quan)
4. [Quản lý người dùng (Users)](#4-quản-lý-người-dùng-users)
   - 4.1 [Xem danh sách người dùng](#41-xem-danh-sách-người-dùng)
   - 4.2 [Thêm người dùng mới](#42-thêm-người-dùng-mới)
   - 4.3 [Sửa thông tin người dùng](#43-sửa-thông-tin-người-dùng)
   - 4.4 [Xóa người dùng](#44-xóa-người-dùng)
   - 4.5 [Vô hiệu hóa tài khoản](#45-vô-hiệu-hóa-tài-khoản)
5. [Sao lưu hệ thống (Backup)](#5-sao-lưu-hệ-thống-backup)
   - 5.1 [Trigger backup thủ công](#51-trigger-backup-thủ-công)
   - 5.2 [Backup tự động](#52-backup-tự-động)
6. [Quản lý S3 Storage](#6-quản-lý-s3-storage)
7. [Quản lý GIS & Dữ liệu](#7-quản-lý-gis--dữ-liệu)
8. [Quản lý bài viết](#8-quản-lý-bài-viết)
9. [Quản lý chất lượng nước](#9-quản-lý-chất-lượng-nước)
10. [Data Fetch & Export](#10-data-fetch--export)
11. [Tính toán Landuse](#11-tính-toán-landuse)
12. [Cấu hình hệ thống](#12-cấu-hình-hệ-thống)
    - 12.1 [Thay đổi Role qua MySQL](#121-thay-đổi-role-qua-mysql)
    - 12.2 [CORS & IP](#122-cors--ip)
13. [Bảo mật & Lưu ý](#13-bảo-mật--lưu-ý)

---

## 1. Tổng quan quyền hạn

Với vai trò **ADMIN**, bạn có **toàn quyền** trên hệ thống. Dưới đây là bảng so sánh đầy đủ:

| Module | USER | DATA_MANAGER | ADMIN |
|--------|:----:|:------------:|:-----:|
| 🗺️ **Bản đồ WebGIS** | ✅ | ✅ | ✅ |
| 📰 **Xem tin tức** | ✅ | ✅ | ✅ |
| 📥 **Download công khai** | ✅ | ✅ | ✅ |
| ☁️ **S3 Upload/Delete** | ❌ | ✅ | ✅ |
| 🗂️ **GIS CRUD** | ❌ | ✅ | ✅ |
| 📍 **Trạm quan trắc** | ❌ | ✅ | ✅ |
| 💧 **Chất lượng nước** | ❌ | ✅ | ✅ |
| 📰 **Xem danh sách bài viết** | ✅ | ✅ | ✅ |
| 📝 **Quản lý bài viết (Tạo/Sửa/Xóa)** | ❌ | ❌ | ✅ |
| 📊 **Data Fetch & Export** | ❌ | ✅ | ✅ |
| 👥 **Quản lý người dùng** | ❌ | ❌ | ✅ |
| 💾 **Trigger Backup** | ❌ | ❌ | ✅ |
| 🔧 **Cấu hình hệ thống** | ❌ | ❌ | ✅ |

> **Tài khoản mặc định:** `admin` / `admin123`

---

## 2. Đăng nhập với tài khoản ADMIN

1. Truy cập trang chủ → nhấn **Login**.
2. Nhập username: `admin`, password: `admin123`.
3. Sau khi đăng nhập, header hiển thị:
   - Tên người dùng: `admin (ADMIN)`
   - Nút **Quản trị**

---

## 3. Dashboard tổng quan

Sau khi nhấn **Quản trị**, giao diện trang quản trị hiện ra với tab **Overview** (Tổng quan) được chọn mặc định. Đây là trang dashboard cung cấp cái nhìn tổng thể về hệ thống.

### 3.1 Bố cục trang Dashboard

| Khu vực | Vị trí | Chức năng | Mô tả chi tiết |
|---------|:------:|-----------|----------------|
| **Thanh Header** | Phía trên cùng | Điều hướng & thông tin tài khoản | Logo MekongSaltLab (góc trái), tên tài khoản `admin (ADMIN)` (góc phải) cùng nút Sign Out. |
| **Thanh Tab điều hướng** | Bên dưới Header, hàng ngang | Chuyển đổi giữa các module quản trị | Gồm các tab: **📊 Tổng quan** (Overview), **👥 Users** (Người dùng), **☁️ Storage** (S3), **📋 Dữ liệu** (Data), **🗺️ GIS**, **📰 Bài viết** (News). Mỗi tab có biểu tượng và tên hiển thị. Tab đang chọn được làm nổi bật. |
| **Vùng thông tin tài khoản** | Phần trên của vùng nội dung | Hiển thị thông tin cá nhân | Bao gồm: Username, Email, Role, Ngày tạo tài khoản. Đây là thông tin của người dùng đang đăng nhập. |
| **Vùng thống kê hệ thống** | Phần dưới của vùng nội dung | Hiển thị các chỉ số hệ thống | Gồm các thông số: tổng số người dùng (users), số file trên S3, dung lượng lưu trữ đã sử dụng... |
| **Khu vực thông báo (Toast)** | Góc trên bên phải (xuất hiện khi cần) | Thông báo kết quả thao tác | Popup nhỏ với màu sắc phân biệt: xanh lá (thành công), đỏ (lỗi), xanh dương (thông tin). Tự động biến mất sau vài giây. |

### 3.2 Danh sách các tab ADMIN

So với DATA_MANAGER, ADMIN có thêm tab **Users**. Bảng dưới đây liệt kê tất cả các tab và quyền truy cập:

| Tab | Tên tiếng Anh | Biểu tượng | Mô tả chức năng | DATA_MANAGER | ADMIN |
|:---:|:-------------:|:----------:|-----------------|:------------:|:-----:|
| **Tổng quan** | Overview | 📊 | Dashboard tổng quan hệ thống: thông tin tài khoản, thống kê người dùng, file S3, dung lượng lưu trữ | ✅ | ✅ |
| **Users** | Users | 👥 | Quản lý người dùng: xem danh sách, thêm mới, sửa, xóa, vô hiệu hóa tài khoản | ❌ | ✅ |
| **Storage** | S3 Manager | ☁️ | Quản lý file trên S3: duyệt cây thư mục, upload, download, rename, copy, xóa, tạo folder, xem storage stats | ✅ | ✅ |
| **Dữ liệu** | Data | 📋 | Quản lý dữ liệu cảm biến: fetch Ecowitt/Mekong, export Excel, quản lý trạm, import chất lượng nước, monitoring data | ✅ | ✅ |
| **GIS** | GIS | 🗺️ | Quản lý dữ liệu không gian: Layers, Folders, upload GIS file, tính toán Landuse | ✅ | ✅ |
| **Bài viết** | News | 📰 | Quản lý bài viết tin tức: xem danh sách (DATA_MANAGER), tạo/sửa/xóa (ADMIN) | ✅ (xem) | ✅ (đầy đủ) |

### 3.3 Các thao tác cơ bản

| Thao tác | Mô tả | Cách thực hiện |
|----------|-------|:---------------:|
| **Chuyển đổi tab** | Di chuyển giữa các module quản trị | Nhấn vào tên tab trên thanh điều hướng ngang |
| **Xem thông tin tài khoản** | Kiểm tra thông tin người dùng đang đăng nhập | Tab **Overview** hiển thị sẵn thông tin này |
| **Theo dõi thống kê** | Xem các chỉ số hệ thống | Tab **Overview** → phần thống kê (tổng users, số file S3, dung lượng) |
| **Trigger Backup** | Kích hoạt sao lưu hệ thống thủ công | Tab **Overview** → nhấn nút **Trigger Backup** (💾) |
| **Xem thông báo** | Kiểm tra kết quả thao tác | Thông báo xuất hiện tự động ở góc phải |
| **Quay về trang chủ** | Trở về giao diện bản đồ WebGIS | Nhấn vào logo MekongSaltLab ở header |

---

## 4. Quản lý người dùng (Users)

Tab **Users** là tab **chỉ ADMIN mới nhìn thấy**. Đây là nơi bạn quản lý tất cả tài khoản người dùng trên hệ thống, bao gồm tạo mới, chỉnh sửa, xóa và vô hiệu hóa tài khoản.

### 4.1 Giao diện quản lý người dùng

Khi truy cập tab **Users**, giao diện gồm các khu vực sau:

| Khu vực | Mô tả |
|---------|-------|
| **Nút Add User** | Nút nằm phía trên bảng danh sách, cho phép thêm người dùng mới. |
| **Bảng danh sách người dùng** | Hiển thị tất cả tài khoản dưới dạng bảng với các cột: **ID** (mã số), **Username** (tên đăng nhập), **Email** (địa chỉ email), **Role** (vai trò), **Enabled** (trạng thái: ✔️ hoặc ❌), **Created At** (ngày tạo). Mỗi dòng có các nút hành động: **Edit** (✏️) và **Delete** (🗑️). |
| **Form thêm/sửa** | Hộp thoại hoặc panel hiện ra khi nhấn Add User hoặc Edit, chứa các trường nhập liệu. |

### 4.2 Xem danh sách người dùng

Bảng danh sách hiển thị đầy đủ thông tin của tất cả người dùng trong hệ thống:

| Cột | Mô tả | Ví dụ |
|:---:|-------|:-----:|
| **ID** | Mã định danh duy nhất (số nguyên, tự động tăng) | `1`, `2`, `3` |
| **Username** | Tên đăng nhập của người dùng | `admin`, `manager`, `user`, `nguyenvana` |
| **Email** | Địa chỉ email | `admin@example.com`, `user@example.com` |
| **Role** | Vai trò: `USER`, `DATA_MANAGER`, `ADMIN` | `ADMIN` |
| **Enabled** | Trạng thái kích hoạt: ✔️ (Enabled — có thể đăng nhập), ❌ (Disabled — bị khóa) | ✔️ |
| **Created At** | Ngày tạo tài khoản (định dạng: DD/MM/YYYY) | `25/07/2026` |

### 4.3 Thêm người dùng mới

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | Nhấn nút **Add User** | Nút nằm phía trên bảng danh sách. |
| 2 | Nhập **Username** | Tên đăng nhập, **bắt buộc**, phải là duy nhất trong hệ thống. Chỉ gồm chữ cái, số, dấu gạch dưới. Ví dụ: `nguyenvana`. |
| 3 | Nhập **Email** | Địa chỉ email, **bắt buộc**, phải là duy nhất. Ví dụ: `nguyenvana@example.com`. |
| 4 | Nhập **Password** | Mật khẩu, **bắt buộc khi tạo mới**, tối thiểu 6 ký tự. |
| 5 | Chọn **Role** | Chọn một trong 3 vai trò: `USER` (người dùng thường), `DATA_MANAGER` (quản lý dữ liệu), `ADMIN` (quản trị viên). |
| 6 | Chọn **Enabled** | Bật (✔️) để kích hoạt tài khoản ngay lập tức. Tắt (❌) nếu muốn tạo tài khoản nhưng chưa cho phép đăng nhập. |
| 7 | Nhấn **Save** | Hệ thống tạo tài khoản mới và cập nhật vào bảng danh sách. |

> **Vai trò nào phù hợp?** Tham khảo bảng quyền hạn ở mục [1. Tổng quan quyền hạn](#1-tổng-quan-quyền-hạn) để chọn vai trò phù hợp cho người dùng mới.

### 4.4 Sửa thông tin người dùng

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | Nhấn nút **Edit** (✏️) bên cạnh người dùng muốn sửa. | Hộp thoại chỉnh sửa hiện ra với thông tin hiện tại đã được điền sẵn. |
| 2 | Thay đổi các thông tin cần thiết: | |
| | • **Username** — có thể đổi tên đăng nhập | |
| | • **Email** — cập nhật địa chỉ email | |
| | • **Password** — để trống nếu không muốn đổi mật khẩu, nhập mật khẩu mới nếu muốn thay đổi | |
| | • **Role** — thay đổi vai trò nếu cần (ví dụ: nâng USER lên DATA_MANAGER) | |
| | • **Enabled** — bật/tắt trạng thái kích hoạt | |
| 3 | Nhấn **Save** để lưu thay đổi. | |

> ⚠️ **Tính năng tự bảo vệ:** Bạn **không thể tự thay đổi role của chính mình** (ví dụ: admin không thể tự hạ mình xuống USER). Điều này ngăn chặn việc mất quyền quản trị do vô tình hoặc sai sót.

### 4.5 Xóa người dùng

| Bước | Thao tác | Hậu quả |
|:----:|----------|---------|
| 1 | Nhấn nút **Delete** (🗑️) bên cạnh người dùng muốn xóa. | |
| 2 | Hộp thoại xác nhận hiện ra: *"Bạn có chắc chắn muốn xóa người dùng này?"* | |
| 3 | Nhấn **Confirm** (Xác nhận) để xóa. | Người dùng sẽ bị **xóa vĩnh viễn** khỏi hệ thống, không thể khôi phục. Các dữ liệu liên quan đến người dùng đó (bài viết, dataset) có thể bị ảnh hưởng. |

> ⚠️ **Cảnh báo:** Không nên xóa tài khoản nếu chưa chắc chắn. Thay vào đó, hãy **vô hiệu hóa** tài khoản (tắt Enabled).

### 4.6 Vô hiệu hóa tài khoản (thay vì xóa)

Vô hiệu hóa là giải pháp an toàn hơn xóa vì có thể kích hoạt lại bất kỳ lúc nào.

| Phương pháp | Cách thực hiện | Kết quả | Khôi phục được không? |
|:-----------:|----------------|---------|:---------------------:|
| **Vô hiệu hóa (Disable)** | Sửa người dùng → tắt **Enabled** → Save | Người dùng không thể đăng nhập. Toàn bộ dữ liệu vẫn còn nguyên. | ✅ Có — bật lại Enabled là được |
| **Xóa (Delete)** | Nhấn Delete → xác nhận | Người dùng và dữ liệu liên quan bị xóa vĩnh viễn. | ❌ Không — không thể khôi phục |

---

## 5. Sao lưu hệ thống (Backup)

Sao lưu (backup) là một trong những nhiệm vụ quan trọng nhất của quản trị viên. Hệ thống hỗ trợ cả hai hình thức: backup thủ công và backup tự động.

### 5.1 Backup thủ công (Trigger Backup)

Bạn có thể kích hoạt quá trình sao lưu ngay lập tức bất cứ lúc nào.

| Bước | Thao tác | Mô tả |
|:----:|----------|-------|
| 1 | Vào tab **Overview** (Tổng quan). | |
| 2 | Nhấn nút **Trigger Backup** (💾). | Nút này nằm trong phần thông tin hệ thống. |
| 3 | Hệ thống thực hiện quy trình backup tự động. | Quá trình này gồm các bước: |
| | • **📤 Dump database** — Xuất toàn bộ dữ liệu từ MySQL ra file SQL. | |
| | • **🗜️ Nén GZip** — Nén file SQL để giảm dung lượng (thường giảm 80-90%). | |
| | • **☁️ Upload lên S3** — Tải file nén lên S3 tại prefix `backup/`. | |
| 4 | Kiểm tra kết quả. | Thông báo thành công hiện ra. File backup có tên: `backup/mekong-{timestamp}.sql.gz` (ví dụ: `backup/mekong-20260725_000000.sql.gz`). |

### 5.2 Backup tự động hàng ngày

| Thông số | Giá trị |
|----------|---------|
| **Lịch chạy** | Mỗi ngày lúc **00:00** (nửa đêm) |
| **Cơ chế** | Spring `@Scheduled` trong `BackupService.java` |
| **Nội dung** | Toàn bộ database MySQL (tất cả bảng: users, layers, datasets, articles, ecowitt, mekong_sensor, ...) |
| **Định dạng file** | `backup/mekong-{yyyyMMdd}_{HHmmss}.sql.gz` |
| **Nơi lưu trữ** | S3 bucket, prefix `backup/` |
| **Kiểm tra** | Vào tab **Storage** → duyệt đến thư mục `backup/` để xem danh sách các file backup |

### 5.3 Kiểm tra và quản lý backup

| Thao tác | Cách thực hiện | Mục đích |
|----------|----------------|----------|
| **Xem danh sách backup** | Vào tab **Storage** → duyệt đến prefix `backup/` | Kiểm tra các file backup đã được tạo |
| **Tải backup về máy** | Chọn file backup → nhấn Download | Lưu backup ra ổ cứng ngoài để dự phòng |
| **Xóa backup cũ** | Chọn file backup cũ → nhấn Delete | Giải phóng dung lượng lưu trữ (chỉ xóa nếu đã có backup mới) |
| **Kiểm tra dung lượng** | Xem kích thước file backup | Đảm bảo backup được tạo đầy đủ (dung lượng thường từ vài MB đến vài trăm MB tùy lượng dữ liệu) |

---

## 6. Quản lý S3 Storage

Với quyền **ADMIN**, bạn có toàn quyền thao tác trên S3, bao gồm tất cả các quyền của DATA_MANAGER và thêm một số quyền đặc biệt. Xem hướng dẫn chi tiết về thao tác file/folder tại [Hướng dẫn DATA_MANAGER](./huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md#4-quản-lý-s3-storage).

### 6.1 Các quyền đặc biệt ADMIN có trên S3

| Quyền | Mô tả | Lợi ích |
|-------|-------|---------|
| **Xem Storage Stats** | Xem thống kê tổng dung lượng lưu trữ, số lượng file, dung lượng theo từng danh mục (`gis-data/`, `station-data/`, `monitoring-data/`, `news-images/`...) | Giúp quản trị viên theo dõi chi phí lưu trữ và lập kế hoạch mở rộng. |
| **Quản lý tất cả prefix** | DATA_MANAGER chỉ có thể xem các prefix công khai (`gis-data/`, `station-data/`, `news-images/`). ADMIN có thể xem và quản lý **tất cả** prefix trên S3, bao gồm `backup/` và các thư mục hệ thống khác. | Cho phép kiểm tra file backup, dọn dẹp dữ liệu hệ thống. |
| **Xóa dữ liệu ở mọi thư mục** | ADMIN có thể xóa file ở bất kỳ thư mục nào, kể cả thư mục hệ thống. | Dọn dẹp triệt để khi cần thiết. |

### 6.2 Storage Stats (Thống kê lưu trữ)

Truy cập tab **Storage** → nhấn nút **Storage Stats** để xem bảng thống kê:

| Chỉ số | Mô tả | Ý nghĩa quản trị |
|:------:|-------|------------------|
| **Total Size** | Tổng dung lượng lưu trữ đã sử dụng (MB/GB) | Theo dõi chi phí lưu trữ, lập kế hoạch mở rộng |
| **File Count** | Tổng số file trên S3 | Kiểm soát số lượng file, phát hiện file rác |
| **By Category** | Dung lượng phân bổ theo từng danh mục (ví dụ: `gis-data`: 5.2 GB, `station-data`: 1.1 GB...) | Xác định danh mục nào đang chiếm nhiều dung lượng nhất |

---

## 7. Quản lý GIS & Dữ liệu

Với quyền ADMIN, bạn có toàn quyền CRUD trên tất cả dữ liệu GIS. Xem hướng dẫn chi tiết tại [Hướng dẫn DATA_MANAGER](./huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md#5-quản-lý-dữ-liệu-gis).

**Điểm khác biệt so với DATA_MANAGER:**
- ADMIN có thể xóa bất kỳ layer, dataset, folder nào (kể cả của người dùng khác).
- ADMIN có thể thay đổi cấu trúc dữ liệu GIS ở mức hệ thống.

---

## 8. Quản lý bài viết (Articles)

> ⚠️ **Lưu ý quan trọng:** Chỉ **ADMIN** mới có quyền tạo, sửa và xóa bài viết. DATA_MANAGER chỉ có quyền xem danh sách và xem chi tiết bài viết (thông qua API GET).

Tab **Bài viết** (News Manager) trong trang Quản trị cho phép bạn quản lý toàn bộ nội dung tin tức trên hệ thống.

### 8.1 Giao diện quản lý bài viết

| Khu vực | Mô tả |
|---------|-------|
| **Nút New Article** | Nút màu xanh, nằm phía trên danh sách bài viết, dùng để tạo bài viết mới. |
| **Bảng danh sách bài viết** | Hiển thị các bài viết với: Tiêu đề, Danh mục, Trạng thái (Published/ Draft), Nổi bật (Featured), Ngày tạo. Mỗi dòng có nút **Edit** và **Delete**. |

### 8.2 Thêm bài viết mới

| Bước | Thao tác | Chi tiết |
|:----:|----------|----------|
| 1 | Nhấn nút **New Article** | Nút nằm phía trên bảng danh sách bài viết. |
| 2 | Nhập **Title** (Tiêu đề) | Tiêu đề bài viết, nên ngắn gọn nhưng đầy đủ ý nghĩa. Hệ thống sẽ tự động tạo **slug** từ tiêu đề. |
| 3 | Chọn **Category** (Danh mục) | Chọn một trong các danh mục có sẵn: *Cập nhật hệ thống*, *Dữ liệu*, *Thông báo*, *Sự kiện*, *Tính năng mới*, *Hướng dẫn*. |
| 4 | Nhập **Content** (Nội dung) | Nội dung chính của bài viết. Hỗ trợ HTML/rich text: có thể chèn hình ảnh, video, bảng biểu, định dạng văn bản (đậm, nghiêng, gạch đầu dòng...). |
| 5 | Nhập **Excerpt** (Tóm tắt) | Một đoạn ngắn (2-3 câu) mô tả nội dung bài viết, hiển thị ở trang danh sách. |
| 6 | Nhập **Tags** (Thẻ) | Các từ khóa phân cách bằng dấu phẩy, giúp phân loại và tìm kiếm bài viết (ví dụ: `xâm nhập mặn, biến đổi khí hậu, trà vinh`). |
| 7 | Nhập **Image URL** | Đường dẫn đến ảnh đại diện cho bài viết. Có thể upload ảnh lên S3 trước đó (mục `news-images/`). |
| 8 | Bật **Featured** (Nổi bật) | ✔️ Bài viết sẽ được gắn nhãn "Nổi bật" và ưu tiên hiển thị. |
| 9 | Bật **Published** (Xuất bản) | ✔️ Bài viết được xuất bản ngay và hiển thị công khai. ❌ Bài viết ở trạng thái nháp (draft), chỉ ADMIN/DATA_MANAGER xem được. |
| 10 | Nhấn **Save** | Lưu bài viết. Nếu Published được bật, bài viết sẽ xuất hiện ngay trên trang News. |

### 8.3 Sửa bài viết

| Bước | Thao tác |
|:----:|----------|
| 1 | Trong danh sách bài viết, nhấn nút **Edit** (✏️) bên cạnh bài viết cần sửa. |
| 2 | Form chỉnh sửa hiện ra với thông tin đã được điền sẵn. |
| 3 | Thay đổi các thông tin cần thiết (tiêu đề, nội dung, danh mục, trạng thái...). |
| 4 | Nhấn **Save** để lưu thay đổi. |

### 8.4 Xóa bài viết

| Bước | Thao tác |
|:----:|----------|
| 1 | Nhấn nút **Delete** (🗑️) bên cạnh bài viết muốn xóa. |
| 2 | Hộp thoại xác nhận hiện ra: *"Bạn có chắc chắn muốn xóa bài viết này?"* |
| 3 | Nhấn **Confirm** để xóa vĩnh viễn. |

---

## 9. Quản lý chất lượng nước (Water Quality)

Xem hướng dẫn chi tiết tại [Hướng dẫn DATA_MANAGER](./huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md#7-quản-lý-chất-lượng-nước-water-quality).

**Điểm khác biệt ADMIN:** ADMIN có thể xóa bất kỳ mẫu chất lượng nước nào, kể cả của người dùng khác.

---

## 10. Data Fetch & Export

Xem hướng dẫn chi tiết tại [Hướng dẫn DATA_MANAGER](./huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md#9-data-fetch--export).

---

## 11. Tính toán Landuse

Xem hướng dẫn chi tiết tại [Hướng dẫn DATA_MANAGER](./huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md#10-tính-toán-landuse).

---

## 12. Cấu hình hệ thống

### 12.1 Thay đổi Role người dùng qua MySQL

Trong một số trường hợp khẩn cấp (ví dụ: quên mật khẩu admin, cần cấp quyền gấp), bạn có thể thao tác trực tiếp trên cơ sở dữ liệu MySQL.

**Các bước thực hiện:**

| Bước | Lệnh SQL | Mô tả |
|:----:|----------|-------|
| 1 | `USE mekong;` | Kết nối vào database của hệ thống |
| 2 | `SELECT id, username, email, role, enabled FROM users;` | Xem danh sách tất cả người dùng |
| 3 | `UPDATE users SET role = 'DATA_MANAGER' WHERE username = 'user';` | Nâng quyền user thường thành DATA_MANAGER |
| 4 | `UPDATE users SET role = 'ADMIN' WHERE username = 'manager';` | Nâng quyền manager thành ADMIN |
| 5 | `UPDATE users SET enabled = false WHERE username = 'old_user';` | Vô hiệu hóa tài khoản không còn sử dụng |
| 6 | `UPDATE users SET enabled = true WHERE username = 'admin';` | Kích hoạt lại tài khoản admin nếu bị khóa |

> ⚠️ **Cảnh báo quan trọng:** Thao tác trực tiếp trên MySQL có thể gây hậu quả nghiêm trọng nếu sai cú pháp. Hãy **backup dữ liệu trước khi thực hiện** và chỉ dùng cách này khi không thể truy cập trang quản trị.

### 12.2 Cập nhật CORS và IP

Khi địa chỉ IP của máy chủ thay đổi, bạn cần cập nhật cấu hình CORS để frontend có thể kết nối đến backend.

| Cách thực hiện | Mô tả | Độ phức tạp |
|:--------------:|-------|:-----------:|
| **Sử dụng manage.sh (khuyên dùng)** | Chạy `./manage.sh` → chọn menu `9` (Đổi IP). Script tự động cập nhật: (1) IP mới vào CORS backend, (2) `NEXT_PUBLIC_API_URL` trong frontend `.env.local`. | Dễ |
| **Sửa thủ công application.yaml** | Mở file `backend/src/main/resources/application.yaml`, tìm dòng `allowedOrigins=` và thêm IP mới vào danh sách. | Trung bình |
| **Sửa thủ công .env.local** | Mở file `frontend/.env.local`, cập nhật `NEXT_PUBLIC_API_URL=http://{IP-mới}:8084/api`. | Dễ |

**Các origin được phép mặc định (CORS whitelist):**

| Origin | Mô tả |
|--------|-------|
| `http://localhost:3004` | Frontend chạy local (development) |
| `http://localhost:3000` | Frontend Next.js mặc định |
| `http://{server-ip}:3004` | Frontend trên máy chủ |
| `https://mekongsaltlab.org` | Tên miền chính thức |

### 12.3 Cấu hình hệ thống quan trọng khác

| Cấu hình | File | Mô tả |
|----------|------|-------|
| **JWT Secret** | `application.yaml` → `jwt.secret` | Khóa bí mật để ký token JWT. Nên thay đổi khi triển khai production. |
| **JWT Expiration** | `application.yaml` → `jwt.expiration` | Thời gian hết hạn token (mặc định: 24h). Có thể tăng/giảm tùy nhu cầu bảo mật. |
| **S3 Connection** | `.env` → `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Thông tin kết nối đến S3-compatible storage. |
| **Database** | `application.yaml` → `spring.datasource` | Kết nối MySQL: URL, username, password. |
| **CORS Allowed Origins** | `SecurityConfig.java` | Danh sách các origin được phép truy cập API. |

---

## 13. Bảo mật và Lưu ý

### 🔐 Nguyên tắc bảo mật cốt lõi

| Nguyên tắc | Mô tả | Mức độ |
|:----------:|-------|:------:|
| **Không chia sẻ tài khoản ADMIN** | Tài khoản ADMIN có toàn quyền hệ thống. Chỉ nên có 1-2 người được cấp quyền này. Không sử dụng tài khoản admin cho các thao tác hàng ngày thông thường. | 🔴 Tối cao |
| **Phân quyền tối thiểu (Principle of Least Privilege)** | Chỉ cấp quyền DATA_MANAGER cho những người thực sự cần upload và quản lý dữ liệu. Người dùng thông thường chỉ cần quyền USER. | 🟡 Cao |
| **Token JWT hết hạn** | Token JWT có thời hạn mặc định 24h. Nếu cần tăng cường bảo mật, có thể giảm xuống 8h hoặc 4h trong `application.yaml`. | 🟡 Cao |
| **Backup thường xuyên** | Kiểm tra backup tự động hàng ngày. Ngoài ra, nên tải backup về máy định kỳ (hàng tuần) để dự phòng. | 🟢 Trung bình |

### 📋 Lịch trình quản trị hệ thống

| Tác vụ | Tần suất | Mô tả | Ghi chú |
|--------|:--------:|-------|:-------:|
| **Kiểm tra backup** | Hàng ngày | Đảm bảo file backup được tạo lúc 00:00 và upload lên S3 thành công. | Vào tab Storage → prefix `backup/` |
| **Xem log lỗi** | Hàng tuần | Kiểm tra backend log tại `backend/nohup.out` và frontend log tại `frontend/.next/logs/`. Phát hiện lỗi sớm trước khi ảnh hưởng đến người dùng. | Nên dùng `grep -i error` để tìm nhanh |
| **Dọn dẹp S3** | Hàng tháng | Xóa các file không cần thiết: backup cũ (giữ lại 30 ngày gần nhất), file tạm, dữ liệu test. | Giải phóng dung lượng lưu trữ |
| **Cập nhật tài khoản** | Khi cần | Thêm người dùng mới, xóa người dùng đã nghỉ, thay đổi role phù hợp. | Tab Users |
| **Kiểm tra dung lượng** | Hàng tháng | Vào Storage Stats để xem tổng dung lượng và dung lượng theo danh mục. Đánh giá nhu cầu mở rộng. | Lập kế hoạch ngân sách |
| **Cập nhật phiên bản** | Khi có bản cập nhật | Cập nhật code mới nhất từ git, build lại frontend và backend. | Kiểm tra README.md |

### 🛠️ Xử lý sự cố thường gặp

| Sự cố | Nguyên nhân | Cách xử lý |
|:-----:|:-----------:|------------|
| **ADMIN không đăng nhập được** | Tài khoản bị vô hiệu hóa (enabled = false) hoặc sai mật khẩu | 1. Dùng MySQL: `UPDATE users SET enabled = true WHERE username = 'admin';`<br>2. Hoặc tạo tài khoản admin mới qua MySQL. |
| **Backup không hoạt động** | Mất kết nối S3, thiếu biến môi trường, ổ đĩa đầy | 1. Kiểm tra `S3_ACCESS_KEY` và `S3_SECRET_KEY` trong `.env`<br>2. Kiểm tra dung lượng ổ đĩa (`df -h`)<br>3. Xem log backend để biết lỗi chi tiết. |
| **CORS lỗi khi truy cập từ IP mới** | IP hiện tại chưa có trong danh sách allowed origins | Chạy `./manage.sh` → chọn `9` (Đổi IP) — script tự động cập nhật. |
| **Frontend không kết nối được backend** | `NEXT_PUBLIC_API_URL` sai, backend chưa chạy | 1. Kiểm tra backend đã chạy chưa (`ps aux \| grep java`)<br>2. Kiểm tra `.env.local` có đúng IP và port không.<br>3. Kiểm tra CORS. |
| **Dung lượng ổ đĩa đầy** | Log files quá lớn, file tạm, backup cũ | 1. Xóa log cũ: `> backend/nohup.out`<br>2. Xóa file tạm: `docker system prune` (nếu dùng Docker)<br>3. Dọn dẹp S3. |
| **Quên mật khẩu admin duy nhất** | Không còn tài khoản admin nào khác | 1. Kết nối MySQL: `USE mekong;`<br>2. Tạo admin mới: `INSERT INTO users (username, email, password, role, enabled) VALUES ('newadmin', 'newadmin@example.com', '$2a$10$...', 'ADMIN', true);`<br>3. Cần tạo bcrypt hash cho password. |

---

## 📋 Phụ lục: API Endpoints dành riêng cho ADMIN

| Endpoint | Method | Mô tả | Mẫu request/response |
|----------|--------|-------|---------------------|
| `/api/account/me` | **GET** | Xem thông tin tài khoản đang đăng nhập | Trả về: `{ id, username, email, role, enabled, createdAt }` |
| `/api/admin/users` | **GET** | Danh sách tất cả người dùng trong hệ thống | Trả về: mảng `[ { id, username, email, role, enabled, createdAt } ]` |
| `/api/admin/users` | **POST** | Tạo người dùng mới | Body: `{ username, email, password, role, enabled }` |
| `/api/admin/users/{id}` | **PUT** | Cập nhật thông tin người dùng | Body: `{ username, email, password?, role, enabled }` (password để trống nếu không đổi) |
| `/api/admin/users/{id}` | **DELETE** | Xóa người dùng | Trả về: `{ message: "User deleted successfully" }` |
| `/api/backup/trigger` | **POST** | Kích hoạt backup thủ công | Trả về: `{ message: "Backup triggered successfully" }` |
| `/api/s3/stats` | **GET** | Thống kê S3 storage | Trả về: `{ totalSize, fileCount, byCategory: { "gis-data/": 123456, ... } }` |

---

## 📞 Hỗ trợ và Liên hệ

| Kênh hỗ trợ | Thông tin |
|:-----------:|-----------|
| **Website chính thức** | [https://mekongsaltlab.org](https://mekongsaltlab.org) |
| **Tài liệu API (Swagger)** | `https://mekongsaltlab.org/swagger-ui/` |
| **Tài liệu hướng dẫn** | Các file hướng dẫn chi tiết theo từng vai trò trong thư mục `docs/` của dự án |
| **Báo cáo lỗi** | Gửi thông tin lỗi (kèm ảnh chụp màn hình, log lỗi nếu có) đến quản trị viên cấp cao hơn hoặc qua email trong trang About |

---

*© 2026 MekongSaltLab. Tài liệu hướng dẫn dành cho Quản trị viên hệ thống — Phiên bản 1.0.*
