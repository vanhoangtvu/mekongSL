# 📚 LOGIC LẤY DỮ LIỆU - DATACENTER

Tài liệu này mô tả chi tiết luồng xử lý và logic lấy dữ liệu từ Mekong và Ecowitt API.

---

## 🌊 MEKONG API - LUỒNG XỬ LÝ

### Bước 1: Mã hóa mật khẩu
```javascript
// Lấy 3 ký tự từ username (vị trí 1-3)
const derivedKey = username.substring(1, 4); // "Tvunet" → "vun"

// Mã hóa password bằng AES với key vừa tạo
const encryptedPassword = CryptoJS.AES.encrypt(password, derivedKey).toString();
```

**Ví dụ:**
- Username: `Tvunet`
- Password: `123456`
- Key: `vun` (ký tự 1-3 của "Tvunet")
- Encrypted: `U2FsdGVkX1+...` (chuỗi AES)

### Bước 2: Tạo payload đăng nhập
```javascript
const payload = {
  Timezone: '7',
  Username: 'Tvunet',
  Password: 'U2FsdGVkX1+...', // Đã mã hóa
  AppCode: 'MEKONG',
  deviceuuid: '2FB96A47-B821-4260-809F-FA2A58CDEEE2',
  DeviceInfo: '{"DeviceID":"...","OS":"iOS",...}'
};
```

### Bước 3: POST đến API Login
```
POST https://mktokenv2.rynanmobile.com/api/LoginCustomer
Content-Type: application/x-www-form-urlencoded

Timezone=7&Username=Tvunet&Password=U2FsdGVkX1%2B...&AppCode=MEKONG&...
```

### Bước 4: Trích xuất Token từ Response
```javascript
// Response có thể là:
// 1. String JWT trực tiếp: "eyJ..."
// 2. Object: { "token": "eyJ..." }
// 3. Nested object: { "data": { "token": "eyJ..." } }

// Script tự động tìm token bằng:
// - Regex JWT: /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/
// - Tìm key có tên "token" (case-insensitive)
// - Tìm đệ quy trong nested object/array
```

### Bước 5: GET dữ liệu từ API
```
GET https://mktokenv2.rynanmobile.com/api/Mekong/GetNewIndexDeviceInProvince?token=eyJ...&Timezone=7&CustomerCode=MK38582&ProvinceCode=86
```

### Bước 6: Xử lý Response
```json
{
  "success": true,
  "CheckTime": "2026-05-24 13:00:00",
  "data": [
    {
      "_id": "abc123",
      "SensorNodeCode": "TV001",
      "Longitude": 105.123,
      "Latitude": 10.456,
      "ProvinceName": "Trà Vinh",
      "ProvinceCode": "86",
      "Salinity": 2.5,
      "PH": 7.2,
      "WaterLevel": 1.8,
      "Alkalinity": 120
    }
  ]
}
```

---

## 🌤️ ECOWITT API - LUỒNG XỬ LÝ

### Bước 1: Bootstrap Cookie (nếu cần)
```javascript
// Gọi homepage để lấy session cookie ban đầu
const response = await fetch('https://www.ecowitt.net/');
const cookies = response.headers.getSetCookie();
// Lưu cookie: PHPSESSID=..., _csrf=...
```

### Bước 2: Login để lấy Session Cookie
```
POST https://www.ecowitt.net/user/site/login
Content-Type: application/x-www-form-urlencoded
X-Requested-With: XMLHttpRequest

account=lethuy2026n@gmail.com&password=200417a@&authorize=
```

**Response:**
```json
{
  "errcode": 0,
  "errmsg": "success",
  "data": { ... }
}
```

**Cookie nhận được:**
```
PHPSESSID=abc123; _csrf=xyz789; user_token=token123
```

### Bước 3: Tạo Payload với Sign
```javascript
const payload = {
  device_id: '281727',
  is_list: '0',
  mode: '0',
  sdate: '2026-05-12 00:00',
  edate: '2026-05-12 23:59',
  page: '1',
  sortList: '1|3|4|5|6',
  hideList: '',
  time: '1716345600' // Unix timestamp
};

// Tính sign:
// 1. Sắp xếp key theo alphabet
// 2. URL-encode value (thay %20 bằng +)
// 3. Nối chuỗi: key1=value1&key2=value2&...
// 4. Thêm suffix: @ecowittnet
// 5. MD5 hash và uppercase

const sortedParams = 'device_id=281727&edate=2026-05-12+23%3A59&hideList=&is_list=0&mode=0&page=1&sdate=2026-05-12+00%3A00&sortList=1%7C3%7C4%7C5%7C6&time=1716345600';
const sign = md5(sortedParams + '@ecowittnet').toUpperCase();
// sign = "A1B2C3D4E5F6..."

payload.sign = sign;
```

### Bước 4: POST đến API Get Data
```
POST https://www.ecowitt.net/index/get_data
Content-Type: application/x-www-form-urlencoded
Accept-EcowittLang: en
Web-Version: 1
Cookie: PHPSESSID=abc123; user_token=token123

device_id=281727&is_list=0&mode=0&sdate=2026-05-12+00%3A00&edate=2026-05-12+23%3A59&page=1&sortList=1%7C3%7C4%7C5%7C6&hideList=&time=1716345600&sign=A1B2C3D4E5F6...
```

