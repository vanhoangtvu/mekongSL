# 👥 PHÂN QUYỀN HỆ THỐNG

## 🔐 3 ROLES

### 1. USER (Người dùng thường)
**Quyền hạn:**
- ✅ Xem bản đồ (/)
- ✅ Xem thông tin tài khoản hiện tại (`GET /api/account/me`)
- ✅ Xem danh sách files S3 (`GET /api/s3/list`)
- ✅ Download files từ S3 (`GET /api/s3/download/{key}`)
- ✅ Check file exists (`GET /api/s3/exists/{key}`)
- ❌ KHÔNG truy cập /data
- ❌ KHÔNG upload/delete S3
- ❌ KHÔNG backup

**Default account:**
- Username: `user`
- Password: `user123`

---

### 2. DATA_MANAGER (Quản lý dữ liệu)
**Quyền hạn:**
- ✅ Tất cả quyền của USER
- ✅ Truy cập trang /data
- ✅ Query MySQL (`GET /api/mysql`)
- ✅ Upload files lên S3 (`POST /api/s3/upload`)
- ✅ Delete files từ S3 (`DELETE /api/s3/delete/{key}`)
- ✅ Trigger manual backup (`POST /api/backup/trigger`)
- ✅ Export / refresh monthly Excel files (`GET/POST /api/mekong-monthly/*`)
- ❌ KHÔNG có quyền admin

**Default account:**
- Username: `manager`
- Password: `manager123`

---

### 3. ADMIN (Quản trị viên)
**Quyền hạn:**
- ✅ Tất cả quyền của DATA_MANAGER
- ✅ Quản lý users (`GET/POST/PUT/DELETE /api/admin/users`)
- ✅ Xem thông tin tài khoản hiện tại (`GET /api/account/me`)
- ✅ Quản lý S3 files

**Default account:**
- Username: `admin`
- Password: `admin123`

---

## 📊 BẢNG PHÂN QUYỀN CHI TIẾT

| Endpoint | Method | USER | DATA_MANAGER | ADMIN |
|----------|--------|------|--------------|-------|
| `/api/auth/register` | POST | ✅ Public | ✅ Public | ✅ Public |
| `/api/auth/login` | POST | ✅ Public | ✅ Public | ✅ Public |
| `/api/account/me` | GET | ❌ | ✅ | ✅ |
| `/` | GET | ✅ | ✅ | ✅ |
| `/data` | GET | ❌ | ✅ | ✅ |
| `/api/mysql` | GET | ❌ | ✅ | ✅ |
| `/api/s3/list` | GET | ✅ | ✅ | ✅ |
| `/api/s3/download/{key}` | GET | ✅ | ✅ | ✅ |
| `/api/s3/exists/{key}` | GET | ✅ | ✅ | ✅ |
| `/api/s3/upload` | POST | ❌ | ✅ | ✅ |
| `/api/s3/delete/{key}` | DELETE | ❌ | ✅ | ✅ |
| `/api/backup/trigger` | POST | ❌ | ✅ | ✅ |
| `/api/admin/users` | GET/POST | ❌ | ❌ | ✅ |
| `/api/admin/users/{id}` | PUT/DELETE | ❌ | ❌ | ✅ |

---

## 🧪 TEST PHÂN QUYỀN

### Test 1: USER xem files (OK)
```bash
USER_TOKEN=$(curl -s -X POST http://113.170.158.188:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}' | jq -r '.token')

# Xem danh sách files - OK
curl http://113.170.158.188:8084/api/s3/list \
  -H "Authorization: Bearer $USER_TOKEN"

# Download file - OK
curl http://113.170.158.188:8084/api/s3/download/raster/salinity.tif \
  -H "Authorization: Bearer $USER_TOKEN" \
  -o salinity.tif
```

### Test 2: USER upload (DENIED)
```bash
# Upload file - DENIED
curl -X POST http://113.170.158.188:8084/api/s3/upload \
  -H "Authorization: Bearer $USER_TOKEN" \
  -F "file=@test.txt"
# Expected: HTTP 403 Forbidden
```

### Test 3: MANAGER upload (OK)
```bash
MANAGER_TOKEN=$(curl -s -X POST http://113.170.158.188:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}' | jq -r '.token')

# Upload file - OK
curl -X POST http://113.170.158.188:8084/api/s3/upload \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -F "file=@test.txt"
```

### Test 4: ADMIN (OK)
```bash
ADMIN_TOKEN=$(curl -s -X POST http://113.170.158.188:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Upload - OK
curl -X POST http://113.170.158.188:8084/api/s3/upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@test.txt"

# Delete - OK
curl -X DELETE http://113.170.158.188:8084/api/s3/delete/uploads/test.txt \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🎯 USE CASES

### Use Case 1: Người dùng xem bản đồ
```
USER login → Xem bản đồ → Download GeoTIFF từ S3 → Hiển thị trên map
```

### Use Case 2: Quản lý dữ liệu
```
DATA_MANAGER login → Truy cập /data → Query MySQL → Export Excel → Upload lên S3
```

### Use Case 3: Admin quản lý files
```
ADMIN login → Xem tất cả files S3 → Delete files cũ → Upload files mới
```

---

## 🔄 THAY ĐỔI ROLE

### Cách 1: Trực tiếp trong MySQL
```sql
-- Thay đổi user thành DATA_MANAGER
UPDATE users SET role = 'DATA_MANAGER' WHERE username = 'user';

-- Thay đổi manager thành ADMIN
UPDATE users SET role = 'ADMIN' WHERE username = 'manager';
```

### Cách 2: API endpoint (Future)
```bash
# Admin có thể thay đổi role của users khác
POST /api/admin/users/{id}/role
Authorization: Bearer <admin_token>
Body: { "role": "DATA_MANAGER" }
```

---

## 📝 NOTES

1. **USER** - Chỉ xem, không sửa
2. **DATA_MANAGER** - Quản lý dữ liệu và S3
3. **ADMIN** - Toàn quyền

**Security:**
- ✅ JWT token validation
- ✅ Role-based authorization
- ✅ @PreAuthorize annotations
- ✅ Spring Security

---

**Cập nhật**: 2026-05-25  
**Phiên bản**: 2.0 (Added ADMIN role)
