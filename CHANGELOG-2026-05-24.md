# ✅ CẬP NHẬT LOGIC LẤY DỮ LIỆU - 2026-05-24

## 🎯 YÊU CẦU ĐÃ THỰC HIỆN

### 1. ✅ Khi click "Cập nhật dữ liệu" trên FE
- **Trước**: Gọi API → lưu JSON/CSV vào file → lưu vào MySQL
- **Sau**: Gọi API → **chỉ lưu trực tiếp vào MySQL** (không tạo file JSON/CSV)

**Files đã sửa:**
- `datacenter/mekong/fetch-mekong-data.mjs` - Bỏ logic lưu file, chỉ lưu MySQL
- `frontend/src/app/api/fetch/route.ts` - Gọi script và nhận kết quả từ stdout

### 2. ✅ Filter theo ngày trên FE
- Thêm input `type="date"` để lọc dữ liệu theo `fetched_at` hoặc `time`
- Filter hoạt động với cả Mekong và Ecowitt

**Files đã sửa:**
- `frontend/src/app/(public)/data/page.tsx` - Thêm state `dateFilter` và logic filter

### 3. ✅ Export Excel theo tháng (chỉ Mekong)
- Cấu trúc đúng theo file `cau-truc-excel-thang.md`:
  - Cột cố định: `MaCamBien`, `Ten`, `TinhThanh`, `ToaDoX`, `ToaDoY`
  - Cột động: `01/05`, `02/05`, ..., `31/05` (tùy số ngày trong tháng)
- 3 metrics: Độ mặn, pH, Mực nước
- Dữ liệu lấy từ MySQL theo tháng hiện tại

**Files đã tạo:**
- `frontend/src/app/api/mekong-monthly/export/route.ts` - API export Excel

**Files đã sửa:**
- `frontend/src/app/(public)/data/page.tsx` - Thêm 3 nút export Excel

---

## 📋 LUỒNG DỮ LIỆU MỚI

### Fetch Data (Mekong)

```
FE: Click "Quét dữ liệu mới"
  ↓
POST /api/fetch?source=mekong
  ↓
Spawn: node datacenter/mekong/fetch-mekong-data.mjs
  ↓
1. Login Mekong API → JWT token
2. GET data từ API
3. Transform data
4. INSERT vào MySQL (table: mekong)
  ↓
Return: { success: true, recordCount: X, insertedRows: Y }
  ↓
FE: Alert "Đã cập nhật Y bản ghi vào database"
  ↓
FE: Tự động reload bảng từ MySQL
```

### Export Excel

```
FE: Click "📥 Độ mặn" (hoặc pH, Mực nước)
  ↓
GET /api/mekong-monthly/export?year=2026&month=5&metric=salinity
  ↓
1. Query MySQL: SELECT * FROM mekong WHERE fetched_at BETWEEN '2026-05-01' AND '2026-05-31'
2. Group by SensorNodeCode
3. Build Excel structure:
   - Header: MaCamBien | Ten | TinhThanh | ToaDoX | ToaDoY | 01/05 | 02/05 | ... | 31/05
   - Rows: Mỗi sensor 1 dòng, giá trị metric theo ngày
4. Generate XLSX buffer
  ↓
Return: File download "mekong-salinity-2026-05.xlsx"
```

---

## 🗂️ CẤU TRÚC FILE EXCEL

### Ví dụ: mekong-salinity-2026-05.xlsx

| MaCamBien | Ten           | TinhThanh | ToaDoX   | ToaDoY  | 01/05 | 02/05 | 03/05 | ... | 31/05 |
|-----------|---------------|-----------|----------|---------|-------|-------|-------|-----|-------|
| TV001     | Trạm TV001    | Trà Vinh  | 106.3456 | 9.8765  | 12.5  | 13.2  | 14.1  | ... | 15.8  |
| TV002     | Trạm TV002    | Trà Vinh  | 106.4567 | 9.7654  | 8.3   | 8.5   | 8.7   | ... | 9.1   |
| BT001     | Trạm BT001    | Bến Tre   | 106.5678 | 10.2345 | 5.2   | 5.4   | 5.6   | ... | 6.0   |

