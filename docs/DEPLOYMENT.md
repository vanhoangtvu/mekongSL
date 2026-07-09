# Deployment - Truy cap qua IP Public

## Dia chi truy cap

### Frontend
```
http://103.54.251.212:3004
https://mekongsaltlab.org
https://www.mekongsaltlab.org
```

### Backend API
```
http://103.54.251.212:8084/api
```

## Khoi dong he thong

Dung `manage.sh` de quan ly ca 2 dich vu cung luc:

```bash
cd /home/hv/DuAn/Mekong
./manage.sh
```

Menu quan ly ho tro:
- Start/Stop/Restart Backend (port 8084)
- Start/Stop/Restart Frontend (port 3004)
- Xem logs backend + frontend
- Kiem tra status
- Cau hinh IP

### Hoac khoi dong thu cong:

```bash
# Backend
cd /home/hv/DuAn/Mekong/backend
./mvnw spring-boot:run
# hoac
java -jar target/mekongsaltlab-0.0.1-SNAPSHOT.jar

# Frontend
cd /home/hv/DuAn/Mekong/frontend
npm run dev -- -H 0.0.0.0 -p 3004
# hoac production build:
npm run build && npm run start
```

## Cau hinh

### Frontend (next.config.mjs)
```js
async rewrites() {
  return [{
    source: '/api/:path*',
    destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8084/api'}/:path*`,
  }];
}
```

### Backend CORS (SecurityConfig.java)
```java
configuration.setAllowedOrigins(List.of(
    "http://localhost:3004",
    "http://localhost:3000",
    "http://103.54.251.212",
    "http://103.54.251.212:3004",
    "http://103.54.251.212:3000",
    "https://103.54.251.212",
    "https://mekongsaltlab.org",
    "https://www.mekongsaltlab.org"
));
```

### Backend (application.yaml)
```yaml
server:
  port: 8084
  address: 0.0.0.0  # Listen tren tat ca interfaces
```

## Firewall (neu can)

```bash
# Mo port 3004 (Frontend)
sudo ufw allow 3004/tcp

# Mo port 8084 (Backend)
sudo ufw allow 8084/tcp

# Kiem tra status
sudo ufw status
```

## Test ket noi

### Test Backend
```bash
curl http://103.54.251.212:8084/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test Frontend
Mo browser: `http://103.54.251.212:3004`

## Luu y

1. **Restart sau khi thay doi config**: Dung `manage.sh` hoac kill process va start lai
2. **Check logs**:
   ```bash
   tail -f backend/backend.log
   # Frontend logs co trong manage.sh
   ```
3. **Kiem tra process dang chay**:
   ```bash
   ps aux | grep "next-server\|spring-boot\|mekongsaltlab"
   ```

## Bao mat

- Backend da cau hinh CORS cho IP public + domain names
- JWT token van hoat dong binh thuong
- Phan quyen khong thay doi
- S3 credentials su dung bien moi truong

## Truy cap tu may khac

Tu bat ky may nao trong mang (hoac internet neu co public IP):
```
http://103.54.251.212:3004
```

Login voi:
- **Admin**: admin / admin123
- **Manager**: manager / manager123
- **User**: user / user123
