# Deployment — Truy Cập Qua IP Public

## Địa Chỉ Truy Cập

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

Menu quản lý hỗ trợ:
- **1** — Start Backend (Spring Boot, port 8084)
- **2** — Frontend Dev mode (Next.js, port 3004)
- **3** — Frontend Production mode (build + start)
- **4** — Stop Backend
- **5** — Stop Frontend
- **6** — Build & Restart Backend
- **7** — Xem log Backend
- **8** — Xem log Frontend
- **9** — Đổi IP (tự động cập nhật CORS + `.env.local`)
- **10** — Start TiTiler (port 8001)
- **11** — Stop TiTiler
- **C** — Auto convert GeoTIFF → COG
- **A** — Restart tất cả dịch vụ

### Khởi động thủ công từng dịch vụ

```bash
# Backend (cần .env ở thư mục gốc)
cd /home/hv/DuAn/Mekong
set -a; source .env; set +a
cd backend
./mvnw spring-boot:run -q

# Frontend
cd frontend
npm run dev -- -H 0.0.0.0 -p 3004
# hoặc production:
npm run build && npm run start

# Datacenter (pipeline dữ liệu)
cd datacenter
node cron-wrapper.mjs

# TiTiler (nếu cần)
source ~/titiler-env/bin/activate
./scripts/titiler-start.sh
```

---

## Cấu Hình

### File `.env` (thư mục gốc)

```env
# S3 Storage
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key

# Mekong API (cho datacenter)
MEKONG_USERNAME=your_username
MEKONG_PASSWORD=your_password
MEKONG_CUSTOMER_CODE=your_code
MEKONG_PROVINCE_CODE=your_province_code
MEKONG_DEVICE_UUID=your_device_uuid

# Ecowitt API (cho datacenter)
ECOWITT_ACCOUNT=your_email@gmail.com
ECOWITT_PASSWORD=your_password
ECOWITT_DEVICE_ID=your_device_id
```

### File `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://your-server-ip:8084/api
NEXT_PUBLIC_SITE_URL=https://mekongsaltlab.org
NEXT_PUBLIC_TITILER_URL=http://your-server-ip:8001
NEXT_PUBLIC_USE_TITILER=false
```

> `NEXT_PUBLIC_API_URL` dùng cho frontend gọi backend **trực tiếp** (bỏ qua proxy Next.js), giúp tăng tốc tải tile lên **4 lần**.

### Backend CORS

Backend tự động cho phép:
- `http://localhost:3004`, `http://localhost:3000`
- `http://your-server-ip:3004`
- `https://mekongsaltlab.org`, `https://www.mekongsaltlab.org`

### Backend (application.yaml)

```yaml
server:
  port: 8084
  address: 0.0.0.0  # Lắng nghe tất cả interfaces
```

---

## Firewall

```bash
# Frontend
sudo ufw allow 3004/tcp

# Backend
sudo ufw allow 8084/tcp

# TiTiler (nếu dùng)
sudo ufw allow 8001/tcp

# Kiểm tra
sudo ufw status
```

---

## Tối Ưu Dữ Liệu

### Convert GeoTIFF → COG

Files GeoTIFF nên được convert sang COG (Cloud Optimized GeoTIFF) để tăng tốc độ render:

| Dữ liệu | Trước | Sau | Giảm |
|---------|:-----:|:---:|:----:|
| Landuse Classification (35 files) | 227 MB | 10 MB | **95%** |
| Landsat Imagery (84 files) | 545 MB | 134 MB | **75%** |

### Tự động convert

```bash
# Quét và convert tất cả file chưa tối ưu
./scripts/auto-cog-watch.sh

# Thêm vào crontab (chạy mỗi 5 phút)
crontab -e
*/5 * * * * /home/hv/DuAn/Mekong/scripts/auto-cog-watch.sh >> /tmp/auto-cog.log 2>&1
```

Hoặc dùng menu **C** trong `manage.sh`.

---

## Kiểm Tra Kết Nối

### Backend
```bash
curl http://123.22.61.134:8084/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# → {"token":"eyJ...", "username":"admin", "role":"ADMIN"}
```

### Frontend
```bash
curl http://123.22.61.134:3004/
# → 200 OK (trang chủ)
```

### S3 Storage
```bash
# Public list (không cần token)
curl http://localhost:8084/api/s3/list?prefix=gis-data/
# → Danh sách 953+ files (đã fix pagination)

# Download public
curl http://localhost:8084/api/s3/download?key=station-data/.../image.jpeg
# → File nếu key hợp lệ
```

---

## Xử Lý Sự Cố

| Vấn đề | Nguyên nhân | Fix |
|--------|------------|-----|
| 403 khi tải ảnh | Backend code cũ | Restart backend với code mới |
| Thiếu Tidal trong list | Thiếu pagination | Restart backend |
| "Maximum update depth" | Cache Next.js cũ | `Ctrl+Shift+R` |
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