**Lưu ý:**
- Nếu ngày nào không có dữ liệu → ô trống
- Mỗi metric (Salinity, PH, WaterLevel) tạo 1 file riêng
- Số cột ngày thay đổi theo tháng (28-31 cột)

---

## 🔧 API ENDPOINTS MỚI

### POST /api/fetch?source=mekong
**Request:**
```
POST /api/fetch?source=mekong
```

**Response:**
```json
{
  "message": "Đã cập nhật 45 bản ghi vào database",
  "source": "mekong",
  "recordCount": 45,
  "insertedRows": 45,
  "timestamp": "24/05/2026, 16:40:00"
}
```

### GET /api/mekong-monthly/export
**Request:**
```
GET /api/mekong-monthly/export?year=2026&month=5&metric=salinity
```

**Query params:**
- `year` (optional): Năm, mặc định năm hiện tại
- `month` (optional): Tháng (1-12), mặc định tháng hiện tại
- `metric` (required): `salinity` | `ph` | `waterlevel`

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File download: `mekong-{metric}-{year}-{month}.xlsx`

---

## 🎨 UI CHANGES

### Trang /data

**Thêm mới:**
1. **Input filter theo ngày**
   - Type: `date`
   - Filter dữ liệu theo `fetched_at` hoặc `time`
   - Áp dụng cho cả Mekong và Ecowitt

2. **Section "Export Excel theo tháng"** (chỉ hiện khi chọn Mekong)
   - 3 nút: 📥 Độ mặn, 📥 pH, 📥 Mực nước
   - Click → download file Excel tháng hiện tại

**Vị trí:**
- Filter ngày: Cùng hàng với "Tìm kiếm trong DB"
- Export Excel: Dưới "Lọc tỉnh", trên "Ecowitt credentials"

---

## 🧪 TESTING

### Test 1: Fetch data không tạo file
```bash
# Chạy script trực tiếp
cd datacenter
node mekong/fetch-mekong-data.mjs

# Kiểm tra:
# ✅ Không tạo file JSON/CSV trong data/mekong/output/
# ✅ Dữ liệu được insert vào MySQL
# ✅ Console log: { "success": true, "recordCount": X, "insertedRows": Y }
```

### Test 2: Filter theo ngày
```
1. Vào /data
2. Chọn nguồn: Mekong
3. Chọn ngày: 2026-05-24
4. Kiểm tra: Chỉ hiện dữ liệu có fetched_at = '2026-05-24'
```

### Test 3: Export Excel
```
1. Vào /data
2. Chọn nguồn: Mekong
3. Click "📥 Độ mặn"
4. Kiểm tra file download:
   - Tên: mekong-salinity-2026-05.xlsx
   - Cột: MaCamBien | Ten | TinhThanh | ToaDoX | ToaDoY | 01/05 | ... | 31/05
   - Dữ liệu: Đúng giá trị Salinity theo ngày
```

---

## ⚠️ LƯU Ý

### Database
- Table `mekong` phải có cột `fetched_at` (DATETIME)
- Dữ liệu cũ không bị xóa, chỉ INSERT thêm
- Nếu muốn tránh duplicate, cần thêm UNIQUE constraint hoặc logic UPDATE

### Performance
- Export Excel query toàn bộ tháng → có thể chậm nếu dữ liệu lớn
- Nên thêm INDEX cho `fetched_at` và `SensorNodeCode`

### Ecowitt
- Ecowitt **không có** chức năng export Excel (theo yêu cầu)
- Chỉ có filter theo ngày

---

## 📝 CHECKLIST

- [x] Sửa `fetch-mekong-data.mjs` - chỉ lưu MySQL
- [x] Sửa `/api/fetch` - gọi script và parse stdout
- [x] Tạo `/api/mekong-monthly/export` - export Excel
- [x] Thêm filter theo ngày trên FE
- [x] Thêm 3 nút export Excel (Mekong only)
- [x] TypeScript compile thành công
- [ ] Test fetch data không tạo file
- [ ] Test filter theo ngày
- [ ] Test export Excel 3 metrics

---

**Cập nhật**: 2026-05-24 16:40  
**Tác giả**: Kiro CLI Agent
