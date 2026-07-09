# Cau truc Excel Thang - Mekong Data

## Tong quan

Script Tao file Excel theo thang cho du lieu Mekong voi cau truc thang (cot ngay dong). Duoc quan ly qua Next.js API route `/api/mekong-monthly/*`.

## Cau truc cot

### Cot co dinh (BASE_COLUMNS)

| Cot | Mo ta |
|-----|-------|
| MaCamBien | Ma cam bien (SensorNodeCode hoac SerialNumber) |
| Ten | Ten cam bien (SNShortName, SNDescription, NameLine_1, hoac SerialNumber) |
| TinhThanh | Ten tinh thanh (ProvinceName) |
| ToaDoX | Kinh do (Longitude) |
| ToaDoY | Vi do (Latitude) |

### Cot dong (ngay trong thang)

- Format: `DD/MM` (vi du: `01/05`, `02/05`, ..., `31/05`)
- So luong cot phu thuoc vao so ngay trong thang (28-31 cot)

## Vi du cau truc

```
MaCamBien | Ten | TinhThanh | ToaDoX | ToaDoY | 01/05 | 02/05 | 03/05 | ... | 31/05
----------|-----|-----------|--------|--------|-------|-------|-------|-----|-------
TV001     | ... | Tra Vinh  | 106.xx | 9.xx   | 12.5  | 13.2  | 14.1  | ... | 15.8
TV002     | ... | Tra Vinh  | 106.xx | 9.xx   | 8.3   | 8.5   | 8.7   | ... | 9.1
```

## Metrics duoc tao

Moi metric tao 1 file rieng:

1. **Salinity** -> `mekong-salinity-YYYY-MM.xlsx`
2. **PH** -> `mekong-ph-YYYY-MM.xlsx`
3. **WaterLevel** -> `mekong-waterlevel-YYYY-MM.xlsx`

## API Endpoints (Next.js)

### List files
```bash
GET /api/mekong-monthly/files
Authorization: Bearer <token>
```

### Refresh/Update
```bash
POST /api/mekong-monthly/update
Authorization: Bearer <token>
```

### Export XLSX
```bash
GET /api/mekong-monthly/export?year=2026&month=5&metric=salinity
Authorization: Bearer <token>
```

## Output

File duoc tao va quan ly qua Next.js API routes, su dung thu vien `xlsx` de tao file Excel.

## Data Source

Du lieu lay tu bang `mekong_sensor` va `mekong_measurement` trong MySQL, duoc thu thap boi `datacenter/mekong/fetch-mekong-data.mjs` tu Mekong API (Rynan Mobile).
