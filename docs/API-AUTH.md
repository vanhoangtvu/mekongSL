# Backend API - Authentication & Authorization

## Khoi chay

```bash
cd backend
./mvnw clean install
./mvnw spring-boot:run
```

Server chay tai: `http://localhost:8084`

## Default Users

Khi khoi dong lan dau, he thong co cac user:

| Username | Password | Role | Email |
|----------|----------|------|-------|
| `user` | `user123` | USER | user@mekong.com |
| `manager` | `manager123` | DATA_MANAGER | manager@mekong.com |
| `admin` | `admin123` | ADMIN | admin@mekong.com |

## Authentication Endpoints

### 1. Dang ky (Register)
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
  "username": "john_doe",
  "email": "john@example.com",
  "role": "USER"
}
```

### 2. Dang nhap (Login)
```bash
POST http://localhost:8084/api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123"
}
```

## Roles

- **USER**: Role mac dinh khi dang ky. Xem ban do, articles public, download S3.
- **DATA_MANAGER**: Quan ly du lieu, upload/delete S3, GIS CRUD, station/water-quality management.
- **ADMIN**: Toan quyen: quan ly users, articles, backup, tat ca CRUD endpoints.

## Endpoints & Permissions

### Public (khong can token)
- `POST /api/auth/register` - Dang ky
- `POST /api/auth/login` - Dang nhap
- `GET /api/gis/manual-stations/**` - Xem tram manual
- `GET /api/gis/water-quality/**` - Xem du lieu chat luong nuoc
- `GET /api/articles/public/**` - Xem articles cong khai
- `GET /api/s3/render` - Render GeoTIFF (chi gis-data/ prefix)
- `GET /api/s3/download` - Download file S3
- `GET /api/s3/list?prefix=gis-data/` - List gis-data files
- `GET /swagger-ui/**`, `GET /v3/api-docs/**` - API docs

### Yeu cau DATA_MANAGER+
- `GET /api/data/**` - Du lieu endpoint

### Yeu cau ADMIN
- `GET|POST /api/admin/users` - Quan ly users
- `PUT|DELETE /api/admin/users/{id}` - Sua/xoa user

### Yeu cau authenticated (bat ky role nao)
- Tat ca cac endpoint con lai (GIS CRUD, S3 upload/delete/copy/rename/folders, Articles management, Backup)

## JWT Configuration

File: `application.yaml`
```yaml
jwt:
  secret: ${JWT_SECRET:mekong-secret-key-change-in-production-min-256-bits-long}
  expiration: 86400000  # 24 hours in milliseconds
```

**Production**: Dat bien moi truong `JWT_SECRET` voi key manh hon.

## CORS Configuration

Cho phep frontend tu:
- `http://localhost:3004`, `http://localhost:3000`
- `http://103.54.251.212`, `http://103.54.251.212:3004`, `http://103.54.251.212:3000`
- `https://103.54.251.212`
- `https://mekongsaltlab.org`, `https://www.mekongsaltlab.org`

Thay doi trong `SecurityConfig.java` neu can.

## Database Schema

Table `users` se duoc tu dong tao khi chay app (JPA `ddl-auto: update`):

```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role ENUM('USER','DATA_MANAGER','ADMIN') NOT NULL DEFAULT 'USER',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME
);
```

## Test voi cURL

```bash
# 1. Login voi USER
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}'

# 2. Login voi DATA_MANAGER
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}'

# 3. Login voi ADMIN
curl -X POST http://localhost:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 4. Truy cap endpoint protected voi token
TOKEN="<token_tu_login>"
curl -X GET http://localhost:8084/api/data \
  -H "Authorization: Bearer $TOKEN"
```

## Swagger UI

Truy cap: `http://localhost:8084/swagger-ui.html`

## Luu y

1. **JWT Secret**: Thay doi trong production
2. **Password**: Da duoc hash bang BCrypt
3. **Token expiration**: 24 gio (co the thay doi)
4. **CORS**: Cau hinh trong `SecurityConfig.java`, da them external IPs va domains
