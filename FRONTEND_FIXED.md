# Frontend Fixed - Tóm Tắt Sửa Lỗi

## Vấn Đề
Frontend không chạy được với lỗi: `sh: 1: next: not found`

## Nguyên Nhân
- Script `manage.sh` sử dụng lệnh `npm run dev` để khởi động frontend
- Lệnh này gọi `next` trực tiếp, nhưng PATH environment không được thiết lập đúng khi chạy qua `setsid`
- Dependencies đã được cài đặt nhưng binary `next` không thể tìm thấy do PATH

## Giải Pháp
Đã sửa `manage.sh` để sử dụng `npx` thay vì gọi trực tiếp qua `npm run`:

### Thay đổi trong function `start_frontend`:
```bash
# CŨ:
setsid npm run dev > "$FE_LOG" 2>&1 &

# MỚI:
setsid npx next dev -p 3004 > "$FE_LOG" 2>&1 &
```

### Thay đổi trong function `start_frontend_prod`:
```bash
# CŨ:
setsid npm run start > "$FE_LOG" 2>&1 &

# MỚI:
setsid npx next start -H 0.0.0.0 -p 3004 > "$FE_LOG" 2>&1 &
```

## Cách Khởi Động Frontend

### Phương pháp 1: Sử dụng manage.sh (KHUYÊN DÙNG)
```bash
./manage.sh
# Chọn option 2 để khởi động FE Dev mode
# Hoặc option 3 để khởi động FE Production mode
```

### Phương pháp 2: Khởi động thủ công
```bash
cd /home/hv/DuAn/Mekong/frontend
npx next dev -p 3004
```

### Phương pháp 3: Production build
```bash
cd /home/hv/DuAn/Mekong/frontend
npm run build
npx next start -H 0.0.0.0 -p 3004
```

## Xác Minh Frontend Đang Chạy

### Kiểm tra port đang lắng nghe:
```bash
ss -tlnp | grep 3004
```

### Kiểm tra truy cập local:
```bash
curl http://localhost:3004
```

### Kiểm tra truy cập từ public IP:
```bash
curl http://123.22.60.218:3004
```

## Cấu Hình

### File .env.local
```
NEXT_PUBLIC_API_URL=http://123.22.60.218:8084/api
NEXT_PUBLIC_TITILER_URL=http://123.22.60.218:8001
NEXT_PUBLIC_USE_TITILER=false
NEXT_PUBLIC_SITE_URL=https://mekongsaltlab.org
```

### Ports đang sử dụng:
- **Frontend**: 3004
- **Backend**: 8084  
- **TiTiler**: 8001

### Firewall:
Tất cả các ports đã được mở trong UFW firewall.

## Trạng Thái Hiện Tại
✅ Frontend đang chạy thành công
✅ Backend đang chạy thành công
✅ Có thể truy cập từ localhost
✅ Có thể truy cập từ public IP 123.22.60.218
⚠️  Một số lỗi S3 403 (do cấu hình S3 credentials)

## Ghi Chú
- Script `manage.sh` đã được cập nhật và có thể sử dụng bình thường
- Dependencies không cần cài lại, đã có sẵn trong `node_modules`
- Frontend sẽ tự động compile khi có thay đổi code trong dev mode
