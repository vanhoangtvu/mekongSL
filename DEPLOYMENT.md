# Truy cập qua IP Public

## Địa chỉ truy cập

```
https://103.54.251.212
```

Backend API qua Nginx proxy:
```
https://103.54.251.212/api
```

## Cấu trúc hệ thống

```
Client (HTTPS 443)
    ↓
Nginx (reverse proxy)
    ├── / → http://127.0.0.1:3004 (Next.js Frontend)
    └── /api → http://127.0.0.1:8084 (Spring Boot Backend)
```

## Khởi động hệ thống

### 1. Start Backend
```bash
cd /root/DuAn/Mekong/mekongSL/backend
./start.sh
```

### 2. Start Frontend
```bash
cd /root/DuAn/Mekong/mekongSL/frontend
./start.sh
```

## Cấu hình đã thay đổi

### Backend CORS (SecurityConfig.java)
```yaml
- "https://103.54.251.212"
```

### Nginx
- `/etc/nginx/sites-available/mekong`
- SSL: self-signed tại `/etc/nginx/ssl/`

## Lưu ý

1. **Restart sau khi thay đổi config**
2. **Check logs**:
   - Frontend: `tail -f frontend/app.log`
   - Backend: `tail -f backend/backend.log`
   - Nginx: `journalctl -u nginx -f`

Login với:
- **Admin**: admin / admin123
- **Manager**: manager / manager123
- **User**: user / user123
