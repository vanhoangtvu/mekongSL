#!/usr/bin/env python3
"""Generate S3 Structure Research & Proposal Report (PDF)"""

from fpdf import FPDF
import datetime

REPORT_DATE = datetime.datetime.now().strftime("%d/%m/%Y")

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_ITALIC = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"
FONT_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


class ReportPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("DejaVu", "", FONT_REGULAR)
        self.add_font("DejaVu", "B", FONT_BOLD)
        self.add_font("DejaVu", "I", FONT_ITALIC)
        self.add_font("DejaVuMono", "", FONT_MONO)

    def header(self):
        if self.page_no() > 1:
            self.set_font("DejaVu", "I", 8)
            self.set_text_color(120, 120, 120)
            self.cell(0, 8, "Mekong Salt Lab - Báo cáo cấu trúc S3", align="C")
            self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Trang {self.page_no()}/{{nb}}", align="C")

    def chapter_title(self, title):
        self.set_font("DejaVu", "B", 14)
        self.set_text_color(37, 99, 168)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(37, 99, 168)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def section_title(self, title):
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(55, 65, 81)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text):
        self.set_font("DejaVu", "", 10)
        self.set_text_color(31, 41, 55)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text):
        self.set_font("DejaVu", "", 10)
        self.set_text_color(31, 41, 55)
        x = self.get_x()
        self.multi_cell(0, 5.5, "  \u2022  " + text)
        self.set_x(x)

    def code_block(self, text):
        self.set_font("DejaVuMono", "", 8)
        self.set_text_color(31, 41, 55)
        self.set_fill_color(243, 244, 246)
        self.set_draw_color(209, 213, 219)
        self.multi_cell(0, 4.5, text, fill=True)
        self.set_font("DejaVu", "", 10)
        self.ln(2)

    def add_table(self, headers, rows, col_widths=None):
        self.set_font("DejaVu", "B", 9)
        self.set_fill_color(37, 99, 168)
        self.set_text_color(255, 255, 255)
        if col_widths:
            w = col_widths
        else:
            w = [self.w / len(headers)] * len(headers)
        for i, h in enumerate(headers):
            self.cell(w[i], 7, h, border=1, align="C", fill=True)
        self.ln()
        self.set_font("DejaVu", "", 9)
        self.set_text_color(31, 41, 55)
        fill = False
        for row in rows:
            if fill:
                self.set_fill_color(249, 250, 251)
            else:
                self.set_fill_color(255, 255, 255)
            for i, cell in enumerate(row):
                self.cell(w[i], 6, str(cell), border=1, align="C" if i > 0 else "L", fill=True)
            self.ln()
            fill = not fill
        self.ln(3)


