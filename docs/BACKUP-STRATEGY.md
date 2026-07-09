# Backup Strategy

## Phan chia luu tru

### MySQL (Server) - Du lieu tho
- Bang `mekong_sensor` - Metadata cam bien Mekong
- Bang `mekong_measurement` - Du lieu do dac (Salinity, PH, WaterLevel, Alkalinity)
- Bang `ecowitt` - Du lieu thoi tiet Ecowitt
- Bang `users` - User accounts
- Bang `articles` - Tin tuc/bai viet
- Bang GIS metadata: `layer`, `dataset`, `s3_object`, `layer_object`, `tag`, `tag_link`, `layer_folder`
- Bang `manual_station`, `water_quality_sample`, `water_quality_parameter`
- Query nhanh, real-time access

### S3 (backup.hci.vn) - Files & Backup
- **GIS Data**: GeoTIFF layers, world files (.tif, .tfw) trong `gis-data/`
- **Station Data**: CSV files trong `station-data/`
- **Monitoring Data**: CSV files trong `monitoring-data/`
- **News Images**: Anh bai viet trong `news-images/`
- **User uploads**: Documents, images trong `uploads/`
- **MySQL backups**: Daily automated backup trong `backups/`

## Cau truc S3 thuc te

```
c01-mekong-prod-01/
├── gis-data/                          # GIS raster/vector layers
│   ├── landsat-imagery/               # Landsat bands
│   ├── hydrology/                     # Salinity, Tidal, pH
│   │   └── salinity/{year}/{month}/{day}/{time}/raster/
│   ├── baseline-environment/          # Landuse, soil, water body...
│   │   └── landuse-classification/{class}/{year}/raster/
│   └── ...
├── station-data/                      # Data files theo station
│   └── {stationCode}/{parameter}/{year}/{month}/{day}/{time}/
├── monitoring-data/                   # Monitoring data files
│   └── {monitoringCode}/{parameter}/{year}/{month}/{day}/{time}/
├── news-images/                       # Anh cho articles
├── uploads/                           # User upload files
└── backups/                           # MySQL database backups
```

## S3 Operations

He thong ho tro day du cac thao tac S3:
- **Upload**: Upload file voi key tuy chinh hoac tu dong, kiem tra kich thuoc va trung lap
- **Download**: Download file, ho tro HTTP Range requests
- **List**: Liet ke files va folders (voi delimiter)
- **Delete**: Xoa file don le hoac folder de quy
- **Copy**: Sao chep file trong bucket
- **Rename**: Doi ten file (copy + delete)
- **Rename Folder**: Doi ten toan bo folder (copy + delete tung object)
- **Create Folder**: Tao folder (zero-byte placeholder object)
- **Signed URLs**: Tao presigned GET URLs voi thoi han tuy chinh
- **Render**: Phuc vu GeoTIFF inline (chi gis-data/ prefix), ho tro Range requests cho geotiff.js
- **Stats**: Thong ke dung luong theo category (geotiff, backup, spreadsheet, image, document, archive, data)

## API Endpoints

### Trigger manual backup
```bash
POST /api/backup/trigger
Authorization: Bearer <token>

# Response
{
  "message": "Backup completed successfully",
  "s3_key": "backups/mysql/manual_20260525_120000_mekong.sql.gz"
}
```

### Upload file
```bash
POST /api/s3/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

# Upload voi key tu dong
curl -X POST http://localhost:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data.tif"

# Upload voi key tuy chinh (phai co prefix hop le: gis-data/, station-data/, monitoring-data/, news-images/)
curl -X POST http://localhost:8084/api/s3/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "key=gis-data/hydrology/salinity/2026/raster/salinity.tif" \
  -F "file=@salinity.tif"
```

## Configuration

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
  region: us-east-1
  max-file-size: 104857600  # 100MB
```

## Dependencies

- S3-compatible client (`software.amazon.awssdk:s3:2.20.26`)
- S3Presigner cho signed URLs
- Path-style access cho S3-compatible endpoints

## Loi ich

1. **MySQL** - Du lieu tho, query nhanh
2. **S3 Raster** - GeoTIFF layers cho map, phuc vu qua signed URLs
3. **S3 Backup** - Disaster recovery
4. **S3 DB Tracking** - `s3_object` table theo doi moi file tren S3
5. **Soft Delete** - Xoa logic thay vi xoa cung trong DB
6. **Category Stats** - Thong ke dung luong theo loai file

---

**Kien truc nay toi uu cho:**
- Performance (MySQL + S3 presigned URLs)
- Storage (S3 object storage)
- Security (JWT auth + prefix validation)
- Cost-effective
