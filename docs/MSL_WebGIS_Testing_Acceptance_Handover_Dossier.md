# WebGIS Testing, Acceptance and Handover Dossier

**Ten de xuat:** Ho so kiem thu, nghiem thu va ban giao WebGIS Mekong Salt Lab  
**Ten tieng Anh:** WebGIS Testing, Acceptance and Handover Dossier  
**File Excel:** `MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx`  
**Phien ban:** 1.0 | **Cap nhat:** 25/07/2026

---

## Gioi thieu

Tai lieu nay mo ta chi tiet noi dung cua file Excel ho so kiem thu, nghiem thu va ban giao he thong MekongSaltLab. File Excel gom **7 sheet** voi day du thong tin ve kiem thu chuc nang, kiem tra truy cap cong khai, kiem tra thiet bi, danh sach loi da sua, noi dung con ton tai, danh muc tai lieu ban giao va bien ban nghiem thu.

---

## Sheet 1 – Test Cases (Danh sach chuc nang kiem thu)

**38 test cases** kiem thu toan bo he thong, duoc chia thanh cac module:

| Module | So luong test | Ket qua |
|--------|:-------------:|:-------:|
| WebGIS Map | 3 | Tat ca Pass |
| Data Layers | 3 | Tat ca Pass |
| Timeline | 2 | Tat ca Pass |
| Inspector | 3 | Tat ca Pass |
| Auth | 4 | Tat ca Pass |
| S3 Storage | 4 | Tat ca Pass |
| GIS Admin | 2 | Tat ca Pass |
| Stations | 2 | Tat ca Pass |
| Water Quality | 2 | Tat ca Pass |
| Data Fetch | 2 | Tat ca Pass |
| Export | 1 | Tat ca Pass |
| Landuse | 2 | Tat ca Pass |
| Articles | 3 | Tat ca Pass |
| User Management | 3 | Tat ca Pass |
| Backup | 2 | Tat ca Pass |

### Cac test case tieu bieu

| ID | Chuc nang | Mo ta |
|:--:|-----------|-------|
| TC-MAP-01 | Map Display | Hien thi ban do khi truy cap trang chu |
| TC-MAP-02 | Zoom In/Out | Phong to/thu nho ban do |
| TC-MAP-03 | Base Layer Switch | Chuyen doi 8 nen ban do |
| TC-LAYER-01 | Select Layer | Chon va hien thi lop du lieu |
| TC-LAYER-03 | Multiple Layers | Chon nhieu lop cung luc |
| TC-TIME-01 | Time Slider | Keo thanh truot thoi gian |
| TC-TIME-02 | Time-Lapse | Phat tu dong Time-Lapse |
| TC-INSP-01 | Click to Inspect | Xem thong tin doi tuong |
| TC-INSP-02 | Weather Popup | Xem popup tram thoi tiet |
| TC-AUTH-01 | Login | Dang nhap voi tai khoan hop le |
| TC-AUTH-02 | Login Invalid | Dang nhap voi mat khau sai |
| TC-S3-01 | Upload File | Upload file len S3 |
| TC-WQ-01 | Preview Excel | Xem truoc du lieu chat luong nuoc |
| TC-FETCH-01 | Ecowitt Fetch | Kich hoat fetch du lieu Ecowitt |
| TC-EXP-01 | Export Excel | Xuat du lieu ra Excel |
| TC-BACKUP-01 | Trigger Backup | Kich hoat backup thu cong |

---

## Sheet 2 – Public Access Check (Kiem tra truy cap cong khai)

**13 kiem tra** truy cap cong khai khong can dang nhap:

| STT | Tinh nang | Ket qua |
|:---:|-----------|:-------:|
| 1 | Trang chu | Pass |
| 2 | Ban do WebGIS | Pass |
| 3 | Sidebar Data Sets | Pass |
| 4 | Chon layer + Apply | Pass |
| 5 | Timeline | Pass |
| 6 | Inspector (click ban do) | Pass |
| 7 | Trang News | Pass |
| 8 | Chi tiet bai viet | Pass |
| 9 | Download du lieu | Pass |
| 10 | Swagger API | Pass |
| 11 | Dashboard /data (chua dang nhap) | Pass (redirect) |
| 12 | Truy cap tu dien thoai | Pass |
| 13 | Truy cap tu may tinh bang | Pass |

---

## Sheet 3 – Device Compatibility (Kiem tra thiet bi)

Kiem tren **9 to hop** thiet bi/trinh duyet:

| Thiet bi | Trinh duyet | Phan giai | Ket qua |
|----------|-------------|:---------:|:-------:|
| Desktop | Chrome 120+ | 1920x1080 | Pass |
| Desktop | Firefox 120+ | 1920x1080 | Pass |
| Desktop | Edge 120+ | 1920x1080 | Pass |
| Laptop | Chrome | 1366x768 | Pass |
| Tablet | Chrome | 1024x768 | Pass |
| Tablet | Safari (iPad) | 1024x768 | Pass |
| Mobile | Chrome (iPhone 14) | 390x844 | Pass |
| Mobile | Safari (iPhone) | 390x844 | Pass |
| Mobile | Chrome (Android) | 412x915 | Pass |

---

## Sheet 4 – Fixed Bugs (Danh sach loi da sua)

**10 loi** da duoc phat hien va khac phuc:

