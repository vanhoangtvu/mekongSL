# Import dữ liệu Mekong vào MySQL

File import đã được tạo ở [datacenter/imports/mekong-day18-import.sql](/home/hv/DuAn/Mekong/datacenter/imports/mekong-day18-import.sql).

Tệp này tạo database `mekong` nếu chưa có, tạo bảng `mekong_day18_locations`, rồi chèn toàn bộ bản ghi với đúng các trường bạn đưa:

- `_id`
- `SensorNodeCode`
- `Longitude`
- `Latitude`
- `ProvinceName`
- `ProvinceCode`
- `SNShortName`
- `SNDescription`
- `SNShortNameEN`
- `SNDescriptionEN`
- `SerialNumber`
- `NameLine_1`
- `NameLine_2`
- `Salinity`
- `PH`
- `WaterLevel`
- `Alkalinity`

Chạy trực tiếp bằng:

```bash
mysql -u root -p < datacenter/imports/mekong-day18-import.sql
```
1. User thường
   - Username: user
   - Password: user123
   - Role: USER
   - Email: user@mekong.com

2. Người quản lý dữ liệu
   - Username: manager
   - Password: manager123
   - Role: DATA_MANAGER
   - Email: manager@mekong.com