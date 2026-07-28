# 📚 Hướng Dẫn Sử Dụng Hệ Thống MekongSaltLab

> **Phiên bản:** 1.0 | **Cập nhật:** 25/07/2026  
> **Hệ thống:** MekongSaltLab — Nền tảng giám sát & trực quan hóa dữ liệu không gian địa lý Đồng bằng sông Cửu Long

---

## Giới thiệu

**MekongSaltLab** là nền tảng giám sát & trực quan hóa dữ liệu không gian địa lý, phục vụ quản lý tài nguyên nước, khí tượng thủy văn và môi trường khu vực **Đồng bằng sông Cửu Long**, tập trung vào tỉnh **Trà Vinh**.

Hệ thống có **3 vai trò người dùng**, mỗi vai trò có quyền hạn và trách nhiệm khác nhau:

| Vai trò | Mô tả | Tài liệu |
|---------|-------|----------|
| 👤 **USER** | Người dùng thường — xem bản đồ, tin tức, tải dữ liệu công khai | [📖 Hướng dẫn USER](./huong-dan-su-dung-nguoi-dung-role-USER.md) |
| 🔷 **DATA_MANAGER** | Quản lý dữ liệu — upload, xóa, quản lý GIS, trạm, bài viết | [📖 Hướng dẫn DATA_MANAGER](./huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md) |
| 🔴 **ADMIN** | Quản trị viên — quản lý người dùng, backup, toàn quyền hệ thống | [📖 Hướng dẫn ADMIN](./huong-dan-su-dung-nguoi-dung-role-ADMIN.md) |

---

## Bảng quyền hạn chi tiết

| Chức năng | USER | DATA_MANAGER | ADMIN |
|-----------|:----:|:------------:|:-----:|
| 🗺️ Xem bản đồ WebGIS | ✅ | ✅ | ✅ |
| 📰 Xem tin tức | ✅ | ✅ | ✅ |
| 📥 Tải dữ liệu công khai | ✅ | ✅ | ✅ |
| 🔐 Đăng nhập/Đăng ký | ✅ | ✅ | ✅ |
| 📊 Dashboard tổng quan | ❌ | ✅ | ✅ |
| ☁️ Upload file S3 | ❌ | ✅ | ✅ |
| 🗑️ Xóa file S3 | ❌ | ✅ | ✅ |
| 📁 Tạo/Copy/Rename folder S3 | ❌ | ✅ | ✅ |
| 🗂️ Quản lý GIS Layers | ❌ | ✅ | ✅ |
| 📍 Quản lý trạm quan trắc | ❌ | ✅ | ✅ |
| 💧 Import chất lượng nước | ❌ | ✅ | ✅ |
| 📰 Xem danh sách bài viết | ✅ | ✅ | ✅ |
| 📝 Quản lý bài viết (Tạo/Sửa/Xóa) | ❌ | ❌ | ✅ |
| 🔄 Kích hoạt fetch dữ liệu | ❌ | ✅ | ✅ |
| 📤 Export Excel | ❌ | ✅ | ✅ |
| 🌿 Tính toán Landuse | ❌ | ✅ | ✅ |
| 👥 Quản lý người dùng | ❌ | ❌ | ✅ |
| 💾 Trigger backup | ❌ | ❌ | ✅ |

---

## Cách chọn tài liệu phù hợp

1. **Bạn là người dùng mới**, chỉ cần xem bản đồ và dữ liệu?  
   👉 Đọc [Hướng dẫn USER](./huong-dan-su-dung-nguoi-dung-role-USER.md)

2. **Bạn cần tải lên, quản lý dữ liệu GIS**, import Excel chất lượng nước?  
   👉 Đọc [Hướng dẫn DATA_MANAGER](./huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md)

3. **Bạn là quản trị viên**, cần quản lý người dùng, backup hệ thống?  
   👉 Đọc [Hướng dẫn ADMIN](./huong-dan-su-dung-nguoi-dung-role-ADMIN.md)

---

## Thông tin truy cập

| Thông tin | Giá trị |
|-----------|---------|
| **URL Frontend** | https://mekongsaltlab.org hoặc http://103.54.251.212:3004 |
| **URL Backend API** | http://103.54.251.212:8084 |
| **Swagger API Docs** | https://mekongsaltlab.org/swagger-ui/ |

### Tài khoản mặc định

| Vai trò | Username | Password |
|---------|----------|----------|
| 👤 USER | `user` | `user123` |
| 🔷 DATA_MANAGER | `manager` | `manager123` |
| 🔴 ADMIN | `admin` | `admin123` |

> ⚠️ Đổi mật khẩu ngay sau khi đăng nhập lần đầu!

---

## Cấu trúc thư mục tài liệu

```
docs/
├── huong-dan-su-dung-nguoi-dung.md                    ← 📚 Mục lục (file này)
├── huong-dan-su-dung-nguoi-dung-role-USER.md          ← 📖 Hướng dẫn USER
├── huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md  ← 📖 Hướng dẫn DATA_MANAGER
├── huong-dan-su-dung-nguoi-dung-role-ADMIN.md         ← 📖 Hướng dẫn ADMIN
├── roles.md                                            ← Chi tiết phân quyền
├── data-upload.md                                      ← Upload dữ liệu
├── deployment.md                                       ← Triển khai hệ thống
├── s3-storage.md                                       ← Cấu hình S3
└── ...
```

---

## 📞 Hỗ trợ

- **Website:** https://mekongsaltlab.org
- **Email:** Liên hệ qua trang About

---

*© 2026 MekongSaltLab. Tài liệu hướng dẫn người dùng cuối.*
