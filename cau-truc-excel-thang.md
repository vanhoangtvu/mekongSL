# Cấu trúc Excel Tháng - Mekong Data

## Tổng quan

Script `update-mekong-monthly-xlsx.mjs` tạo file Excel theo tháng cho dữ liệu Mekong với cấu trúc thang (cột ngày động).

## Cấu trúc cột

### Cột cố định (BASE_COLUMNS)

| Cột | Mô tả |
|-----|-------|
| MaCamBien | Mã cảm biến (SensorNodeCode hoặc SerialNumber) |
| Ten | Tên cảm biến (SNShortName, SNDescription, NameLine_1, hoặc SerialNumber) |
| TinhThanh | Tên tỉnh thành (ProvinceName) |
| ToaDoX | Kinh độ (Longitude) |
| ToaDoY | Vĩ độ (Latitude) |

### Cột động (ngày trong tháng)

- Format: `DD/MM` (ví dụ: `01/05`, `02/05`, ..., `31/05`)
- Số lượng cột phụ thuộc vào số ngày trong tháng (28-31 cột)
- Được tạo tự động bởi `buildDayColumns(year, month)`

## Ví dụ cấu trúc

```
MaCamBien | Ten | TinhThanh | ToaDoX | ToaDoY | 01/05 | 02/05 | 03/05 | ... | 31/05
----------|-----|-----------|--------|--------|-------|-------|-------|-----|-------
TV001     | ... | Tra Vinh  | 106.xx | 9.xx   | 12.5  | 13.2  | 14.1  | ... | 15.8
TV002     | ... | Tra Vinh  | 106.xx | 9.xx   | 8.3   | 8.5   | 8.7   | ... | 9.1
```

## Metrics được tạo

Mỗi metric tạo 1 file riêng:

1. **Salinity** → `mekong-salinity-YYYY-MM.xlsx`
2. **PH** → `mekong-ph-YYYY-MM.xlsx`
3. **WaterLevel** → `mekong-waterlevel-YYYY-MM.xlsx`

## Logic cập nhật

1. Đọc file Excel hiện có (nếu có)
2. Fetch dữ liệu mới từ Mekong API
3. Lọc chỉ lấy records có "TV" (Trà Vinh)
4. Merge dữ liệu theo `MaCamBien`:
   - Giữ nguyên dữ liệu các ngày cũ
   - Cập nhật giá trị cho cột ngày hiện tại
5. Normalize tất cả cột (đảm bảo đủ cột, điền '' nếu thiếu)
6. Sắp xếp theo `MaCamBien`
7. Ghi file Excel

## Hàm chính

### `buildDayColumns(year, month)`
Tạo mảng tên cột cho các ngày trong tháng.

```javascript
// Tháng 5/2026 (31 ngày)
buildDayColumns(2026, '05')
// => ['01/05', '02/05', ..., '31/05']
```

### `buildColumns(year, month)`
Kết hợp cột cố định và cột ngày.

```javascript
buildColumns(2026, '05')
// => ['MaCamBien', 'Ten', 'TinhThanh', 'ToaDoX', 'ToaDoY', '01/05', '02/05', ..., '31/05']
```

### `updateMetricFile(options)`
Cập nhật file Excel cho 1 metric.

**Parameters:**
- `outputDir`: Thư mục output
- `year`, `month`: Năm và tháng
- `dayColumn`: Cột ngày cần cập nhật (format `DD/MM`)
- `metric`: Object metric `{ key, label, slug }`
- `records`: Mảng dữ liệu từ API

## Sử dụng

```bash
# Cập nhật với ngày hiện tại
node data/mekong/scripts/update-mekong-monthly-xlsx.mjs

# Chỉ định thư mục output
node data/mekong/scripts/update-mekong-monthly-xlsx.mjs --output-dir data/mekong/output

# Chỉ định ngày cụ thể
node data/mekong/scripts/update-mekong-monthly-xlsx.mjs --date 2026-05-24
```

## Output

File được tạo tại: `data/mekong/output/mekong-{metric}-{year}-{month}.xlsx`

Ví dụ:
- `data/mekong/output/mekong-salinity-2026-05.xlsx`
- `data/mekong/output/mekong-ph-2026-05.xlsx`
- `data/mekong/output/mekong-waterlevel-2026-05.xlsx`
