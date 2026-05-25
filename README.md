# Mekong WebGIS Project

Hệ thống WebGIS hiển thị dữ liệu khí tượng thủy văn vùng Đồng bằng sông Cửu Long.

## Cấu trúc dự án

```
Mekong/
├── frontend/          # Next.js 15 + React 19 + OpenLayers
├── datacenter/        # Data pipeline scripts (Node.js)
└── data/              # Output data (gitignored)
```

## Frontend

**Tech stack:**
- Next.js 15 (App Router)
- React 19
- OpenLayers 10 (WebGIS)
- TypeScript

**Chạy dev:**
```bash
cd frontend
npm install
npm run dev  # Port 3004
```

## Datacenter

Scripts fetch dữ liệu từ Mekong API và Ecowitt API, lưu vào MySQL.

**Setup:**
```bash
cd datacenter
npm install
cp ../.env.example ../.env  # Cấu hình credentials
```

**Chạy:**
```bash
# Fetch Mekong data
node mekong/fetch-mekong-data.mjs

# Fetch Ecowitt data
node ecowitt/fetch-ecowitt-data.mjs

# Tự động fetch Mekong theo lịch 00:00, 05:00, 10:00, 15:00, 20:00
npm run fetch:mekong:schedule
```

Script scheduler này dùng lại luồng lưu MySQL hiện có, nên không đổi cấu trúc bảng hay format dữ liệu.

## Environment Variables

Copy `.env.example` thành `.env` và điền credentials:

```bash
cp .env.example .env
```

## Data Sources

1. **Mekong API** - Dữ liệu thủy văn từ Rynan Mobile
2. **Ecowitt API** - Dữ liệu khí tượng từ trạm Ecowitt

## License

Private project - EVA Team
# mekongSL
