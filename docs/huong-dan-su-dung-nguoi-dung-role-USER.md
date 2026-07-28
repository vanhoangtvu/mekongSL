# 📘 Hướng Dẫn Sử Dụng Hệ Thống MekongSaltLab — Vai Trò: **USER**

> **Phiên bản:** 1.0 | **Cập nhật:** 25/07/2026  
> **Vai trò:** Người dùng thường — quyền xem dữ liệu, không can thiệp hệ thống.

---

## Mục Lục

1. [Giới thiệu hệ thống](#1-giới-thiệu-hệ-thống)
2. [Đăng nhập / Đăng ký](#2-đăng-nhập--đăng-ký)
3. [Khám phá bản đồ WebGIS](#3-khám-phá-bản-đồ-webgis)
   - 3.1 [Giao diện chính](#31-giao-diện-chính)
   - 3.2 [Chọn lớp dữ liệu (Data Sets)](#32-chọn-lớp-dữ-liệu-data-sets)
   - 3.3 [Thao tác với bản đồ](#33-thao-tác-với-bản-đồ)
   - 3.4 [Chuyển đổi nền bản đồ (Base Layers)](#34-chuyển-đổi-nền-bản-đồ-base-layers)
   - 3.5 [Timeline & Time-Lapse](#35-timeline--time-lapse)
   - 3.6 [Kiểm tra thông tin (Inspector)](#36-kiểm-tra-thông-tin-inspector)
   - 3.7 [Xem dữ liệu thời tiết (Weather Popup)](#37-xem-dữ-liệu-thời-tiết-weather-popup)
4. [Xem tin tức & bài viết](#4-xem-tin-tức--bài-viết)
5. [Tải dữ liệu GIS công khai](#5-tải-dữ-liệu-gis-công-khai)
6. [Xem thông tin dự án](#6-xem-thông-tin-dự-án)

---

## 1. Giới thiệu hệ thống

**MekongSaltLab** là nền tảng giám sát và trực quan hóa dữ liệu không gian địa lý (WebGIS) dành cho khu vực Đồng bằng sông Cửu Long, với phạm vi tập trung chính vào tỉnh **Trà Vinh**. Hệ thống được phát triển nhằm hỗ trợ công tác quản lý tài nguyên nước, khí tượng thủy văn và môi trường thông qua các công cụ bản đồ tương tác mạnh mẽ.

### 1.1 Các thành phần chính của hệ thống

| Thành phần | Mô tả chi tiết |
|------------|----------------|
| 🗺️ **Bản đồ tương tác (WebGIS)** | Bản đồ trung tâm sử dụng công nghệ OpenLayers, cho phép hiển thị đồng thời nhiều lớp dữ liệu không gian như ảnh vệ tinh, bản đồ hành chính, hệ thống kênh rạch, bản đồ sử dụng đất, dữ liệu độ mặn, thủy triều, pH theo thời gian thực. |
| 📡 **Dữ liệu thời tiết realtime** | Dữ liệu được thu thập từ các trạm thời tiết Ecowitt đặt tại khu vực Trà Vinh, cập nhật mỗi 15 phút, bao gồm nhiệt độ, độ ẩm, tốc độ gió, lượng mưa, bức xạ mặt trời và chỉ số UV. |
| 🌊 **Dữ liệu thủy văn** | Dữ liệu độ mặn (Salinity), độ pH, thủy triều (Tidal) và các thông số chất lượng nước khác được thu thập từ hệ thống cảm biến tự động qua API Mekong, cập nhật 5 lần mỗi ngày. |
| 📊 **Phân tích biến động sử dụng đất (Landuse)** | Hệ thống phân tích dữ liệu raster từ ảnh vệ tinh để tính toán diện tích các loại hình sử dụng đất như nuôi trồng thủy sản, lúa, cây ăn trái, rừng ngập mặn... theo từng năm. |
| 📰 **Tin tức và bài viết** | Cập nhật các thông tin mới nhất về dự án, các giải pháp thích ứng với biến đổi khí hậu và xâm nhập mặn tại Đồng bằng sông Cửu Long. |

### 1.2 Thông tin truy cập

| Thông tin | Giá trị |
|-----------|---------|
| **Địa chỉ trang chủ** | `https://mekongsaltlab.org` |
| **Yêu cầu trình duyệt** | Google Chrome, Firefox, Microsoft Edge (phiên bản mới nhất) |
| **Hỗ trợ thiết bị** | Máy tính để bàn, máy tính bảng, điện thoại thông minh |

---

## 2. Đăng nhập và Đăng ký tài khoản

Hệ thống hỗ trợ hai hình thức: đăng ký tài khoản mới hoặc đăng nhập bằng tài khoản đã có sẵn.

### 2.1 Hướng dẫn đăng ký tài khoản mới

| Bước | Thao tác | Hình ảnh minh họa |
|:----:|----------|:-----------------:|
| 1 | Tại trang chủ, nhấn nút **Login** nằm ở góc phải phía trên cùng của header. | Header button |
| 2 | Trang đăng nhập hiện ra, nhấn chuyển sang tab **Sign Up** (Đăng ký). | Tab switch |
| 3 | Điền đầy đủ thông tin vào các trường bắt buộc: | Form fields |
| | • **Username** (Tên đăng nhập): Ví dụ `nguyenvana`. Tên đăng nhập phải là duy nhất, không trùng với người dùng khác. | |
| | • **Email**: Địa chỉ email hợp lệ để liên hệ khi cần thiết. | |
| | • **Password** (Mật khẩu): Tối thiểu 6 ký tự, nên kết hợp chữ và số để đảm bảo an toàn. | |
| 4 | Nhấn nút **Sign Up** để hoàn tất đăng ký. | Submit button |
| 5 | Hệ thống sẽ tự động đăng nhập và chuyển hướng bạn về trang chủ. Lúc này, header đã hiển thị tên tài khoản của bạn. | Auto redirect |

### 2.2 Hướng dẫn đăng nhập

| Bước | Thao tác |
|:----:|----------|
| 1 | Nhấn nút **Login** trên thanh header màu xanh ở phía trên cùng. |
| 2 | Tab **Sign In** (Đăng nhập) được chọn mặc định. Nhập **Username** (tên đăng nhập) vào trường đầu tiên. |
| 3 | Nhập **Password** (mật khẩu) vào trường thứ hai. Mật khẩu được ẩn dấu dạng `••••••`. |
| 4 | Nhấn nút **Sign In** để đăng nhập. |
| 5 | Sau khi đăng nhập thành công, góc phải header hiển thị thông tin: biểu tượng người dùng, tên tài khoản và vai trò (ví dụ: `user (USER)`), cùng nút **Sign Out** (màu đỏ) và nút **Quản trị** (nếu có quyền). |

### 2.3 Đăng xuất

Để đăng xuất, nhấn nút **Sign Out** (màu đỏ, có biểu tượng ổ khóa) nằm ở góc phải của thanh header. Hệ thống sẽ đăng xuất và đưa bạn về trang chủ.

### 2.4 Lưu ý về bảo mật tài khoản

- Không chia sẻ mật khẩu với bất kỳ ai.
- Nếu quên mật khẩu, vui lòng liên hệ quản trị viên hệ thống để được cấp lại.
- Nên đăng xuất sau khi sử dụng, đặc biệt khi truy cập từ máy tính công cộng.

---

## 3. Khám phá bản đồ WebGIS

### 3.1 Giao diện chính — Bố cục tổng thể

Khi truy cập vào trang chủ, màn hình được chia thành các khu vực chức năng như sau:

| Khu vực | Vị trí | Chức năng | Mô tả chi tiết |
|---------|:------:|-----------|----------------|
| **Thanh Header** | Phía trên cùng, dải màu xanh gradient (#163c66 → #20538c) | Điều hướng chính & thông tin tài khoản | Chứa logo MekongSaltLab (góc trái), slogan "Empowering Sustainable Water Management Through Data", và các nút chức năng như Login, Quản trị, Sign Out (góc phải). Header cố định khi cuộn trang. |
| **Thanh Tab** | Bên dưới Header, hàng ngang 3 tab | Chuyển đổi chế độ sidebar | Gồm 3 tab: **Data Sets** (bộ dữ liệu), **Additional Criteria** (tiêu chí bổ sung), **Results** (kết quả). Tab mặc định là Data Sets. |
| **Sidebar trái** | Bên trái màn hình, có thể kéo thay đổi kích thước | Chọn & quản lý lớp dữ liệu | Hiển thị danh sách 8 danh mục dữ liệu chính dạng cây phân cấp. Có thể mở rộng/thu gọn từng danh mục bằng nút `+`/`−`. Mỗi mục có checkbox để chọn. Cuối sidebar là nút **Apply** để áp dụng các lớp đã chọn lên bản đồ. |
| **Khung bản đồ (Geo Panel)** | Chiếm phần diện tích còn lại bên phải | Hiển thị bản đồ tương tác | Bản đồ OpenLayers với đầy đủ điều khiển: phóng to/thu nhỏ, xoay, chọn tọa độ. Hiển thị các lớp dữ liệu đã chọn từ sidebar. Tích hợp thanh Timeline phía dưới. |
| **Thanh công cụ bản đồ** | Phía dưới khung bản đồ | Điều khiển nhanh bản đồ | Gồm các nút: **Layers** (quản lý lớp đang hiển thị), **Download data** (tải dữ liệu), **Timeline** (thanh trượt thời gian), **Time-Lapse** (phát tự động), **Change base layer** (đổi nền bản đồ). |
| **Thanh Timeline** | Nằm trong thanh công cụ bản đồ | Điều khiển thời gian hiển thị | Cho phép chọn chế độ: `H Hour` (theo giờ), `Day` (theo ngày), `Month` (theo tháng), `Year` (theo năm). Hiển thị thanh trượt thời gian với các mốc và khung giờ quan trắc cố định (00:00, 05:00, 10:00, 15:00, 20:00). |
| **Thanh Footer** | Phía dưới cùng, dải màu xanh #2563a8 | Liên kết nhanh & thông tin bản quyền | Chứa các liên kết: About Us, News, Download, Privacy, Policy, Site Map. Bên phải là dòng chữ "© 2026 WebGIS developed by MSL." Footer tự động thu gọn trên thiết bị di động với nút "Xem thêm". |

### 3.2 Chọn và hiển thị lớp dữ liệu (Data Sets)

Sidebar bên trái hiển thị **8 danh mục dữ liệu** chính dưới dạng cây phân cấp. Mỗi danh mục có thể chứa nhiều lớp dữ liệu con bên trong. Để xem dữ liệu trên bản đồ, bạn thực hiện theo các bước sau:

#### Bước 1 — Mở rộng danh mục

Nhấn nút **`+`** (dấu cộng) nằm bên trái tên danh mục để mở rộng và xem các lớp dữ liệu bên trong. Khi danh mục đã mở rộng, nút `+` sẽ chuyển thành `−` (dấu trừ). Nhấn lại để thu gọn.

#### Bước 2 — Chọn lớp dữ liệu

Đánh dấu **checkbox** (ô vuông) vào các lớp dữ liệu mà bạn muốn hiển thị trên bản đồ. Một số danh mục có cấu trúc phân cấp nhiều cấp (ví dụ: *Baseline Environment → Landuse Planning → Trà Vinh – Châu Thành District*), bạn cần mở rộng dần để đến lớp dữ liệu lá.

#### Bước 3 — Chọn loại hiển thị (Raster hoặc Vector)

Đối với các lớp dữ liệu GIS hỗ trợ cả hai loại **Raster** (R) và **Vector** (V), sidebar sẽ hiển thị hai nút chọn bên cạnh tên lớp:

| Nút | Loại | Ý nghĩa | Ví dụ |
|:---:|:----:|---------|-------|
| **R** | Raster | Hiển thị dữ liệu dạng ảnh lưới (pixel), phù hợp với ảnh vệ tinh, bản đồ độ mặn, pH. | Ảnh Landsat, bản đồ độ mặn dạng màu |
| **V** | Vector | Hiển thị dữ liệu dạng đối tượng hình học (điểm, đường, đa giác), phù hợp với ranh giới hành chính, sông rạch. | Ranh giới tỉnh, hệ thống kênh rạch |

Bạn có thể chọn cả R và V cùng lúc nếu muốn xem đồng thời cả hai loại.

#### Bước 4 — Áp dụng lên bản đồ

Sau khi đã chọn xong các lớp dữ liệu mong muốn, nhấn nút **Apply** (Áp dụng) nằm ở cuối sidebar. Hệ thống sẽ tải và hiển thị tất cả các lớp đã chọn lên bản đồ. Số lượng lớp đã chọn hiển thị bên cạnh tiêu đề "Data Sets" (ví dụ: `5 selected`).

#### Danh sách đầy đủ các danh mục dữ liệu

Dưới đây là bảng mô tả chi tiết 8 danh mục dữ liệu có sẵn trong hệ thống:

| Danh mục | Mô tả | Các lớp dữ liệu con | Loại dữ liệu |
|----------|-------|---------------------|:-------------:|
| **Landsat Imagery** | 8 bands ảnh vệ tinh Landsat, bao gồm các band đơn từ 1 đến 7 và ảnh tổng hợp RGB | Band 1, Band 2, ..., Band 7, Composite (RGB) | Raster |
| **Administration** | Ranh giới hành chính các cấp của tỉnh Trà Vinh | Province (Tỉnh), Commune (Xã), Hamlet (Ấp) | Vector |
| **Baseline Environment** | Dữ liệu nền môi trường gồm nhiều nhóm: quy hoạch sử dụng đất (9 huyện/thành phố Trà Vinh), loại đất, hệ thống kênh rạch (sông chính, kênh cấp 1, kênh nội đồng, đê, cầu, công trình thủy lợi...), nước ngầm, đường giao thông, phân loại sử dụng đất (7 loại: thủy sản, lúa-tôm, cây lâu năm, đất ở, dừa, rau màu, lúa) | Landuse Planning (9 huyện), Soil Type, Channel System (7 nhóm), Ground Water, Road, Landuse Classification (7 loại) | Raster & Vector |
| **Ecology** | Dữ liệu sinh thái: đa dạng sinh học, chỉ số thực vật (NDVI), bản đồ sinh cảnh, phân bố loài, rừng ngập mặn | Biodiversity, Vegetation Index, Habitat Mapping, Species Distribution, Mangroves | Vector |
| **Flooding Modeling** | Dữ liệu mô phỏng ngập lụt: phạm vi ngập, độ sâu ngập | Flooding Distribution, Flood Depth | Vector |
| **Hydrology Environment** | Dữ liệu thủy văn theo thời gian thực: độ mặn (Salinity), thủy triều (Tidal), độ pH — cập nhật theo giờ với các mốc quan trắc 00:00, 05:00, 10:00, 15:00, 20:00 | Salinity, Tidal, pH | Raster (theo giờ) |
| **Weather** | Dữ liệu thời tiết từ các trạm Ecowitt đặt tại Trà Vinh, hiển thị dạng marker trên bản đồ. Click vào marker để xem popup chi tiết. | — | Điểm đo (marker) |
| **Water Quality** | Dữ liệu chất lượng nước: nước mặt (Surface Water) và nước ngầm (Ground Water) từ các trạm quan trắc thủ công | Surface Water, Ground Water | Điểm đo + biểu đồ |

### 3.3 Thao tác tương tác với bản đồ

Bản đồ trung tâm (Geo Panel) là trái tim của hệ thống, được xây dựng trên nền tảng **OpenLayers 10.9** với đầy đủ các thao tác tương tác tiêu chuẩn:

| Thao tác | Hành động trên chuột/bàn phím | Kết quả |
|----------|:-----------------------------:|---------|
| **Phóng to (Zoom In)** | Lăn chuột lên, hoặc nhấn nút `+` ở góc trên bên trái bản đồ | Bản đồ phóng to, hiển thị chi tiết hơn ở khu vực trung tâm |
| **Thu nhỏ (Zoom Out)** | Lăn chuột xuống, hoặc nhấn nút `−` ở góc trên bên trái bản đồ | Bản đồ thu nhỏ, hiển thị phạm vi rộng hơn |
| **Di chuyển (Pan)** | Nhấn giữ chuột trái và kéo thả | Bản đồ di chuyển theo hướng kéo |
| **Xoay bản đồ (Rotate)** | Giữ phím `Shift` + nhấn giữ chuột trái và kéo | Bản đồ xoay theo hướng kéo. Nhấn nút la bàn (🌐) để đặt lại hướng Bắc. |
| **Xem tọa độ** | Di chuyển chuột trên bản đồ | Tọa độ theo hệ UTM 48N (EPSG:32648) hiển thị ở góc dưới bên phải khung bản đồ |
| **Xem thông tin đối tượng** | Click chuột trái vào một điểm hoặc đối tượng trên bản đồ | Một popup hiện ra hiển thị thông tin chi tiết (xem mục 3.6 Inspector) |
| **Phóng to khu vực (Zoom to Box)** | Giữ phím `Shift` + nhấn giữ chuột trái + kéo tạo hình chữ nhật | Bản đồ tự động phóng to đến khu vực được chọn |

### 3.4 Chuyển đổi nền bản đồ (Base Layers)

Hệ thống cung cấp **8 loại nền bản đồ** khác nhau để bạn lựa chọn tùy theo mục đích sử dụng:

| Nền bản đồ | Biểu tượng | Mô tả | Ứng dụng phù hợp |
|------------|:----------:|-------|-------------------|
| **OpenStreetMap** | 🌍 | Bản đồ đường phố mặc định, hiển thị đầy đủ tên đường, địa danh, tòa nhà | Duyệt bản đồ thông thường, xem địa danh |
| **Satellite** | 🛰️ | Ảnh vệ tinh độ phân giải cao từ Esri, hiển thị cảnh quan thực tế | Quan sát hiện trạng sử dụng đất, xem ảnh thực địa |
| **Terrain** | ⛰️ | Bản đồ địa hình từ OpenTopoMap, thể hiện đường đồng mức, độ cao | Phân tích địa hình, cao độ |
| **Topographic** | 🗺️ | Bản đồ địa hình từ Esri, kết hợp đường phố và địa hình | Định vị kết hợp địa hình |
| **Transport** | 🚗 | Bản đồ giao thông từ Thunderforest, nổi bật các tuyến đường | Xem mạng lưới giao thông |
| **Humanitarian** | 🏥 | Bản đồ nhân đạo từ OpenStreetMap France, tối ưu cho thiên tai | Theo dõi khu vực chịu ảnh hưởng thiên tai |
| **Light** | ☀️ | Bản đồ nền sáng, màu sắc tinh tế từ CartoDB | Trình chiếu, in ấn |
| **Dark** | 🌙 | Bản đồ nền tối, giảm chói từ CartoDB | Làm việc trong môi trường thiếu sáng, làm nổi bật lớp dữ liệu màu |

**Cách thao tác:** Nhấn nút **Change base layer** (biểu tượng quả địa cầu) nằm ở góc dưới bên trái khung bản đồ. Một menu xổ xuống hiện ra, nhấn chọn một trong 8 nền để thay đổi.

### 3.5 Sử dụng Timeline và Time-Lapse

> **Phạm vi áp dụng:** Chức năng này chỉ hoạt động với các lớp dữ liệu có yếu tố thời gian, như **Hydrology Environment** (độ mặn, thủy triều, pH) — các lớp này có dữ liệu theo từng khung giờ quan trắc trong ngày.

#### Thanh Timeline

Thanh Timeline nằm ở phía dưới khung bản đồ, bao gồm các thành phần sau:

| Thành phần | Mô tả | Cách sử dụng |
|------------|-------|:------------:|
| **Bộ chọn chế độ thời gian** | Gồm 4 nút: `H Hour` (theo giờ), `Day` (theo ngày), `Month` (theo tháng), `Year` (theo năm) | Nhấn để chuyển đổi giữa các chế độ. Chế độ mặc định được tự động chọn dựa trên khoảng thời gian đã thiết lập. |
| **Ô nhập thời gian bắt đầu** | Hiển thị ngày/giờ bắt đầu (định dạng `DD/MM/YYYY HH:mm`) | Nhấn để mở lịch và chọn ngày, hoặc nhập trực tiếp. Giá trị mặc định là ngày đầu tháng hiện tại. |
| **Ô nhập thời gian kết thúc** | Hiển thị ngày/giờ kết thúc | Nhấn để mở lịch và chọn ngày, hoặc nhập trực tiếp. Giá trị mặc định là thời điểm hiện tại. |
| **Thanh trượt thời gian** | Một thanh ngang có các mốc thời gian và nút trượt | Kéo nút trượt (thumb) di chuyển trên thanh để chọn thời điểm xem dữ liệu. Các mốc giờ quan trắc (00:00, 05:00, 10:00, 15:00, 20:00) được đánh dấu trên thanh. |
| **Khung giờ hiện tại** | Hiển thị thời điểm đang được chọn | Thay đổi khi bạn kéo thanh trượt hoặc nhấn các nút điều hướng. |

#### Time-Lapse Player

Nút **Time-Lapse** (🎬) nằm cạnh thanh Timeline. Khi nhấn vào, một bộ điều khiển phát tự động hiện ra:

| Nút điều khiển | Chức năng | Mô tả |
|:--------------:|-----------|-------|
| **⏮** (Skip Back) | Về khung thời gian trước đó | Nhấn để quay lui một bước thời gian |
| **▶️** (Play) | Bắt đầu phát tự động | Nhấn để phát tuần tự các khung thời gian, bản đồ tự động cập nhật theo từng bước |
| **⏭** (Skip Forward) | Đến khung thời gian tiếp theo | Nhấn để tiến tới một bước thời gian |
| **⏹️** (Stop) | Dừng phát | Nhấn để dừng quá trình phát tự động |

> Khi Time-Lapse đang phát, thanh tiến trình trên Timeline tự động di chuyển. Bạn có thể thấy sự thay đổi dữ liệu (ví dụ: độ mặn tăng/giảm) qua sự biến đổi màu sắc trên bản đồ.

### 3.6 Kiểm tra thông tin đối tượng (Inspector)

Chức năng Inspector cho phép bạn xem thông tin chi tiết của bất kỳ điểm nào trên bản đồ:

| Thao tác | Mô tả | Thông tin hiển thị |
|:--------:|-------|--------------------|
| **Click chuột** | Nhấn chuột trái vào một vị trí bất kỳ trên bản đồ | Một popup hoặc bảng thông tin hiện ra với các dữ liệu sau: |
| | | • **Tên lớp dữ liệu**: Hiển thị đường dẫn layer đang được chọn (ví dụ: *Baseline Environment → Landuse Classification → Rice Cultivation*) |
| | | • **Giá trị pixel** (đối với lớp Raster): Trích xuất giá trị số tại vị trí click, ví dụ: độ mặn = 5.2‰, pH = 7.1 |
| | | • **Thuộc tính đối tượng** (đối với lớp Vector): Hiển thị tất cả các thuộc tính của đối tượng, ví dụ: loại đất, diện tích (ha), mã số thửa |
| | | • **Tọa độ UTM 48N**: Kinh độ (X) và vĩ độ (Y) theo hệ tọa độ UTM zone 48N |
| **Hover chuột** | Di chuyển chuột qua bản đồ mà không click | Tọa độ hiện tại của con trỏ chuột hiển thị động ở góc dưới bên phải khung bản đồ (cập nhật theo thời gian thực) |

### 3.7 Xem dữ liệu thời tiết (Weather Popup)

Sau khi chọn lớp **Weather** và nhấn **Apply**, các trạm thời tiết Ecowitt sẽ xuất hiện trên bản đồ dưới dạng các marker (điểm đánh dấu) tại vị trí đặt trạm.

**Để xem dữ liệu thời tiết chi tiết:**

1. **Click chuột trái** vào một marker trạm thời tiết trên bản đồ.
2. Một popup (cửa sổ nhỏ) hiện ra với các thông số sau:

| Thông số | Đơn vị | Biểu tượng | Mô tả |
|----------|:------:|:-----------:|-------|
| **Temperature** (Nhiệt độ) | °F | 🌡️ | Nhiệt độ không khí tại trạm, được cập nhật mỗi 15 phút |
| **Humidity** (Độ ẩm) | % | 💧 | Độ ẩm tương đối của không khí |
| **Wind Speed** (Tốc độ gió) | mph | 💨 | Tốc độ gió trung bình tại trạm |
| **Daily Rain** (Lượng mưa) | in | 🌧️ | Lượng mưa tích lũy trong ngày |
| **Pressure** (Áp suất) | inHg | 🔵 | Áp suất khí quyển tương đối |
| **Solar Radiation** (Bức xạ) | W/m² | ☀️ | Cường độ bức xạ mặt trời |
| **UV Index** (Chỉ số UV) | — | 🧴 | Chỉ số tia cực tím |

3. Mỗi thông số đều có kèm **biểu đồ sparkline** (dạng đường gấp khúc thu nhỏ) thể hiện xu hướng thay đổi của thông số đó trong khoảng thời gian gần nhất. Bạn có thể di chuột lên biểu đồ để xem giá trị tại từng thời điểm.

---

## 4. Xem tin tức và bài viết

Trang **News** (Tin tức) tổng hợp tất cả các bài viết, thông báo và cập nhật liên quan đến dự án MekongSaltLab và hệ thống.

### 4.1 Cách truy cập

| Cách | Thao tác |
|:----:|----------|
| **Từ Footer** | Nhấn vào liên kết **News** ở thanh footer phía dưới cùng |
| **Đường dẫn trực tiếp** | Nhập `https://mekongsaltlab.org/news` vào thanh địa chỉ trình duyệt |

### 4.2 Bố cục trang tin tức

Trang tin tức được tổ chức gồm các phần sau:

| Khu vực | Mô tả |
|---------|-------|
| **Tiêu đề trang** | "Tin tức & Cập nhật" cùng mô tả ngắn: "Theo dõi các sự kiện, tính năng mới và thông báo quan trọng từ hệ thống." |
| **Bộ lọc danh mục** | Một dãy các nút lọc nằm ngay dưới tiêu đề, giúp bạn nhanh chóng tìm bài viết theo danh mục mong muốn. |
| **Danh sách bài viết** | Các bài viết được hiển thị dưới dạng card (thẻ), mỗi card gồm: hình ảnh đại diện, tiêu đề, ngày xuất bản, tóm tắt nội dung và nút "Đọc tiếp". |

### 4.3 Bộ lọc danh mục

| Danh mục | Mô tả | Ký hiệu |
|----------|-------|:-------:|
| **Tất cả** | Hiển thị tất cả bài viết không phân biệt danh mục | Mặc định |
| **Cập nhật hệ thống** | Các thông báo về nâng cấp, bảo trì, tính năng mới của hệ thống MekongSaltLab | 🔧 |
| **Dữ liệu** | Cập nhật về bộ dữ liệu mới, nguồn dữ liệu, chất lượng dữ liệu | 📊 |
| **Thông báo** | Thông báo chính thức từ ban quản lý dự án | 📢 |
| **Sự kiện** | Các sự kiện, hội thảo, tập huấn liên quan đến dự án | 📅 |
| **Tính năng mới** | Giới thiệu các tính năng mới được phát triển và đưa vào hệ thống | ✨ |
| **Hướng dẫn** | Các bài hướng dẫn sử dụng chi tiết từng chức năng của hệ thống | 📖 |

### 4.4 Đọc chi tiết bài viết

Nhấn vào tiêu đề hoặc nút **"Đọc tiếp"** của một bài viết để xem nội dung đầy đủ. Trang chi tiết bài viết bao gồm:
- Ảnh bìa (header image)
- Ngày xuất bản
- Danh mục
- Nội dung bài viết (có thể bao gồm văn bản, hình ảnh, video nhúng)
- Nút **Quay lại** để trở về danh sách

---

## 5. Tải dữ liệu GIS công khai

Trang **Download** cho phép bạn tải về các tập dữ liệu GIS đã được công khai trên hệ thống, phục vụ cho công tác nghiên cứu, phân tích ngoại tuyến.

### 5.1 Cách truy cập

| Cách | Thao tác |
|:----:|----------|
| **Từ Footer** | Nhấn vào liên kết **Download** ở thanh footer |
| **Đường dẫn trực tiếp** | Nhập `https://mekongsaltlab.org/download` |

### 5.2 Các loại dữ liệu có thể tải

| Loại dữ liệu | Đường dẫn S3 | Mô tả | Định dạng |
|:------------:|:------------:|-------|:---------:|
| **Dữ liệu GIS** | `gis-data/` | Dữ liệu không gian địa lý: ảnh vệ tinh Landsat, bản đồ sử dụng đất, độ mặn, thủy văn... | GeoTIFF, GeoJSON, KML, Shapefile |
| **Dữ liệu trạm** | `station-data/` | Dữ liệu quan trắc từ các trạm thủ công: độ mặn, pH, nhiệt độ... theo ngày | CSV |
| **Hình ảnh hiện trường** | `news-images/` | Hình ảnh chụp tại thực địa phục vụ công tác kiểm chứng và báo cáo | JPEG, PNG |

### 5.3 Lưu ý khi tải dữ liệu

| Lưu ý | Chi tiết |
|-------|----------|
| **Dung lượng file** | Một số file raster (GeoTIFF) có dung lượng lớn (hàng trăm MB). Nên sử dụng kết nối internet ổn định. |
| **Thư mục công khai** | Bạn chỉ có thể tải các file nằm trong các thư mục công khai nêu trên. Các file trong thư mục quản trị yêu cầu đăng nhập với quyền cao hơn (DATA_MANAGER hoặc ADMIN). |
| **Giấy phép sử dụng** | Dữ liệu được cung cấp miễn phí cho mục đích nghiên cứu và quản lý. Vui lòng ghi rõ nguồn khi sử dụng trong báo cáo hoặc ấn phẩm. |
| **Định dạng tọa độ** | Dữ liệu GIS sử dụng hệ tọa độ UTM zone 48N (EPSG:32648) và WGS84 (EPSG:4326). |

---

## 6. Xem thông tin dự án

Trang **About** cung cấp thông tin tổng quan về dự án MekongSaltLab và đội ngũ phát triển.

### 6.1 Cách truy cập

| Cách | Thao tác |
|:----:|----------|
| **Từ Footer** | Nhấn vào liên kết **About Us** ở thanh footer |
| **Đường dẫn trực tiếp** | Nhập `https://mekongsaltlab.org/about` |

### 6.2 Nội dung trang About

| Mục | Mô tả |
|-----|-------|
| **Giới thiệu dự án** | Tổng quan về mục tiêu, phạm vi và ý nghĩa của dự án MekongSaltLab trong bối cảnh biến đổi khí hậu và xâm nhập mặn tại Đồng bằng sông Cửu Long. |
| **Đội ngũ phát triển** | Danh sách các thành viên chủ chốt tham gia thiết kế, phát triển và vận hành hệ thống, bao gồm: |
| | • **Project Coordinator** — Steven Starman (MsC): Điều phối dự án, quản lý tổng thể |
| | • **Project Lead & Chief WebGIS Architect** — Long KP (PhD): Kiến trúc sư trưởng WebGIS |
| | • **Aquaculture and Environmental Data Specialist** — Dương Hoàng Oanh (M.Sc): Chuyên gia dữ liệu môi trường & thủy sản |
| | • **WebGIS Developer & GIS Specialist** — L.NP Khanh (MsC): Phát triển WebGIS & phân tích không gian |
| | • **WebGIS Developer & Data Developer** — N V.Hoang (BsC), N L.Duy (BsC): Phát triển ứng dụng và cơ sở dữ liệu |
| | • **Data Developers** — NT Tuu (PhD), Lam T.Thao (BsC), DT.Y Linh (BsC): Quản lý và xử lý dữ liệu |
| **Liên hệ** | Thông tin email liên hệ của các thành viên chủ chốt trong dự án. |

---

## ❓ Câu hỏi thường gặp (FAQ)

| Câu hỏi | Trả lời |
|---------|---------|
| **Tôi có thể tải dữ liệu độ mặn lịch sử về máy không?** | Có. Các dữ liệu GIS công khai trong thư mục `gis-data/` có thể tải qua trang **Download**. Bạn có thể tải file GeoTIFF hoặc GeoJSON tùy theo nhu cầu. |
| **Tại sao tôi không thấy nút "Quản trị" trên header?** | Vì tài khoản của bạn đang ở vai trò **USER** — chỉ có quyền xem bản đồ, tin tức và tải dữ liệu công khai. Nút "Quản trị" chỉ xuất hiện với tài khoản có quyền DATA_MANAGER hoặc ADMIN. Nếu cần nâng cấp quyền, vui lòng liên hệ quản trị viên hệ thống. |
| **Làm thế nào để xem dữ liệu thủy văn theo thời gian thực?** | Chọn lớp **Hydrology Environment** (Độ mặn, Thủy triều, pH) trong sidebar, sau đó sử dụng thanh **Timeline** phía dưới bản đồ để chọn khung giờ quan trắc. Dữ liệu được cập nhật 5 lần mỗi ngày từ API Mekong (các mốc: 00:00, 05:00, 10:00, 15:00, 20:00). |
| **Làm thế nào để xem dữ liệu thời tiết mới nhất?** | Chọn lớp **Weather** trong sidebar, nhấn **Apply**, sau đó click vào marker trạm thời tiết trên bản đồ. Dữ liệu thời tiết được cập nhật từ trạm Ecowitt mỗi 15 phút. |
| **Tôi quên mật khẩu đăng nhập, phải làm sao?** | Hiện tại hệ thống chưa hỗ trợ tính năng "Quên mật khẩu" tự động. Vui lòng liên hệ trực tiếp quản trị viên hệ thống để được cấp lại mật khẩu mới. |
| **Bản đồ hiển thị chậm hoặc không load được lớp dữ liệu?** | Một số nguyên nhân thường gặp: (1) Kết nối internet không ổn định — hãy kiểm tra lại đường truyền; (2) Dung lượng file raster quá lớn — hãy thử zoom đến khu vực nhỏ hơn; (3) Trình duyệt cũ — hãy cập nhật trình duyệt phiên bản mới nhất. Nếu vẫn không hoạt động, vui lòng báo cáo cho quản trị viên. |
| **Tôi có thể đóng góp dữ liệu lên hệ thống không?** | Với vai trò USER, bạn chỉ có quyền xem và tải dữ liệu. Nếu bạn có nhu cầu đóng góp dữ liệu (ví dụ: số liệu quan trắc thực địa, ảnh hiện trường), vui lòng liên hệ quản trị viên để được cấp quyền DATA_MANAGER. |
| **Hệ thống có hỗ trợ tiếng Anh không?** | Giao diện chính của hệ thống sử dụng tiếng Anh cho các nhãn chức năng (Data Sets, Apply, Layers...). Nội dung bài viết và tài liệu hướng dẫn có cả tiếng Việt và tiếng Anh. |

---

## 📞 Hỗ trợ và Liên hệ

| Kênh hỗ trợ | Thông tin |
|:-----------:|-----------|
| **Website chính thức** | [https://mekongsaltlab.org](https://mekongsaltlab.org) |
| **Email** | Liên hệ qua địa chỉ email của các thành viên trong trang **About** |
| **Tài liệu hướng dẫn** | Các file hướng dẫn chi tiết theo từng vai trò trong thư mục `docs/` của dự án |
| **Báo cáo lỗi** | Gửi thông tin lỗi (kèm ảnh chụp màn hình nếu có) đến quản trị viên hệ thống |

---

*© 2026 MekongSaltLab. Tài liệu hướng dẫn dành cho người dùng cuối — Phiên bản 1.0.*
