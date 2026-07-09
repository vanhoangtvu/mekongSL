# 🔒 BẢO MẬT HỆ THỐNG

## ✅ Các lớp bảo mật đã triển khai

### 1. Backend Security (Spring Security + JWT)

#### Authentication
- JWT token với expiration 24h
- Password hashing với BCrypt
- Token validation trên mỗi request

#### Authorization
- Role-based access control (RBAC)
- `@PreAuthorize("hasRole('DATA_MANAGER')")` trên endpoints
- SecurityFilterChain chặn unauthorized requests

#### Endpoints Protection
```java
// Public endpoints
/api/auth/register ✅ Public
/api/auth/login ✅ Public

// Protected endpoints
/api/data ⛔ Chỉ DATA_MANAGER
```

### 2. Frontend Security

#### Auth Service
- Token validation (check expiration)
- Role checking
- Secure storage (localStorage với error handling)
- Auto logout khi token expired

#### Route Protection
- Auth check trên mỗi protected page
- Token validity check
- Role verification
- Redirect nếu không đủ quyền

#### Data Page Protection
```typescript
// Triple check:
1. isAuthenticated() - Có đăng nhập?
2. isTokenValid() - Token còn hạn?
3. hasRole('DATA_MANAGER') - Có quyền?
```

## 🧪 Test Cases

### ✅ Test 1: User không đăng nhập
```bash
# Truy cập /data
→ Redirect to /auth
```

### ✅ Test 2: User role USER
```bash
# Login với user/user123
# Truy cập /data
→ Redirect to /unauthorized
```

### ✅ Test 3: User role DATA_MANAGER
```bash
# Login với manager/manager123
# Truy cập /data
→ ✅ Cho phép truy cập
```

### ✅ Test 4: Token expired
```bash
# Token hết hạn (sau 24h)
# Truy cập /data
→ Auto logout → Redirect to /auth
```

### ✅ Test 5: Backend API direct access
```bash
# Không có token
curl http://localhost:8084/api/data
→ 401 Unauthorized

# Token của USER
curl -H "Authorization: Bearer <user_token>" http://localhost:8084/api/data
→ 403 Forbidden

# Token của DATA_MANAGER
curl -H "Authorization: Bearer <manager_token>" http://localhost:8084/api/data
→ 200 OK
```

## 🔐 Security Best Practices Implemented

### ✅ Authentication
- [x] JWT với secret key mạnh
- [x] Token expiration (24h)
- [x] Password hashing (BCrypt)
- [x] Secure password validation (min 6 chars)

### ✅ Authorization
- [x] Role-based access control
- [x] Route protection
- [x] API endpoint protection
- [x] Frontend + Backend double check

### ✅ Token Management
- [x] Token validation (expiration check)
- [x] Auto logout khi expired
- [x] Secure storage
- [x] Token refresh on login

### ✅ Error Handling
- [x] Không expose sensitive info trong error
- [x] Generic error messages
- [x] Proper HTTP status codes

### ✅ CORS
- [x] Whitelist specific origins
- [x] Credentials allowed
- [x] Proper headers

## 🚨 Security Checklist

- [x] Backend API có authentication
- [x] Backend API có authorization
- [x] Frontend check auth trước khi render
- [x] Frontend check role trước khi cho phép truy cập
- [x] Token có expiration
- [x] Token được validate
- [x] Password được hash
- [x] CORS được cấu hình đúng
- [x] Error messages không leak info
- [x] Redirect đúng khi unauthorized

## 📝 Hướng dẫn test

### Test với cURL:

```bash
# 1. Login với manager
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}'

# Copy token từ response

# 2. Truy cập /api/data với token
curl http://localhost:8084/api/data \
  -H "Authorization: Bearer <token>"

# 3. Test với user (sẽ bị chặn)
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}'

curl http://localhost:8084/api/data \
  -H "Authorization: Bearer <user_token>"
# → Không có response (403 Forbidden)
```

### Test với Browser:

1. Mở http://localhost:3004/data (chưa login)
   - ✅ Redirect to /auth

2. Login với user/user123
   - ✅ Login thành công
   - Truy cập /data
   - ✅ Redirect to /unauthorized

3. Login với manager/manager123
   - ✅ Login thành công
   - Truy cập /data
   - ✅ Hiển thị trang data

4. Xóa token trong localStorage
   - Refresh /data
   - ✅ Redirect to /auth

## 🎯 Kết luận

Hệ thống đã được bảo mật ở cả 2 tầng:
- **Backend**: Spring Security + JWT + Role-based authorization
- **Frontend**: Route guards + Token validation + Role checking

Chỉ user có role `DATA_MANAGER` và token hợp lệ mới truy cập được `/data`.