| Bug ID | Module | Loi | Giai phap | Ngay sua |
|:------:|--------|-----|-----------|:--------:|
| BUG-001 | S3/Images | 403 khi tai anh station | Mo public prefix | 16/06/2026 |
| BUG-002 | Hydrology | Thieu Tidal trong danh sach | Them pagination loop | 19/06/2026 |
| BUG-003 | GeoTIFF | File cham | Chuyen sang COG | 20/06/2026 |
| BUG-004 | Map Rendering | Polygon lon che nho | Sap xep theo dien tich | 22/06/2026 |
| BUG-005 | React | Maximum update depth | Dung ref | 25/06/2026 |
| BUG-006 | Mobile | Khong inspect vector | Goi inspectAtPixel ca 2 | 27/06/2026 |
| BUG-007 | Water Quality | Loi dinh dang ngay import | Cap nhat mau | 02/07/2026 |
| BUG-008 | Ecowitt | Cron job khong chay | Them auto-start | 05/07/2026 |
| BUG-009 | Landuse | Sai dien tich | Hieu chinh UTM 48N | 11/07/2026 |
| BUG-010 | CORS | Loi khi doi IP | Cap nhat whitelist | 15/07/2026 |

---

## Sheet 5 – Remaining Issues (Noi dung con ton tai)

**8 van de** con ton tai va ke hoach xu ly:

| Van de | Module | Do uu tien | Thoi gian |
|--------|--------|:----------:|:---------:|
| Composite RGB chua upload | Landsat | Trung binh | Thang 8/2026 |
| Chua co HTTPS | System | Cao | Thang 9/2026 |
| Thieu noi suy man | Hydrology | Cao | Thang 9/2026 |
| Tram nuoc ngam han che | Stations | Trung binh | Thang 10/2026 |
| Mo hinh ngap chua hieu chinh | Flooding | Cao | Thang 12/2026 |
| Thieu giao dien cau hinh popup | Admin | Thap | 2027 |
| Thieu giao dien cau hinh legend | Admin | Thap | 2027 |
| Khong co chuc nang Move S3 | Storage | Thap | 2027 |

---

## Sheet 6 – Handover Documents (Danh muc tai lieu ban giao)

**20 tai lieu** ban giao:

| STT | Ten tai lieu | Dinh dang | Trang thai |
|:---:|-------------|:---------:|:----------:|
| 1 | README.md | Markdown | Hoan thanh |
| 2 | DEPLOY.md | Markdown | Hoan thanh |
| 3 | Project Report (Hoang) | Markdown | Hoan thanh |
| 4 | Project Report (Duy) | Markdown | Hoan thanh |
| 5 | User Guide (All Roles) | Markdown | Hoan thanh |
| 6 | User Guide (USER) | Markdown | Hoan thanh |
| 7 | User Guide (DATA_MANAGER) | Markdown | Hoan thanh |
| 8 | User Guide (ADMIN) | Markdown | Hoan thanh |
| 9 | User & Admin Manual (Combined) | Markdown | Hoan thanh |
| 10 | Data Catalogue & Metadata | Excel | Hoan thanh |
| 11 | Testing & Handover Dossier | Excel | Hoan thanh |
| 12 | API Auth Docs | Markdown | Hoan thanh |
| 13 | Roles Documentation | Markdown | Hoan thanh |
| 14 | S3 Storage Guide | Markdown | Hoan thanh |
| 15 | Security Report | Markdown | Hoan thanh |
| 16 | Backup Strategy | Markdown | Hoan thanh |
| 17 | Data Upload Guide | Markdown | Hoan thanh |
| 18 | Deployment Guide | Markdown | Hoan thanh |
| 19 | Source Code | Git | Hoan thanh |
| 20 | Database Dump | SQL.GZ | Tu dong hang ngay |

---

## Sheet 7 – Acceptance Minutes (Bien ban nghiem thu)

Bien ban nghiem thu va ban giao bao gom:

### Thong tin chung

| Muc | Noi dung |
|-----|----------|
| Ten du an | MekongSaltLab – He thong ban do so giam sat moi truong Dong bang song Cuu Long |
| Don vi phat trien | Nguyen Van Hoang & Nguyen Le Duy |
| Ngay ban giao | ____/____/2026 |
| Dia diem | Tra Vinh |

### Cac ben tham gia

**Ben nhan ban giao:**
- Ho ten: ..............................................
- Chuc vu: ..............................................
- Don vi: ..............................................
- Chu ky: ..............................................

**Ben ban giao:**
- Ho ten: ..............................................
- Chuc vu: ..............................................
- Don vi: ..............................................
- Chu ky: ..............................................

### San pham ban giao

- [ ] Deliverable 1: Final Project and Data Analysis Report
- [ ] Deliverable 2: WebGIS User and Administration Manual
- [ ] Deliverable 3: Dataset Catalogue, Data Dictionary and Metadata Workbook
- [ ] Deliverable 4: WebGIS Testing, Acceptance and Handover Dossier
- [ ] Deliverable 5: Digital Technical Handover Package
- [ ] WebGIS Portal (https://mekongsaltlab.org)

### Noi dung ban giao

1. Toan bo source code (Frontend + Backend)
2. Database schema and data
3. GIS data files (1,126 files, 765 MB)
4. System configuration and credentials
5. Admin and user accounts
6. All documentation (guides, reports, manuals)
7. S3 storage access
8. Domain and server access information

---

## Thong tin file

- **Dinh dang:** Microsoft Excel (.xlsx)
- **So sheet:** 7
- **Dung luong:** ~75 KB
- **Muc dich:** Ho so kiem thu, nghiem thu va ban giao he thong

---

*Ban quyen 2026 MekongSaltLab. Ho so kiem thu, nghiem thu va ban giao WebGIS – Phien ban 1.0.*  
*Tai lieu do Hoang va Duy lap ban thao.*
