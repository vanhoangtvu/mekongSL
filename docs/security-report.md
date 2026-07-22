# Báo cáo bảo mật hệ thống Mekong WebGIS

## Tổng quan bảo mật

Hệ thống đã được bảo mật ở **4 tầng**:
1. **Frontend** — Route protection + AuthGuard + AuthService
2. **Next.js API Layer** — Backend-for-frontend proxy routes
3. **Backend** — Spring Security + JWT + 3-tier RBAC
4. **S3 Storage** — Prefix validation + phân quyền download

---

## Chi tiết bảo mật

### 1. Authentication (Xác thực)

#### Backend (Spring Boot)
- JWT token với expiration 24h (cấu hình được)
- Password hashing với BCrypt
- Token validation trên mỗi request qua JwtAuthenticationFilter
- UserDetailsService load user từ bảng `users`
- Stateless sessions (SessionCreationPolicy.STATELESS)

#### Frontend (Next.js)
- Token lưu trong localStorage (AuthService)
- Token validation (decode JWT, check expiration)
- Auto logout khi token expired
- Redirect to /auth khi chưa đăng nhập

### 2. Authorization (Phân quyền)

**3 roles:** USER → DATA_MANAGER → ADMIN

**Endpoint public:**
```
/api/auth/**                  → Đăng ký, đăng nhập
GET /api/s3/download          → gis-data/, station-data/, news-images/
GET /api/s3/render            → gis-data/ prefix
GET /api/s3/list              → gis-data/ prefix
GET /api/gis/manual-stations  → Công khai
GET /api/gis/water-quality    → Công khai
GET /api/articles/public      → Công khai
GET /api/gis/landuse-yearly-stats → Công khai
GET /swagger-ui, /v3/api-docs → API docs
```

**Endpoint yêu cầu auth:**
```
POST /api/s3/upload           → ADMIN/DATA_MANAGER
DELETE /api/s3/delete         → ADMIN/DATA_MANAGER
POST /api/s3/copy/rename      → ADMIN/DATA_MANAGER
GET /api/admin/users          → ADMIN
POST /api/backup              → ADMIN
GIS CRUD                      → ADMIN/DATA_MANAGER
Articles CRUD                 → ADMIN/DATA_MANAGER
```

### 3. S3 Security

- Upload key phải bắt đầu bằng: `gis-data/`, `station-data/`, `monitoring-data/`, `news-images/`
- Download: public cho `gis-data/`, `station-data/`, `news-images/`
- Các prefix khác yêu cầu auth
- Signed URL với expiration linh hoạt
- Download-token cơ chế tạm thời (300s)

### 4. Database Security

- MySQL user/password trong `application.yaml` (file cấu hình)
- JPA Hibernate `ddl-auto: update` (tự động tạo bảng)
- SQL injection được bảo vệ qua JPA/Hibernate

### 5. Network Security

- Backend listen `0.0.0.0:8084` (có thể giới hạn bằng firewall)
- CORS giới hạn origins cụ thể
- CSRF disabled (API stateless)

---

## Khuyến nghị

| Mục | Hiện tại | Khuyến nghị |
|-----|---------|-------------|
| JWT Secret | Default hoặc env | Nên dùng key mạnh 256-bit trong production |
| HTTPS | Chưa bắt buộc | Nên dùng reverse proxy (Nginx) + Let's Encrypt |
| Rate limiting | Chưa có | Nên thêm để tránh brute force |
| S3 Public download | Đã giới hạn prefix | OK, có thể thêm rate limiting |
| Logging | Spring Boot logs | Nên thêm audit log cho sensitive actions |
| Backup | Chưa có automatic | Đã có endpoint /api/backup, cần cron job |
---

### 2. Authorization (Phan quyen)

#### 3 Roles (enum trong User.java)
- **USER** (priority 0) - Mac dinh, xem ban do, articles public, download S3
- **DATA_MANAGER** (priority 1) - Quan ly du lieu, S3 upload/delete, GIS CRUD
- **ADMIN** (priority 2) - Toan quyen, quan ly users

#### Protected Endpoints (SecurityConfig.java)

| Endpoint Pattern | Method | Required Role |
|-----------------|--------|---------------|
| `/api/auth/**` | ALL | Public |
| `/swagger-ui/**`, `/v3/api-docs/**` | ALL | Public |
| `/api/s3/render` | GET | Public (chi gis-data/) |
| `/api/s3/download` | GET | Public |
| `/api/s3/list` | GET | Public (chi gis-data/), authenticated (prefix khac) |
| `/api/gis/manual-stations/**` | GET | Public |
| `/api/gis/water-quality/**` | GET | Public |
| `/api/articles/public/**` | GET | Public |
| `/api/data/**` | ALL | DATA_MANAGER, ADMIN |
| `/api/s3/upload|delete|copy|rename|...` | ALL | DATA_MANAGER, ADMIN |
| Tat ca endpoint khac | ALL | Authenticated (bat ky role) |
| `/api/admin/users` | ALL | ADMIN (qua @PreAuthorize) |

