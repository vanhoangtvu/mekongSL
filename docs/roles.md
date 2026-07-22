# Phân Quyền Hệ Thống

## 3 Roles

### 1. USER (Người dùng thường)
**Quyền hạn:**
- Xem bản đồ (/)
- Xem articles public
- Download files từ S3 (prefix công khai: `gis-data/`, `station-data/`, `news-images/`)
- Xem danh sách files `gis-data` (S3 list public)
- Render GeoTIFF (chỉ `gis-data/` prefix)
- Xem trạm manual station (GET public)
- Xem dữ liệu chất lượng nước (GET public)
- Xem thống kê landuse (public)
- **KHÔNG** truy cập `/data`
- **KHÔNG** upload/delete S3
- **KHÔNG** backup
- **KHÔNG** quản lý users/articles

**Default account:**
- Username: `user` (tự tạo)
- Password: `user123` (tự tạo)
- Backend tạo sẵn: `admin`/`admin123` và `manager`/`manager123`

---

### 2. DATA_MANAGER (Quản lý dữ liệu)
**Quyền hạn:**
- Tất cả quyền của USER
- Truy cập trang `/data`
- Upload files lên S3 (POST `/api/s3/upload`)
- Delete files từ S3 (DELETE `/api/s3/delete`)
- Copy/Rename files và folders trong S3
- Tạo folder mới trên S3
- Tạo signed URLs
- Xem S3 storage stats
- GIS CRUD endpoints (layers, datasets, stations, folders, tags)
- Upload layer files, register S3 objects
- Quản lý manual stations (import Excel)
- Quản lý water quality (import Excel, xóa sample)
- Quản lý monitoring data
- Quản lý articles (CRUD)

**Default account:**
- Username: `manager`
- Password: `manager123`

---

### 3. ADMIN (Quản trị hệ thống)
**Quyền hạn:**
- Tất cả quyền của DATA_MANAGER
- Quản lý users (CRUD) — `/api/admin/users`
- Trigger backup — `/api/backup`

**Default account:**
- Username: `admin`
- Password: `admin123`

---

## Bảng chi tiết endpoints

| Endpoint | USER | DATA_MANAGER | ADMIN |
|----------|:----:|:------------:|:-----:|
| `GET /api/auth/**` | ✅ | ✅ | ✅ |
| `POST /api/auth/login` | ✅ | ✅ | ✅ |
| `GET /api/s3/list (gis-data/)` | ✅ | ✅ | ✅ |
| `GET /api/s3/download (public prefix)` | ✅ | ✅ | ✅ |
| `GET /api/s3/render` | ✅ | ✅ | ✅ |
| `GET /api/gis/manual-stations` | ✅ | ✅ | ✅ |
| `GET /api/gis/water-quality` | ✅ | ✅ | ✅ |
| `GET /api/articles/public` | ✅ | ✅ | ✅ |
| `GET /api/gis/landuse-yearly-stats` | ✅ | ✅ | ✅ |
| `POST /api/s3/upload` | ❌ | ✅ | ✅ |
| `DELETE /api/s3/delete` | ❌ | ✅ | ✅ |
| `POST /api/s3/copy` | ❌ | ✅ | ✅ |
| `POST /api/s3/rename` | ❌ | ✅ | ✅ |
| `POST /api/s3/create-folder` | ❌ | ✅ | ✅ |
| `GET /api/s3/stats` | ❌ | ✅ | ✅ |
| `POST /api/data/**` | ❌ | ✅ | ✅ |
| GIS CRUD | ❌ | ✅ | ✅ |
| Articles CRUD | ❌ | ✅ | ✅ |
| `GET /api/admin/users` | ❌ | ❌ | ✅ |
| `POST /api/backup` | ❌ | ❌ | ✅ |

## Ghi chú

- Authentication: JWT Bearer token
- Token hết hạn sau 24h (cấu hình trong `application.yaml`)
- Tài khoản mặc định được tạo tự động khi backend khởi động lần đầu
- Có thể tạo/sửa/xóa user qua API `/api/admin/users` (ADMIN)
- Trigger backup
-Query MySQL, Export Excel
- KHONG co quyen quan ly users (admin endpoint)