### Bước 5: Xử lý Response
```json
{
  "errcode": 0,
  "errmsg": "success",
  "data": {
    "list": [
      {
        "time": "2026-05-12 00:00:00",
        "indoor_temp": 25.5,
        "outdoor_temp": 28.3,
        "humidity": 65,
        "wind_speed": 5.2,
        "rain": 0.0
      }
    ],
    "page_count": 1,
    "total": 144
  }
}
```

---

## 🔍 SO SÁNH HAI API

| Tiêu chí | Mekong | Ecowitt |
|----------|--------|---------|
| **Authentication** | AES encrypted password | Plain password + session cookie |
| **Token Type** | JWT | Session cookie |
| **Request Method** | POST login → GET data | POST login → POST data |
| **Sign/Hash** | Không cần | MD5 hash với suffix `@ecowittnet` |
| **Content-Type** | `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` |
| **Response Format** | JSON với `success` flag | JSON với `errcode` |
| **Error Handling** | HTTP status + body message | `errcode != 0` |

---

## 🛠️ XỬ LÝ LỖI THƯỜNG GẶP

### Mekong

**Lỗi: "Login failed (401)"**
- **Nguyên nhân**: Username/password sai hoặc mã hóa không đúng
- **Giải pháp**: Kiểm tra lại `HARD_CODED_CONFIG`, đảm bảo key mã hóa đúng (ký tự 1-3 của username)

**Lỗi: "Login response did not contain a token"**
- **Nguyên nhân**: API trả về format khác, không có token
- **Giải pháp**: Kiểm tra response body, có thể API đã thay đổi cấu trúc

**Lỗi: "Data request failed (403)"**
- **Nguyên nhân**: Token hết hạn hoặc không hợp lệ
- **Giải pháp**: Login lại để lấy token mới

### Ecowitt

**Lỗi: "Session timeout"**
- **Nguyên nhân**: Cookie hết hạn hoặc không hợp lệ
- **Giải pháp**: Login lại hoặc cung cấp cookie mới

**Lỗi: "errcode: 40001"**
- **Nguyên nhân**: Sign không đúng
- **Giải pháp**: Kiểm tra logic tính sign, đảm bảo:
  - Params đã sắp xếp đúng
  - URL-encode đúng format
  - Suffix `@ecowittnet` đã được thêm
  - MD5 hash và uppercase

**Lỗi: "errcode: 40002"**
- **Nguyên nhân**: Device ID không tồn tại hoặc không có quyền truy cập
- **Giải pháp**: Kiểm tra lại `device_id` trong payload

---

## 📊 ĐỊNH DẠNG DỮ LIỆU OUTPUT

### Mekong Output
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "success": true,
    "CheckTime": "2026-05-24 13:00:00",
    "data": [
      {
        "_id": "664f1234567890abcdef",
        "SensorNodeCode": "TV001",
        "Longitude": 105.123456,
        "Latitude": 10.456789,
        "ProvinceName": "Trà Vinh",
        "ProvinceCode": "86",
        "SNShortName": "Trạm TV001",
        "SNDescription": "Trạm quan trắc Trà Vinh 001",
        "Salinity": 2.5,
        "PH": 7.2,
        "WaterLevel": 1.8,
        "Alkalinity": 120
      }
    ]
  }
}
```

### Ecowitt Output
```json
{
  "login": {
    "cookie": "PHPSESSID=abc123; user_token=xyz789",
    "data": { "errcode": 0 }
  },
  "request": {
    "device_id": "281727",
    "sdate": "2026-05-12 00:00",
    "edate": "2026-05-12 23:59",
    "time": "1716345600",
    "sign": "A1B2C3D4E5F6..."
  },
  "data": {
    "errcode": 0,
    "data": {
      "list": [
        {
          "time": "2026-05-12 00:00:00",
          "indoor_temp": 25.5,
          "outdoor_temp": 28.3,
          "humidity": 65,
          "wind_speed": 5.2
        }
      ]
    }
  }
}
```

## 💾 LƯU CSV VÀ MYSQL

Sau mỗi lần chạy script:
- CSV sẽ được tạo tự động cạnh file JSON output, hoặc trong `Datacenter/output/` nếu không truyền `--output`.
- Dữ liệu được sync vào MySQL local database `mekong`.
- Bảng `mekong` lưu dữ liệu Mekong.
- Bảng `ecowitt` lưu dữ liệu Ecowitt đã làm phẳng theo time-series.

Kết nối MySQL mặc định:
- Host: `127.0.0.1`
- Port: `3306`
- User: `root`
- Password: `1111`
- Database: `mekong`

Có thể ghi đè bằng biến môi trường `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.

---

## 🔐 BẢO MẬT VÀ BEST PRACTICES

### Mekong
1. ✅ Mật khẩu được mã hóa AES trước khi gửi
2. ✅ Token JWT có thời hạn, tự động hết hạn
3. ⚠️ DeviceInfo cần giữ bí mật (chứa Device ID)
4. ⚠️ Không log token ra console trong production

### Ecowitt
1. ⚠️ Mật khẩu gửi dạng plaintext (qua HTTPS)
2. ✅ Session cookie tự động hết hạn
3. ✅ Sign mechanism ngăn chặn request giả mạo
4. ⚠️ Không chia sẻ cookie với bên thứ 3

---

**Cập nhật**: 2026-05-24  
**Tác giả**: Kiro CLI Agent
