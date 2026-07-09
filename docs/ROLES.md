# Phan quyen he thong

## 3 Roles

### 1. USER (Nguoi dung thuong)
**Quyen han:**
- Xem ban do (/)
- Xem articles public
- Download files tu S3
- Xem danh sach files gis-data (S3 list public)
- Render GeoTIFF tu S3 (chi gis-data/ prefix)
- Xem tram manual station (GET public)
- Xem du lieu chat luong nuoc water quality (GET public)
- KHONG truy cap /data
- KHONG upload/delete S3
- KHONG backup
- KHONG quan ly users/articles

**Default account:**
- Username: `user`
- Password: `user123`

---

### 2. DATA_MANAGER (Quan ly du lieu)
**Quyen han:**
- Tat ca quyen cua USER
- Truy cap trang /data
- Upload files len S3 (POST /api/s3/upload)
- Delete files tu S3 (DELETE /api/s3/delete)
- Copy/Rename files va folders trong S3
- Tao folder moi tren S3
- Tao signed URLs
- Xem S3 storage stats
- GIS CRUD endpoints (layers, datasets, stations, folders, tags)
- Upload layer files, register S3 objects
- Quan ly manual stations (import Excel)
- Quan ly water quality (import Excel, Xoa sample)
- Quan ly monitoring data
- Quan ly articles (CRUD)
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
