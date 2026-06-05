# 🌐 Truy cập qua IP Public

## 📍 Địa chỉ truy cập

### Frontend
```
http://14.227.143.142:3004
```

### Backend API
```
http://14.227.143.142:8084/api
```

## 🚀 Khởi động hệ thống

### 1. Start Backend
```bash
cd /home/hv/DuAn/Mekong/backend
./start.sh

# Hoặc manual:
./mvnw spring-boot:run
```

### 2. Start Frontend
```bash
cd /home/hv/DuAn/Mekong/frontend
./start.sh

# Hoặc manual:
npm run dev -- -H 0.0.0.0 -p 3004
```

## ⚙️ Cấu hình đã thay đổi

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://14.227.143.142:8084/api
```

### Backend (application.yaml)
```yaml
server:
  port: 8084
  address: 0.0.0.0  # Listen trên tất cả interfaces
```

### Backend CORS (SecurityConfig.java)
```java
configuration.setAllowedOrigins(List.of(
    "http://localhost:3004",
    "http://localhost:3000",
    "http://14.227.143.142:3004",  // ✅ Added
    "http://14.227.143.142:3000"   // ✅ Added
));
```

## 🔥 Firewall (nếu cần)

```bash
# Mở port 3004 (Frontend)
sudo ufw allow 3004/tcp

# Mở port 8084 (Backend)
sudo ufw allow 8084/tcp

# Kiểm tra status
sudo ufw status
```

## 🧪 Test kết nối

### Test Backend
```bash
curl http://14.227.143.142:8084/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}'
```

### Test Frontend
Mở browser: `http://14.227.143.142:3004`

## 📝 Lưu ý

1. **Restart sau khi thay đổi config**
   ```bash
   # Frontend
   cd frontend
   ./stop.sh
   ./start.sh
   
   # Backend
   cd backend
   pkill -f spring-boot
   ./start.sh
   ```

2. **Check logs**
   ```bash
   # Frontend
   tail -f frontend/app.log
   
   # Backend
   tail -f backend/backend.log
   ```

3. **Kiểm tra process đang chạy**
   ```bash
   # Frontend
   ps aux | grep "next-server"
   
   # Backend
   ps aux | grep "spring-boot"
   ```

## 🔒 Bảo mật

- Backend đã cấu hình CORS cho IP public
- JWT token vẫn hoạt động bình thường
- Phân quyền không thay đổi

## 🌍 Truy cập từ máy khác

Từ bất kỳ máy nào trong mạng (hoặc internet nếu có public IP):
```
http://14.227.143.142:3004
```

Login với:
- **Manager**: manager / manager123
- **User**: user / user123
