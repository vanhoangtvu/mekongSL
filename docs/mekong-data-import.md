# Import du lieu Mekong vao MySQL

## Script fetch Mekong

File fetch Mekong data: `datacenter/mekong/fetch-mekong-data.mjs`

Script nay tu dong:
1. Login vao Mekong API (Rynan Mobile) qua AES-encrypted password
2. Fetch du lieu sensor theo tinh (provinceCode=86 - Tra Vinh)
3. Upsert metadata sensor vao bang `mekong_sensor`
4. Insert du lieu do dac vao bang `mekong_measurement` (Salinity, PH, WaterLevel, Alkalinity)
5. Danh dau sensor khong con hoat dong (markRowsInactiveNotInList)
6. Xuat CSV snapshot

Chay:
```bash
cd datacenter
node mekong/fetch-mekong-data.mjs
```

## Import du lieu cu (Legacy)

File: `datacenter/mekong/migrate-mekong-legacy.mjs`

Dung de migrate du lieu tu bang cu sang bang moi.

## Du lieu CSV

Script tu dong xuat CSV snapshot sau moi lan fetch:
- `datacenter/output/mekong.csv`

## Cau truc bang MySQL

### mekong_sensor
Chua metadata cua cac cam bien:
- `SensorNodeCode` (unique key) - Ma cam bien
- `Longitude`, `Latitude` - Toa do
- `ProvinceName`, `ProvinceCode` - Tinh thanh
- `SNShortName`, `SNDescription` - Ten mo ta
- `SNShortNameEN`, `SNDescriptionEN` - Ten tieng Anh
- `SerialNumber` - So seri
- `NameLine_1`, `NameLine_2` - Ten dong
- `first_seen_at`, `last_seen_at` - Thoi gian phat hien
- `is_active`, `inactive_at` - Trang thai hoat dong

### mekong_measurement
Chua du lieu do dac:
- `sensor_code` - Ma cam bien (FK den mekong_sensor)
- `fetched_at`, `fetch_run_id` - Thoi gian lay du lieu
- `Salinity` - Do man (DECIMAL 12,3)
- `PH` - Do pH (DECIMAL 12,3)
- `WaterLevel` - Muc nuoc (DECIMAL 12,3)
- `Alkalinity` - Do kiem (DECIMAL 12,3)

## User mac dinh

| Username | Password | Role |
|----------|----------|------|
| `user` | `user123` | USER |
| `manager` | `manager123` | DATA_MANAGER |
| `admin` | `admin123` | ADMIN |
