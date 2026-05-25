# Backend API - Authentication & Authorization

## 🚀 Khởi chạy

```bash
cd backend
./mvnw clean install
./mvnw spring-boot:run
```

Server chạy tại: `http://localhost:8084`

## 👤 Default Users

Khi khởi động lần đầu, hệ thống tự động tạo 2 user:

| Username | Password | Role | Email |
|----------|----------|------|-------|
| `user` | `user123` | USER | user@mekong.com |
| `manager` | `manager123` | DATA_MANAGER | manager@mekong.com |

## 🔐 Authentication Endpoints

### 1. Đăng ký (Register)
```bash
POST http://localhost:8084/api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type": "Bearer",
  "username": "john_doe",
  "email": "john@example.com",
  "role": "USER"
}
```

### 2. Đăng nhập (Login)
```bash
POST http://localhost:8084/api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123"
}
```

**Response:** Giống như register

## 👥 Roles

- **USER**: Role mặc định khi đăng ký
- **DATA_MANAGER**: Có quyền truy cập `/api/data`

## 🔒 Protected Endpoints

### Truy cập dữ liệu (chỉ DATA_MANAGER)
```bash
GET http://localhost:8084/api/data
Authorization: Bearer <token>
```

**Response (nếu có quyền):**
```json
{
  "message": "This is protected data endpoint",
  "access": "Only DATA_MANAGER role can access this"
}
```

**Response (nếu không có quyền):**
```json
{
  "error": "Access Denied"
}
```

## 🛠️ Cách thay đổi role

### Option 1: Trực tiếp trong database
```sql
UPDATE users SET role = 'DATA_MANAGER' WHERE username = 'john_doe';
```

### Option 2: Tạo admin endpoint (TODO)
Thêm endpoint `/api/admin/users/{id}/role` để admin thay đổi role.

## 📝 Validation Rules

### Register
- `username`: 3-50 ký tự, bắt buộc, unique
- `email`: Email hợp lệ, bắt buộc, unique
- `password`: Tối thiểu 6 ký tự, bắt buộc

### Login
- `username`: Bắt buộc
- `password`: Bắt buộc

## 🔑 JWT Configuration

File: `application.yaml`
```yaml
jwt:
  secret: ${JWT_SECRET:mekong-secret-key-change-in-production-min-256-bits-long}
  expiration: 86400000  # 24 hours in milliseconds
```

**Production**: Đặt biến môi trường `JWT_SECRET` với key mạnh hơn.

## 🌐 CORS Configuration

Cho phép frontend từ:
- `http://localhost:3004` (Next.js dev)
- `http://localhost:3000`

Thay đổi trong `SecurityConfig.java` nếu cần.

## 📊 Database Schema

Table `users` sẽ được tự động tạo khi chạy app (JPA `ddl-auto: update`):

```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME
);
```

## 🧪 Test với cURL

### Quick Test với Default Users

```bash
# 1. Login với USER (không có quyền truy cập /api/data)
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}'

# 2. Login với DATA_MANAGER (có quyền truy cập /api/data)
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}'

# 3. Test truy cập /api/data với token của manager
TOKEN="<token_from_manager_login>"
curl -X GET http://localhost:8084/api/data \
  -H "Authorization: Bearer $TOKEN"
```

### Test đầy đủ

### 1. Đăng ký user mới
```bash
curl -X POST http://localhost:8084/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Đăng nhập
```bash
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### 3. Truy cập endpoint protected (sẽ bị từ chối vì role USER)
```bash
TOKEN="<token_from_login>"
curl -X GET http://localhost:8084/api/data \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Thay đổi role thành DATA_MANAGER
```bash
mysql -u root -p1111 mekong -e "UPDATE users SET role='DATA_MANAGER' WHERE username='testuser';"
```

### 5. Thử lại (sẽ thành công)
```bash
curl -X GET http://localhost:8084/api/data \
  -H "Authorization: Bearer $TOKEN"
```

## 📚 Swagger UI

Truy cập: `http://localhost:8084/swagger-ui.html`

## ⚠️ Lưu ý

1. **JWT Secret**: Thay đổi trong production
2. **Password**: Đã được hash bằng BCrypt
3. **Token expiration**: 24 giờ (có thể thay đổi)
4. **CORS**: Chỉ cho phép localhost, cần cấu hình lại cho production