**Default account:**
- Username: `manager`
- Password: `manager123`

---

### 3. ADMIN (Quan tri vien)
**Quyen han:**
- Tat ca quyen cua DATA_MANAGER
- Quan ly users (GET/POST/PUT/DELETE /api/admin/users)
- Xem thong tin tai khoan (/api/account/me)
- Tat ca CRUD endpoints khong gioi han

**Default account:**
- Username: `admin`
- Password: `admin123`

---

## Bang phan quyen chi tiet

| Endpoint | Method | USER | DATA_MANAGER | ADMIN |
|----------|--------|------|--------------|-------|
| `/api/auth/register` | POST | Public | Public | Public |
| `/api/auth/login` | POST | Public | Public | Public |
| `/api/gis/manual-stations/**` | GET | Public | Public | Public |
| `/api/gis/water-quality/**` | GET | Public | Public | Public |
| `/api/articles/public/**` | GET | Public | Public | Public |
| `/api/s3/render` | GET | Public | Public | Public |
| `/api/s3/download` | GET | Public | Public | Public |
| `/api/s3/list?prefix=gis-data/` | GET | Public | Public | Public |
| `/swagger-ui/**` | GET | Public | Public | Public |
| `/api/s3/list (non-gis-data)` | GET | Can auth | Can auth | Can auth |
| `/api/s3/signed-url` | GET | Can auth | Can auth | Can auth |
| `/api/s3/exists` | GET | Can auth | Can auth | Can auth |
| `/api/s3/folders` | GET | Can auth | Can auth | Can auth |
| `/api/s3/upload` | POST | Ko | Co | Co |
| `/api/s3/delete` | DELETE | Ko | Co | Co |
| `/api/s3/copy` | POST | Ko | Co | Co |
| `/api/s3/rename` | POST | Ko | Co | Co |
| `/api/s3/rename-folder` | POST | Ko | Co | Co |
| `/api/s3/create-folder` | POST | Ko | Co | Co |
| `/api/s3/stats` | GET | Ko | Co | Co |
| `/api/data/**` | GET | Ko | Co | Co |
| `/api/gis/layers` (GET) | GET | Can auth | Can auth | Can auth |
| `/api/gis/layers (POST/PATCH/DELETE)` | WRITE | Ko | Co | Co |
| `/api/gis/layers/{id}/render` | GET | Can auth | Can auth | Can auth |
| `/api/gis/datasets` (CRUD) | ALL | Ko | Co | Co |
| `/api/gis/stations` (CRUD) | ALL | Ko | Co | Co |
| `/api/gis/folders` (CRUD) | ALL | Ko | Co | Co |
| `/api/gis/tags` (CRUD) | ALL | Ko | Co | Co |
| `/api/gis/manual-stations` (POST/PUT/DELETE) | WRITE | Ko | Co | Co |
| `/api/gis/water-quality` (POST/DELETE) | WRITE | Ko | Co | Co |
| `/api/articles` (CRUD) | ALL | Ko | Co | Co |
| `/api/backup` | ALL | Ko | Co | Co |
| `/api/admin/users` | GET/POST | Ko | Ko | Co |
| `/api/admin/users/{id}` | PUT/DELETE | Ko | Ko | Co |

## Thay doi role

### Cach 1: Truc tiep trong MySQL
```sql
-- Thay doi user thanh DATA_MANAGER
UPDATE users SET role = 'DATA_MANAGER' WHERE username = 'user';

-- Thay doi manager thanh ADMIN
UPDATE users SET role = 'ADMIN' WHERE username = 'manager';
```

### Cach 2: Admin endpoint
Admin co the quan ly users qua `/api/admin/users` endpoints.

## Notes

1. **USER** - Chi xem, khong sua
2. **DATA_MANAGER** - Quan ly du lieu va S3, GIS CRUD
3. **ADMIN** - Toan quyen

**Security:**
- JWT token validation
- Role-based authorization (RBAC)
- `@PreAuthorize` annotations
- Spring Security stateless sessions

---

**Cap nhat**: 2026-07-09
**Phien ban**: 3.0 (Updated with full endpoint permissions)