---

### 3. Frontend Route Protection

| Route | Required Role | Protection |
|-------|---------------|------------|
| `/` | Public | None |
| `/auth` | Public | None |
| `/about` | Public | None |
| `/news`, `/news/[slug]` | Public | None |
| `/unauthorized` | Public | None |
| `/data` | DATA_MANAGER+ | AuthGuard |
| `/dashboard` | ADMIN | AuthGuard + role check |

---

### 4. Database Security

#### MySQL Connection
- Connection pooling (HikariCP, Spring Boot default)
- Credentials trong application.yaml (co the override qua env vars)
- JPA/Hibernate ORM chong SQL injection

#### SQL Injection Prevention
- Prepared statements (Spring Data JPA)
- Native queries dung parameter binding
- Input validation tren DTO layer

---

### 5. S3 Storage Security

#### Access Control
- Upload: Chi DATA_MANAGER+, prefix validation (`gis-data/`, `station-data/`, `monitoring-data/`, `news-images/`)
- Render: Public, chi cho phep `gis-data/` prefix
- Signed URLs cho GIS data thay vi public URLs
- File size limit: 100MB

#### Credentials
```yaml
s3:
  access-key: ${S3_ACCESS_KEY}
  secret-key: ${S3_SECRET_KEY}
```
Credential duoc lay tu env vars, khong hardcode trong production.

---

### 6. CORS Configuration

#### Allowed Origins
```
http://localhost:3004, http://localhost:3000
http://103.54.251.212, http://103.54.251.212:3004, http://103.54.251.212:3000
https://103.54.251.212
https://mekongsaltlab.org, https://www.mekongsaltlab.org
```

#### Security
- Whitelist specific origins (khong dung wildcard *)
- Allow credentials
- OPTIONS preflight requests allowed
- Exposed headers: Content-Range, Accept-Ranges, Content-Length

---

## Test Cases Bao Mat

### Test 1: Khong co token
```bash
curl http://localhost:8084/api/data
# Expected: HTTP 401/403
```

### Test 2: Token expired
```bash
# Token het han sau 24h
# Expected: Auto logout + redirect /auth
```

### Test 3: USER role truy cap /api/data
```bash
curl -H "Authorization: Bearer <user_token>" http://localhost:8084/api/data
# Expected: HTTP 403 Forbidden
```

### Test 4: DATA_MANAGER role truy cap /api/data
```bash
curl -H "Authorization: Bearer <manager_token>" http://localhost:8084/api/data
# Expected: HTTP 200 OK
```

### Test 5: S3 upload khong co quyen
```bash
curl -X POST http://localhost:8084/api/s3/upload -F "file=@test.txt"
# Expected: HTTP 403
```

### Test 6: S3 render public GIS data
```bash
curl "http://localhost:8084/api/s3/render?key=gis-data/hydrology/salinity/2026/raster/file.tif"
# Expected: HTTP 200 OK
```

### Test 7: S3 render non-GIS prefix
```bash
curl "http://localhost:8084/api/s3/render?key=uploads/test.tif"
# Expected: HTTP 400 Bad Request
```

---

## Diem manh

1. **Multi-layer security** - Frontend + Next.js API + Backend + S3
2. **3-tier role-based access control** - Phan quyen ro rang
3. **Token-based authentication** - Stateless, scalable
4. **Password hashing** - BCrypt
5. **SQL injection prevention** - JPA Prepared Statements
6. **CORS protection** - Whitelist origins + credentials
7. **S3 prefix validation** - Gioi han truy cap theo prefix
8. **Signed URLs** - Khong expose S3 bucket public

---

## Danh gia tong the

| Tieu chi | Diem | Ghi chu |
|----------|------|---------|
| Authentication | 9/10 | JWT + BCrypt + Stateless |
| Authorization | 10/10 | 3-tier RBAC + Method-level security |
| API Security | 9/10 | Phan quyen chi tiet theo URL + Method |
| Database Security | 8/10 | JPA ORM + Prepared Statements |
| S3 Security | 9/10 | Prefix validation + Signed URLs |
| CORS | 10/10 | Whitelist + proper config |
| Session Management | 10/10 | Stateless JWT |
| Error Handling | 9/10 | GlobalExceptionHandler, generic messages |

**Tong diem: 9.25/10**

---

**Ngay danh gia**: 2026-07-09
**Phien ban**: 2.0
