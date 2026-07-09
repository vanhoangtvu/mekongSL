# Bao cao bao mat he thong Mekong WebGIS

## Tong quan bao mat

He thong da duoc bao mat o **4 tang**:
1. **Frontend** - Route protection + AuthGuard + AuthService
2. **Next.js API Layer** - Backend-for-frontend proxy routes
3. **Backend** - Spring Security + JWT + 3-tier RBAC
4. **S3 Storage** - Prefix validation + Signed URLs

---

## Chi tiet bao mat

### 1. Authentication (Xac thuc)

#### Backend (Spring Boot)
- JWT token voi expiration 24h (cau hinh duoc)
- Password hashing voi BCrypt
- Token validation tren moi request qua JwtAuthenticationFilter
- UserDetailsService load user tu bang `users`
- Stateless sessions (SessionCreationPolicy.STATELESS)

#### Frontend (Next.js)
- Token luu trong localStorage (AuthService)
- Token validation (decode JWT, check expiration)
- Auto logout khi token expired
- Redirect to /auth khi chua dang nhap
- Landing page routing theo role

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