def build_report():
    pdf = ReportPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── Cover / Title ──
    pdf.ln(30)
    pdf.set_font("DejaVu", "B", 22)
    pdf.set_text_color(37, 99, 168)
    pdf.cell(0, 14, "MEKONG SALT LAB", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 14)
    pdf.set_text_color(75, 85, 99)
    pdf.cell(0, 8, "Báo cáo phân tích cấu trúc S3 và đề xuất tối ưu", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("DejaVu", "I", 10)
    pdf.cell(0, 7, f"Ngày: {REPORT_DATE}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, "Phiên bản: 1.0", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)

    # ── 1. Tổng quan ──
    pdf.chapter_title("1. Tổng quan hệ thống")
    pdf.body_text(
        "Mekong Salt Lab là nền tảng WebGIS giám sát thủy văn - môi trường cho Đồng bằng sông Cửu Long. "
        "Hệ thống thu thập dữ liệu độ mặn (salinity), pH, mực nước (water level), kiềm tính (alkalinity) "
        "từ các trạm cảm biến tại Trà Vinh, Bến Tre, Vĩnh Long."
    )
    pdf.body_text(
        "Kiến trúc gồm 3 tầng: Frontend (Next.js 15 + React 19 + OpenLayers 10), "
        "Backend (Spring Boot 4.0.6 + Java 17), và Datacenter (Node.js ESM). "
        "Dữ liệu lưu trữ trên MySQL local (mekong) và S3-compatible storage (backup.hci.vn)."
    )

    # ── 2. Cấu trúc S3 hiện tại ──
    pdf.chapter_title("2. Cấu trúc S3 hiện tại")
    pdf.body_text("Thông tin kết nối S3 hiện tại:")
    pdf.add_table(
        ["Thông số", "Giá trị"],
        [
            ["Endpoint", "https://backup.hci.vn"],
            ["Bucket", "c01-mekong-prod-01"],
            ["Quota", "1 TiB"],
            ["Versioning", "Mode Compliance 7 ngày"],
        ],
        [50, 120],
    )

    pdf.section_title("2.1 Các prefix key đang sử dụng")
    pdf.add_table(
        ["Prefix", "Mục đích", "Khởi tạo bởi"],
        [
            ["uploads/{ts}_{file}", "Upload chung (deprecated)", "S3Controller"],
            ["layers/{id}/{path}/{cat}/{file}", "File GIS layer", "LayerObjectService"],
            ["backups/mysql/{ts}_mekong.sql.gz", "Backup MySQL", "BackupService"],
            ["backups/mysql/manual_{ts}_mekong.sql.gz", "Backup thủ công", "BackupService (manual)"],
            ["raster/salinity/salinity_313_900.tif", "Raster GeoTIFF", "Hardcode frontend"],
        ],
        [55, 55, 60],
    )

    pdf.section_title("2.2 Luồng load ảnh raster lên bản đồ HIỆN TẠI")
    pdf.body_text("Luồng xử lý hiện tại khi hiển thị ảnh raster trên bản đồ:")
    pdf.code_block(
        "Frontend /api/layers (route.ts)\n"
        "  -> đọc hardcode từ raster-layers.ts\n"
        "  -> previewUrl = '/salinity_313_900.tif' (file local trong public/)\n"
        "  -> OpenLayers GeoTIFF source load trực tiếp từ browser\n"
        "  -> WebGLTileLayer render với style color ramp\n"
        "\n"
        "Có cloudPath = 'raster/salinity/salinity_313_900.tif'\n"
        "nhưng KHÔNG được dùng - dữ liệu lấy từ file local."
    )

    pdf.section_title("2.3 Các vấn đề tồn tại")
    pdf.bullet("Raster layers khai báo CỨNG trong frontend, không sync với backend GIS")
    pdf.bullet("File GeoTIFF để trong thư mục public/, không tận dụng S3")
    pdf.bullet("Không có COG - load nguyên file GeoTIFF qua browser, rất chậm với file lớn")
    pdf.bullet("Không có tile server - OpenLayers phải tự parse GeoTIFF, không có caching")
    pdf.bullet("S3 key 'raster/' không khớp với pattern 'layers/{id}/...' của backend GIS")
    pdf.bullet("Thiếu pipeline tự động xử lý import: user phải upload thủ công")
    pdf.bullet("Thiếu endpoint Backend trả về danh sách layer động để frontend sử dụng")
    pdf.ln(2)

    # ── 3. Các thực thể GIS và quan hệ S3 ──
    pdf.chapter_title("3. Các thực thể GIS liên quan đến S3")
    pdf.add_table(
        ["Entity", "Table", "Vai trò"],
        [
            ["Dataset", "dataset", "Tập dữ liệu cấp cao, chứa nhiều Layer"],
            ["Layer", "layer", "Lớp dữ liệu không gian (Raster, Vector, COG...)"],
            ["LayerObject", "layer_object", "Mapping Layer <-> S3Object (role: DATA, TILES...)"],
            ["S3Object", "s3_object", "Metadata file trên S3 (bucket, key, size...)"],
            ["LayerFolder", "layer_folder", "Phân cấp thư mục trong Layer"],
            ["Tag/TagLink", "tag / tag_link", "Gắn thẻ cho Layer/Dataset"],
        ],
        [30, 35, 105],
    )
    pdf.body_text("Các enum quan trọng:")
    pdf.add_table(
        ["Enum", "Giá trị"],
        [
            ["LayerType", "RASTER, VECTOR, TILES, COG, WMS"],
            ["DataClassType", "RAW, PROCESSED, COG, TILES, VECTOR"],
            ["ObjectRole", "DATA, OVERVIEW, METADATA, TILES"],
            ["LayerStatus", "ACTIVE, ARCHIVED, FAILED"],
        ],
        [40, 130],
    )

    # ── 4. Đề xuất cấu trúc S3 tối ưu ──
    pdf.chapter_title("4. Đề xuất cấu trúc S3 tối ưu")
    pdf.section_title("4.1 Cấu trúc S3 đề xuất")

    pdf.code_block(
        "raster/\n"
        "  cog/                              # Cloud Optimized GeoTIFF\n"
        "    {layerId}/\n"
        "      {YYYYMMDD}_{HHMMSS}.tif\n"
        "      {YYYYMMDD}_{HHMMSS}_stats.json\n"
        "  tiles/                            # Tile cache\n"
        "    {layerId}/\n"
        "      {z}/{x}/{y}.png\n"
        "      metadata.json\n"
        "  style/\n"
        "    {layerId}.json                  # Color ramp, opacity, band\n"
        "  thumbnail/\n"
        "    {layerId}.png\n"
        "\n"
        "layers/\n"
        "  {datasetId}/\n"
        "    {layerId}/\n"
        "      raw/                          # RAW data (original)\n"
        "      processed/                    # PROCESSED (calibrated)\n"
        "      cog/                          # COG (production)\n"
        "      tiles/                        # Generated tiles\n"
        "\n"
        "imports/                            # File pending xử lý\n"
        "  {timestamp}_{filename}\n"
        "\n"
        "backups/\n"
        "  mysql/{timestamp}_mekong.sql.gz\n"
        "  raster/{layerId}/{timestamp}.tif\n"
        "\n"
        "exports/\n"
        "  monthly/{YYYYMM}_salinity.xlsx\n"
        "  monthly/{YYYYMM}_weather.xlsx"
    )

    pdf.section_title("4.2 Quy tắc đặt tên file")
    pdf.add_table(
        ["Trường", "Quy tắc"],
        [
            ["Key pattern", "raster/cog/{layerId}/{YYYYMMDD}_{HHMMSS}.tif"],
            ["Timestamp", "Theo giờ UTC+7 (Vietnamese timezone)"],
            ["LayerId", "ID từ backend GIS"],
            ["File suffix", "_cog.tif (COG), _raw.tif (RAW), _proc.tif (processed)"],
            ["Metadata", "Cùng tên + _stats.json / _meta.json"],
        ],
        [30, 140],
    )

    # ── 5. Kiến trúc Import tối ưu ──
    pdf.chapter_title("5. Kiến trúc Import dữ liệu tối ưu")
    pdf.section_title("5.1 Luồng import file raster")

    pdf.code_block(
        "[User upload GeoTIFF]\n"
        "    |\n"
        "    v\n"
        "[1] Backend nhận file -> Upload raw -> S3: layers/{id}/raw/{file}\n"
        "    |\n"
        "    v\n"
        "[2] Backend -> DB: s3_object + layer_object (role=DATA, type=RAW)\n"
        "    |\n"
        "    v\n"
        "[3] Pipeline xử lý:\n"
        "    a. GDAL convert RAW -> COG:\n"
        "       gdal_translate -of COG -co COMPRESS=DEFLATE -co BLOCKSIZE=512 \\\n"
        "         input.tif output_cog.tif\n"
        "       Upload COG -> S3: raster/cog/{layerId}/{ts}.tif\n"
        "\n"
        "    b. (Optional) Generate tiles:\n"
        "       gdal2tiles.py --xyz --zoom=8-18 output_cog.tif tiles/\n"
        "       Upload -> S3: raster/tiles/{layerId}/{z}/{x}/{y}.png\n"
        "\n"
        "    c. Tính thống kê raster:\n"
        "       gdalinfo -stats -json output_cog.tif > stats.json\n"
        "\n"
        "[4] Hoàn tất -> Layer status = ACTIVE, sẵn sàng render"
    )

    pdf.section_title("5.2 Xử lý lỗi nhập liệu")
    pdf.bullet("File lỗi (invalid GeoTIFF, wrong CRS): chuyển vào S3: imports/failed/{ts}/")
    pdf.bullet("Lưu log xử lý vào DB để trace và dashboard hiển thị")
    pdf.bullet("Cho phép retry từ Dashboard admin")
    pdf.ln(3)

    # ── 6. Kiến trúc Render tối ưu ──
    pdf.chapter_title("6. Kiến trúc Render bản đồ tối ưu")
    pdf.section_title("6.1 Luồng render đề xuất")

    pdf.code_block(
        "Cách 1 - COG + OpenLayers GeoTIFF source (Khuyên dùng):\n"
        "=======================================================\n"
        "Frontend:\n"
        "  GET /api/gis/layers?layerType=RASTER&status=ACTIVE&dataClass=COG\n"
        "     -> Danh sách layer động (từ DB, không hardcode)\n"
        "  GET /api/gis/layers/{id}/render?expires=86400\n"
        "     -> Signed URL tới COG trên S3 (24h)\n"
        "  OpenLayers:\n"
        "     new GeoTIFF({ sources: [{ url: signedUrl }] })\n"
        "     -> Tự động request tile theo viewport\n"
        "\n"
        "Cách 2 - Tile Server (TiTiler / GeoServer):\n"
        "===========================================\n"
        "Triển khai TiTiler:\n"
        "  GET /cog/{layerId}/tiles/{z}/{x}/{y}.png?url=s3://...\n"
        "Frontend:\n"
        "  new XYZ({ url: '/cog/{layerId}/tiles/{z}/{x}/{y}.png' })\n"
        "\n"
        "Cách 3 - Hiện tại + S3 signed URL:\n"
        "===========================================\n"
        "Giữ nguyên GeoTIFF local, thêm fallback S3\n"
        "Chuyển dần từ local -> S3"
    )

    pdf.section_title("6.2 Cache strategy")
    pdf.add_table(
        ["Tầng", "Cache", "Thời gian", "Ghi chú"],
        [
            ["Browser", "COG tiles (HTTP cache)", "7 ngày", "Cache-Control: public, max-age=604800"],
            ["CDN", "Tile png", "30 ngày", "Nếu dùng tile server"],
            ["S3", "COG gốc", "Vĩnh viễn", "Nguồn duy nhất, không xoá"],
            ["S3 signed URL", "Pre-signed URL", "24h", "Hết hạn phải request lại"],
        ],
        [25, 40, 30, 75],
    )

    # ── 7. Lịch trình thực hiện ──
    pdf.chapter_title("7. Lịch trình thực hiện đề xuất")
    pdf.add_table(
        ["#", "Công việc", "Mức ưu tiên", "Phụ thuộc"],
        [
            ["1", "Sync danh sách layer từ backend -> frontend", "Cao", ""],
            ["2", "Upload GeoTIFF lên S3 + signed URL render", "Cao", "#1"],
            ["3", "Convert RAW -> COG (GDAL pipeline)", "Cao", "#2"],
            ["4", "Cache tile trên CDN", "Trung bình", "#3"],
            ["5", "Triển khai TiTiler / tile server", "Thấp", "#3"],
            ["6", "Import hàng loạt (batch import)", "Trung bình", "#1"],
            ["7", "Dashboard hiển thị trạng thái import", "Trung bình", "#6"],
            ["8", "Export báo cáo định kỳ", "Thấp", ""],
        ],
        [8, 85, 30, 47],
    )

    pdf.section_title("7.1 Mô tả chi tiết công việc ưu tiên")

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(0, 6, "Công việc 1: Sync danh sách layer từ backend -> frontend", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 10)
    pdf.body_text(
        "Hiện tại frontend sử dụng danh sách hardcode trong raster-layers.ts. "
        "Cần chuyển sang gọi API /api/gis/layers?layerType=RASTER&status=ACTIVE từ backend Spring Boot. "
        "Backend trả về danh sách layer động từ DB, bao gồm thông tin bbox, toạ độ, signed URL, style..."
    )
    pdf.code_block(
        "Frontend (map-stage.tsx):\n"
        "  GET /api/gis/layers?layerType=RASTER&status=ACTIVE&dataClass=COG\n"
        "  -> Hiển thị list động thay vì hardcode\n"
        "  -> Khi có layer mới, tự động xuất hiện trên map"
    )

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(0, 6, "Công việc 2: Upload GeoTIFF lên S3 + signed URL render", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 10)
    pdf.body_text(
        "Backend đã có end-to-end support cho upload và render: LayerObjectService upload "
        "file lên S3, tạo DB record, và LayerController render endpoint trả về signed URL. "
        "Frontend cần gọi render endpoint thay vì dùng file local."
    )
    pdf.code_block(
        "Frontend (map-stage.tsx):\n"
        "  const renderRes = await fetch(`/api/gis/layers/${id}/render?expires=86400`)\n"
        "  const { signedUrl } = await renderRes.json()\n"
        "  new GeoTIFF({ sources: [{ url: signedUrl }] })"
    )

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(0, 6, "Công việc 3: Convert RAW -> COG (GDAL pipeline)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 10)
    pdf.body_text(
        "Cloud Optimized GeoTIFF (COG) cho phép OpenLayers chỉ tải về phần hình ảnh "
        "cần hiển thị thay vì toàn bộ file. GDAL từ bản 3.1+ hỗ trợ COG native."
    )
    pdf.code_block(
        "Backend Service (Java ProcessBuilder):\n"
        "  // Convert to COG\n"
        "  gdal_translate -of COG -co COMPRESS=DEFLATE -co BLOCKSIZE=512 \\\n"
        "    input.tif output_cog.tif\n"
        "\n"
        "  // Generate tiles (optional)\n"
        "  gdal2tiles.py --xyz --zoom=8-18 output_cog.tif tiles/\n"
        "\n"
        "  // Get statistics\n"
        "  gdalinfo -stats -json output_cog.tif"
    )

    # ── 8. Bảo mật ──
    pdf.chapter_title("8. Các lưu ý bảo mật")
    pdf.bullet("Signed URL có thời hạn (default 300s, configurable) để tránh leak dữ liệu")
    pdf.bullet("Object locking S3: Mode Compliance 7 ngày - không thể xoá file trong 7 ngày")
    pdf.bullet("Phân quyền: ADMIN/DATA_MANAGER mới upload/delete; USER chỉ xem được signed URL")
    pdf.bullet("Không log S3 access key, secret key ra console")
    pdf.bullet("Sử dụng environment variables cho S3 credentials (đã config sẵn trong application.yaml)")
    pdf.bullet("CORS restrict trên S3 endpoint để chỉ cho phép domain của hệ thống")
    pdf.ln(4)

    # ── 9. Kết luận ──
    pdf.chapter_title("9. Kết luận")
    pdf.body_text(
        "Hệ thống Mekong Salt Lab đã có sẵn nền tảng kỹ thuật tốt để quản lý và hiển thị dữ liệu "
        "raster trên bản đồ. Tuy nhiên, frontend hiện tại đang sử dụng hardcode và file local, "
        "chưa tận dụng các khả năng sẵn có của backend GIS và S3 storage."
    )
    pdf.body_text(
        "Việc triển khai các cải tiến đề xuất (đồng bộ layer, signed URL, COG pipeline) sẽ mang lại "
        "lợi ích rõ rệt: tốc độ load bản đồ nhanh hơn, hiệu năng cao hơn, và khả năng mở rộng tốt hơn "
        "khi số lượng raster tăng lên. Chỉ cần thực hiện 3 công việc ưu tiên cao (công việc 1-2-3) "
 "là đã đủ để đạt được cải thiện đáng kể."
    )
    pdf.body_text(
        "Đặc biệt, việc chuyển đổi sang COG là bước quan trọng nhất, giảm thời gian load ảnh "
        "từ phút xuống giây, đồng thời giảm tải cho S3 và băng thông."
    )

    return pdf


if __name__ == "__main__":
    out_path = "/home/hv/DuAn/Mekong/BaoCao_CauTrucS3_DeXuat.pdf"
    pdf = build_report()
    pdf.output(out_path)
    print(f"OK: {out_path} ({pdf.pages_count} trang)")
