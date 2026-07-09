# Bao mat he thong

## Cac lop bao mat da trien khai

### 1. Backend Security (Spring Security + JWT)

#### Authentication
- JWT token voi expiration 24h
- Password hashing voi BCrypt
- Token validation tren moi request (JwtAuthenticationFilter)

#### Authorization
- 3 role: USER, DATA_MANAGER, ADMIN
- `@PreAuthorize` annotations tren sensitive endpoints
- SecurityFilterChain phan quyen chi tiet theo URL pattern + HTTP method

#### Endpoints Protection
```java
// Public endpoints
/api/auth/**                    => Public
/api/gis/manual-stations/** GET => Public
/api/gis/water-quality/**   GET => Public
/api/articles/public/**     GET => Public
/api/s3/render                  => Public (chi gis-data/ prefix)
/api/s3/download                => Public
/api/s3/list GET (gis-data/)    => Public

// DATA_MANAGER+
/api/data/**                    => hasAnyRole(DATA_MANAGER, ADMIN)

// Authenticated
Tat ca endpoint con lai          => authenticated()

// Admin only
/api/admin/users                => @PreAuthorize (trong controller)
```

### 2. Frontend Security

#### Auth Service (lib/auth.ts)
- Token validation (check expiration)
- Role checking (priority: USER < DATA_MANAGER < ADMIN)
- Secure storage (localStorage)
- Auto logout khi token expired
- Landing page routing theo role

#### Route Protection
- AuthGuard component cho protected routes
- Triple check: isAuthenticated() + isTokenValid() + hasRole()
- Redirect /unauthorized khi khong du quyen
- Redirect /auth khi chua dang nhap

### 3. S3 Security

- Prefix validation: upload chi chap nhan key bat dau bang `gis-data/`, `station-data/`, `monitoring-data/`, `news-images/`
- Render endpoint chi cho phep `gis-data/` prefix
- Signed URLs thay vi public URLs cho GIS data

## Test Cases

### Test 1: User khong dang nhap
Truy cap /data -> Redirect to /auth

### Test 2: USER role try /data
Login voi user/user123, truy cap /data -> Redirect to /unauthorized

### Test 3: DATA_MANAGER role truy cap /data
Login voi manager/manager123, truy cap /data -> Cho phep

### Test 4: Token expired
Token het han (sau 24h), truy cap /data -> Auto logout -> Redirect to /auth

### Test 5: Backend API direct access
```bash
# Khong co token -> 401/403
curl http://localhost:8084/api/data

# Token cua USER: try /api/data -> 403 Forbidden
curl -H "Authorization: Bearer <user_token>" http://localhost:8084/api/data

# Token cua DATA_MANAGER: try /api/data -> 200 OK
curl -H "Authorization: Bearer <manager_token>" http://localhost:8084/api/data
```

## Security Best Practices Implemented

### Authentication
- [x] JWT voi secret key
- [x] Token expiration (24h)
- [x] Password hashing (BCrypt)
- [x] Stateless sessions

### Authorization
- [x] 3-tier role-based access control
- [x] Route protection (frontend)
- [x] API endpoint protection (backend)
- [x] Method-level security (@PreAuthorize)
- [x] Frontend + Backend double check

### Token Management
- [x] Token validation (expiration check)
- [x] Auto logout khi expired
- [x] Secure localStorage storage

### CORS
- [x] Whitelist specific origins
- [x] Credentials allowed
- [x] Proper headers (Content-Range, Accept-Ranges)

### S3
- [x] Key prefix validation
- [x] Signed URLs
- [x] File size limit (100MB)

### Error Handling
- [x] GlobalExceptionHandler
- [x] Khong expose sensitive info
- [x] Proper HTTP status codes

## Ket luan

He thong da duoc bao mat o ca 3 tang:
- **Backend**: Spring Security + JWT + 3-tier RBAC
- **Frontend**: Route guards + Token validation + Role checking
- **S3**: Prefix validation + Signed URLs
