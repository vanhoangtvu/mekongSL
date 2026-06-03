# 💾 BACKUP STRATEGY

## 📊 Phân chia lưu trữ

### MySQL (Server) - Dữ liệu thô
- ✅ Bảng `mekong` - Dữ liệu từ Mekong API
- ✅ Bảng `ecowitt` - Dữ liệu từ Ecowitt API  
- ✅ Bảng `users` - User accounts
- ✅ Query nhanh, real-time access

### S3 (backup.hci.vn) - Files & Backup
- ✅ **Raster layers** - GeoTIFF files (.tif, .tfw)
- ✅ **MySQL backups** - Daily automated backup
- ✅ **User uploads** - Documents, images

---

## 🔄 Backup tự động

### Scheduled Job
```java
@Scheduled(cron = "0 0 0 * * ?") // Mỗi ngày lúc 00:00
public void backupMysqlToS3() {
    1. Export MySQL → SQL file
    2. Compress → GZIP
    3. Upload to S3 → backups/mysql/20260525_000000_mekong.sql.gz
    4. Delete local files
}
```

### Cron Schedule
- **Daily**: 00:00 (midnight)
- **Retention**: 
  - Daily backups: 7 days
  - Weekly backups: 4 weeks  
  - Monthly backups: 12 months

---

## 📁 Cấu trúc S3

```
c01-mekong-prod-01/
├── raster/                           # GeoTIFF layers
│   ├── salinity/
│   │   ├── salinity_313_900.tif     # Raster data
│   │   └── salinity_313_900.tfw     # World file
│   ├── temperature/
│   └── water_level/
│
├── backups/                          # MySQL backups
│   └── mysql/
│       ├── 20260525_000000_mekong.sql.gz
│       ├── 20260526_000000_mekong.sql.gz
│       └── manual_20260525_120000_mekong.sql.gz
│
└── uploads/                          # User files
    ├── 20260525_183000_report.pdf
    └── 20260525_183100_data.xlsx
```

---

## 🚀 API Endpoints

### Trigger manual backup
```bash
POST /api/backup/trigger
Authorization: Bearer <manager_token>

# Response
{
  "message": "Backup completed successfully",
  "s3_key": "backups/mysql/manual_20260525_120000_mekong.sql.gz"
}
```

### Upload raster layer
```bash
POST /api/s3/upload
Authorization: Bearer <manager_token>
Content-Type: multipart/form-data

# Upload GeoTIFF
curl -X POST http://14.183.200.227:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@salinity_map.tif"
```

---

## 🔧 Configuration

### application.yaml
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mekong
    username: root
    password: "1111"

s3:
  endpoint: https://backup.hci.vn
  bucket: c01-mekong-prod-01
  access-key: ${S3_ACCESS_KEY}
  secret-key: ${S3_SECRET_KEY}
```

---

## 📊 Storage Estimate

### MySQL (Server)
- Mekong data: ~100 MB/month
- Ecowitt data: ~50 MB/month
- Users: ~1 MB
- **Total**: ~150 MB/month

### S3 (Backup)
- Daily backups: ~150 MB × 7 days = ~1 GB
- Raster layers: ~2 GB (one-time)
- User uploads: ~500 MB/month
- **Total**: ~3.5 GB

---

## 🧪 Test Backup

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://14.183.200.227:8084/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}' | jq -r '.token')

# 2. Trigger manual backup
curl -X POST http://14.183.200.227:8084/api/backup/trigger \
  -H "Authorization: Bearer $TOKEN"

# 3. List backups
curl -X GET http://14.183.200.227:8084/api/s3/list?prefix=backups/mysql/ \
  -H "Authorization: Bearer $TOKEN"
```

---

## ✅ Lợi ích

1. **MySQL** - Dữ liệu thô, query nhanh
2. **S3 Raster** - GeoTIFF layers cho map
3. **S3 Backup** - Disaster recovery
4. **Automated** - Không cần can thiệp thủ công
5. **Compliance** - Object locking 7 days

---

**Kiến trúc này tối ưu cho:**
- ⚡ Performance (MySQL)
- 💾 Storage (S3)
- 🔒 Security (Backup)
- 💰 Cost-effective
