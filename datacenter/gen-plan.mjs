#!/usr/bin/env node
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const FN = '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf';
const FB = '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf';

const doc = new PDFDocument({ size:'A4', margins:{top:44,bottom:70,left:44,right:44} });
doc.registerFont('R',FN); doc.registerFont('B',FB);

const out = path.resolve('Mekong_DataCenter_Plan.pdf');
const ws = fs.createWriteStream(out);
doc.pipe(ws);

let y = 44;
const ML = 44, PW = 507;

function np() { doc.addPage(); y = 44; }

function h1(t) {
  np();
  doc.fillColor('#0d47a1').fontSize(34).font('B');
  let th = doc.heightOfString(t, { width: PW, lineGap: 8 });
  doc.text(t, ML, y, { width: PW, lineGap: 8 });
  let ly = y + th + 10;
  doc.moveTo(ML, ly).lineTo(ML+PW, ly).strokeColor('#0d47a1').stroke();
  y = ly + 22;
}
function h2(t) {
  doc.fillColor('#0d47a1').fontSize(24).font('B').text(t, ML, y);
  y += 42;
}
function p(t) {
  doc.fontSize(20).font('R').fillColor('#444').text(t, ML, y, { lineGap: 10, align: 'justify' });
  y += 48;
}
function gap(n) { y += (n||12); }

function tblHdr(headers, widths) {
  const tw = widths.reduce((a,b)=>a+b,0);
  doc.rect(ML, y, tw, 32).fill('#0d47a1');
  let cx = ML;
  doc.fillColor('#fff').fontSize(15).font('B');
  headers.forEach((h,i)=>{ doc.text(h, cx+5, y+8, {width:widths[i]-8}); cx+=widths[i]; });
  y += 32;
}

function tblRow(cells, widths, bg, rh) {
  const tw = widths.reduce((a,b)=>a+b,0);
  doc.rect(ML, y, tw, rh).fill(bg||'#fafafa');
  let cx = ML;
  doc.fillColor('#333').fontSize(15).font('R');
  cells.forEach((c,i)=>{ doc.text(c, cx+6, y+5, {width:widths[i]-10, lineGap:4}); cx+=widths[i]; });
  y += rh;
}

function renderTbl(title, items, headers, widths, rh) {
  const est = (title ? 34 : 0) + 32 + items.length * rh;
  if (y + est > 710) np();
  if (title) h2(title);
  tblHdr(headers, widths);
  for (let i = 0; i < items.length; i++) {
    tblRow(items[i], widths, i%2===0?'#f8f9fa':'#fff', rh);
  }
  gap(8);
}

// ===== COVER =====
doc.rect(0,0,doc.page.width,doc.page.height).fill('#0d47a1');
let cv = 70;
doc.fillColor('#fff').fontSize(18).font('R').text('EVA TEAM', ML, cv); cv += 45;
let mh = doc.heightOfString('MEKONG DATA CENTER', { width: PW, fontSize: 38, font: 'B' });
doc.fontSize(38).font('B').text('MEKONG DATA CENTER', ML, cv, { width: PW }); cv += mh + 40;
let sh = doc.heightOfString('Giải pháp Trung tâm Dữ liệu Thủy văn', { width: PW, fontSize: 24, font: 'R' });
doc.fontSize(24).font('R').text('Giải pháp Trung tâm Dữ liệu Thủy văn', ML, cv, { width: PW }); cv += sh + 35;
doc.fontSize(20).text('Đồng bằng sông Cửu Long', ML, cv); cv += 50;
doc.moveTo(ML, cv).lineTo(ML+PW, cv).strokeColor('#1e88e5').stroke(); cv += 38;
doc.fontSize(18).font('R').text('Phiên bản: 3.0 — 06/2026', ML, cv); cv += 36;
doc.text('Phân loại: Tài liệu tư vấn giải pháp', ML, cv);
// bottom text
cv = 610;
doc.fontSize(14).fillColor('#90caf9');
let b1h = doc.heightOfString('Tài liệu trình bày giải pháp xây dựng trung tâm dữ liệu thủy văn hoàn chỉnh.', { width: PW, lineGap: 8 });
doc.text('Tài liệu trình bày giải pháp xây dựng trung tâm dữ liệu thủy văn hoàn chỉnh.', ML, cv, { lineGap: 8 }); cv += b1h + 24;
let b2h = doc.heightOfString('Bao gồm: AI, IoT, bán dữ liệu, quản lý kinh doanh, cảnh báo tự động.', { width: PW, lineGap: 8 });
doc.text('Bao gồm: AI, IoT, bán dữ liệu, quản lý kinh doanh, cảnh báo tự động.', ML, cv, { lineGap: 8 }); cv += b2h + 24;
doc.text('© EVA Team — Bảo mật.', ML, cv);

// ===== MỤC LỤC =====
np();
doc.fillColor('#0d47a1').fontSize(34).font('B');
let tocth = doc.heightOfString('MỤC LỤC', { width: PW, lineGap: 8 });
doc.text('MỤC LỤC', ML, y, { lineGap: 8 });
let tocu = y + tocth + 10;
doc.moveTo(ML, tocu).lineTo(ML+PW, tocu).strokeColor('#0d47a1').stroke();
y = tocu + 22;
const toc = ['1. Hiện trạng hệ thống','2. Danh mục tính năng cần xây dựng','3. Kiến trúc đề xuất','4. Lộ trình triển khai','5. Đề xuất bổ sung'];
doc.fontSize(20).font('R').fillColor('#333');
for (const t of toc) {
  doc.fillColor('#0d47a1').font('B').text(t, ML, y);
  y += 40;
}

// ===== 1. HIỆN TRẠNG =====
h1('1. Hiện trạng hệ thống');
p('Hệ thống Mekong hiện tại đã có nền tảng vững chắc với các thành phần chính:');

const cur = ['Thành phần','Công nghệ','Ghi chú'];
const cw = [140, 180, 187];
renderTbl('', [
  ['Backend API','Spring Boot 4.0.6 / Java 17','16 controllers, 70+ endpoints, 13 services'],
  ['Frontend','Next.js 15 / React 19 / OpenLayers','Bản đồ tương tác, dashboard admin'],
  ['GIS / Map','OpenLayers 10, Proj4','Layers, timelapse, S3 render, raster/vector'],
  ['Cơ sở dữ liệu','MySQL 8.0','Dữ liệu thủy văn, người dùng, articles'],
  ['Lưu trữ file','S3-compatible (MinIO)','Raster, vector, backup, uploads'],
  ['Data Pipeline','Node.js ESM','2 nguồn: Mekong (5 lần/ngày) + Ecowitt (15 phút)'],
  ['Xác thực & Phân quyền','JWT + BCrypt','3 roles: USER, DATA_MANAGER, ADMIN'],
  ['Xuất Excel','Apache POI + xlsx','Monthly reports, import Excel'],
], cur, cw, 80);

// ===== 2. DANH MỤC TÍNH NĂNG =====
h1('2. Danh mục tính năng cần xây dựng');
p('Các hạng mục cần triển khai để hoàn thiện trung tâm dữ liệu, chia theo 7 khối chức năng:');

const WHD = ['STT','Hạng mục','Mô tả','MĐ','UT'];
const W = [30, 140, 295, 32, 32];

const cats = [
  ['A. Hạ tầng & DevOps',[
    ['A1','Docker hóa toàn bộ hệ thống','Container hóa backend, frontend, datacenter, MySQL, MinIO, Nginx','2','C'],
    ['A2','CI/CD (GitHub Actions)','Tự động build, test, deploy','3','C'],
    ['A3','Nginx + SSL + Domain','Reverse proxy, HTTPS, caching, load balancing','2','C'],
    ['A4','Monitoring (Prometheus + Grafana)','Giám sát CPU, RAM, disk, DB, API, uptime','4','TB'],
    ['A5','Centralized Logging','Thu thập log tập trung, tra cứu, cảnh báo lỗi','4','T'],
    ['A6','Auto Backup & Disaster Recovery','Backup DB/file hằng ngày → S3, script khôi phục','2','C'],
  ]],
  ['B. AI & Phân tích',[
    ['B1','Data Warehouse & Tiền xử lý','Chuẩn hóa dữ liệu lịch sử, fill missing, loại nhiễu','3','C'],
    ['B2','Dự báo chuỗi thời gian','Forecasting độ mặn, pH, mực nước (Prophet/LSTM)','5','C'],
    ['B3','Phát hiện bất thường','Anomaly detection realtime, so sánh historical pattern','4','C'],
    ['B4','Phân tích xu hướng','Tương quan yếu tố, xu hướng mùa vụ, báo cáo tự động','4','TB'],
    ['B5','API AI & Dashboard','API dự báo, biểu đồ tương tác, so sánh, xu hướng','3','C'],
    ['B6','Báo cáo tự động','Sinh PDF/Excel định kỳ (ngày/tuần/tháng)','3','TB'],
  ]],
  ['C. IoT & Trạm đo',[
    ['C1','Thiết bị cảm biến (mỗi trạm)','Cảm biến mặn + pH + mực nước + thời tiết + ESP32 + 4G','3','C'],
    ['C2','Lắp đặt hiện trường','Tủ chống nước, gắn trụ, đấu nối, test, hiệu chuẩn','2','C'],
    ['C3','Firmware ESP32','Đọc cảm biến, MQTT, deep sleep, tự động gửi dữ liệu','4','C'],
    ['C4','Backend IoT (MQTT + Ingestion)','MQTT broker, API nhận, validate, device management','3','C'],
    ['C5','Dashboard IoT Realtime','Trạng thái online/offline, dữ liệu live, biểu đồ','3','TB'],
  ]],
  ['D. Bán dữ liệu & Thương mại',[
    ['D1','Data Catalog & Package Builder','Danh mục bộ dữ liệu, UI chọn tỉnh/trạm/thông số → báo giá','3','C'],
    ['D2','Giỏ hàng & Thanh toán','Tích hợp VNPay/MoMo, giỏ hàng, xác nhận đơn hàng','5','C'],
    ['D3','Tự động sinh file & Giao hàng','Tạo Excel/CSV, upload S3, gửi link download có expiry','3','C'],
    ['D4','API Public & Key Management','REST API công khai, key, rate limiting, quota','4','C'],
    ['D5','Subscription & Tự động gia hạn','Gói tháng/năm, auto-renew, expiry, nhắc nhở','4','C'],
  ]],
  ['E. Quản lý kinh doanh & Khách hàng',[
    ['E1','Đơn hàng & Hóa đơn','Quản lý đơn hàng, xuất hóa đơn điện tử, biên lai','3','C'],
    ['E2','CRM khách hàng','Lịch sử mua, chăm sóc, email marketing, thông báo','3','TB'],
    ['E3','Multi-tenant & Phân quyền','Mở rộng role: Guest, Subscriber, Enterprise, Admin','3','C'],
    ['E4','Báo cáo doanh thu & Thống kê','Dashboard doanh thu, số liệu bán hàng, xu hướng','2','TB'],
  ]],
  ['F. Cảnh báo & Giám sát tự động',[
    ['F1','Cảnh báo đa kênh','SMS, Email, Webhook khi phát hiện bất thường','3','C'],
    ['F2','Dashboard giám sát tổng thể','Tổng quan trạm, dữ liệu, cảnh báo, xu hướng','3','C'],
    ['F3','Cảnh báo ngưỡng thông minh','Cấu hình ngưỡng theo mùa, tự động điều chỉnh','2','TB'],
    ['F4','SMS Gateway','Tích hợp SMS Brandname gửi thông báo tự động','2','TB'],
  ]],
  ['G. Bảo mật & Vận hành',[
    ['G1','Rate Limiting & Chống Abuse','Giới hạn request, bảo vệ API public','2','C'],
    ['G2','Audit Logging & Trace','Ghi lại toàn bộ hành động người dùng, truy vết','3','C'],
    ['G3','Quản lý Secrets','Vault, không lưu secret trong code/env','2','C'],
    ['G4','Error Tracking (Sentry)','Theo dõi lỗi ứng dụng, cảnh báo realtime','2','TB'],
    ['G5','Kiểm toán & Pentest','Đánh giá bảo mật định kỳ, thử nghiệm xâm nhập','3','TB'],
  ]],
];

for (const [title, items] of cats) {
  renderTbl(title, items, WHD, W, 95);
}

// Stats
gap(6);
h2('Thống kê tổng quan:');
let total=0, cao=0, trung=0, thap=0;
for (const [,items] of cats) { for (const it of items) {
  total++; if (it[4]==='C') cao++; else if (it[4]==='TB') trung++; else thap++;
}}
for (const [l,v] of [['Tổng số hạng mục:',total],['Ưu tiên Cao:',`${cao} (${Math.round(cao/total*100)}%)`],['Ưu tiên Trung bình:',`${trung} (${Math.round(trung/total*100)}%)`],['Ưu tiên Thấp:',`${thap} (${Math.round(thap/total*100)}%)`]]) {
  if (y > 740) np();
  doc.rect(ML, y, 400, 30).fill('#f5f5f5');
  doc.fillColor('#333').fontSize(16).font('R').text(l, ML+8, y+6);
  doc.font('B').fillColor('#0d47a1').text(v, ML+410, y+6);
  y += 34;
}

// ===== 3. KIẾN TRÚC =====
h1('3. Kiến trúc đề xuất');
p('Kiến trúc tổng thể của trung tâm dữ liệu được tổ chức theo mô hình layered architecture, gồm 5 tầng:');

gap(4);
const layers = [
  ['Tầng 1: Thu thập dữ liệu','API Mekong, API Ecowitt, MQTT IoT, Webhook, Import Excel, API Tổng cục KTTV, NOAA, CHIRPS'],
  ['Tầng 2: Xử lý & Lưu trữ','Data pipeline, ETL, data validation, data warehouse (MySQL + S3), caching (Redis)'],
  ['Tầng 3: Phân tích & AI','Time series forecasting, anomaly detection, trend analysis, auto-reporting'],
  ['Tầng 4: API & Dịch vụ','REST API (Spring Boot), Public Data API, API Key management, rate limiting'],
  ['Tầng 5: Giao diện & Khách hàng','Web portal (Next.js), Dashboard, Data Catalog, Mobile App'],
];
for (const [l,d] of layers) {
  if (y > 715) np();
  let dh = doc.heightOfString(d, { width: PW-24, lineGap: 6, fontSize: 16 });
  let ch = Math.max(74, Math.round(38 + dh + 8));
  doc.roundedRect(ML, y, PW, ch, 6).fill('#e3f2fd');
  doc.fillColor('#0d47a1').fontSize(18).font('B').text(l, ML+12, y+10);
  doc.fillColor('#444').fontSize(16).font('R').text(d, ML+12, y+38, { width: PW-24, lineGap: 6 });
  y += ch + 10;
}

gap(10);
h2('Luồng dữ liệu tổng thể:');
p('Dữ liệu từ nhiều nguồn khác nhau (API, IoT, webhook) đi vào hệ thống qua tầng thu thập. Sau đó được kiểm tra chất lượng, chuẩn hóa, và lưu trữ. Tầng AI phân tích và tạo ra các dự báo, cảnh báo. Tầng API phục vụ cả người dùng web lẫn khách hàng doanh nghiệp qua API công khai.');

// ===== 4. LỘ TRÌNH =====
h1('4. Lộ trình triển khai');
p('Lộ trình được chia làm 3 giai đoạn, mỗi giai đoạn tập trung vào một nhóm giá trị cụ thể:');

const phases = [
  {t:'GIAI ĐOẠN 1 — Nền tảng & Vận hành (1-2 tháng)',c:'#1565c0',d:'Mục tiêu: Hệ thống vững chắc, sẵn sàng production.',p:['Docker hóa + CI/CD','Nginx + SSL','Auto Backup & DR','Rate Limiting','Secrets Management','Error Tracking']},
  {t:'GIAI ĐOẠN 2 — Sản phẩm & Thương mại (3-5 tháng)',c:'#1976d2',d:'Mục tiêu: Có sản phẩm bán ra thị trường.',p:['Data Catalog + Package Builder','Giỏ hàng + Thanh toán','Tự động sinh Excel/CSV','API Public + Key Management','Subscription Management','Đơn hàng & Hóa đơn','Multi-tenant & Phân quyền','Audit Logging']},
  {t:'GIAI ĐOẠN 3 — AI, IoT & Mở rộng (6-12 tháng)',c:'#1e88e5',d:'Mục tiêu: Trung tâm dữ liệu hoàn chỉnh, vận hành tự động.',p:['Data Warehouse + Forecast + Anomaly Detection','API AI & Dashboard','Báo cáo tự động','IoT hardware + Firmware (3-5 trạm pilot)','Backend IoT + Dashboard','Cảnh báo đa kênh','Mở rộng dần lên 10-20 trạm']},
];

for (const ph of phases) {
  const h = 40 + ph.p.length * 28;
  if (y + h > 730) np();
  doc.roundedRect(ML, y, PW, 40, 6).fill(ph.c);
  doc.fillColor('#fff').fontSize(18).font('B').text(ph.t, ML+12, y+10);
  y += 48;
  doc.fillColor('#555').fontSize(15).font('R').text(ph.d, ML+12, y);
  y += 24;
  doc.fontSize(16).font('R').fillColor('#444');
  for (const item of ph.p) {
    doc.circle(ML+12, y+6, 4).fill('#0d47a1');
    doc.text(item, ML+28, y);
    y += 28;
  }
  y += 16;
}

// ===== 5. ĐỀ XUẤT BỔ SUNG =====
h1('5. Đề xuất bổ sung');
p('Các tính năng đề xuất thêm để nâng cao giá trị trung tâm dữ liệu:');

const EX = ['Tính năng','Mô tả','Ưu tiên'];
const EW = [160, 295, 60];
renderTbl('', [
  ['Bản đồ vệ tinh thông minh','Tích hợp Sentinel-2, NDVI, nhiệt độ mặt nước, so sánh 2 thời điểm','Cao'],
  ['Cổng dữ liệu mở (Open Data)','Cho công chúng xem một phần dữ liệu miễn phí, tạo thương hiệu','Cao'],
  ['Mobile App (React Native)','Ứng dụng di động cho nông dân: xem mặn, nhận cảnh báo','Trung'],
  ['Sàn giao dịch dữ liệu','Cho đối tác đăng bán dữ liệu trên nền tảng','Trung'],
  ['AI Chatbot tư vấn','Chatbot trả lời câu hỏi số liệu, xu hướng, khuyến nghị canh tác','Trung'],
], EX, EW, 90);

gap(10);
h2('Khuyến nghị chiến lược:');
const recs = [
  'Ưu tiên bán dữ liệu trước để có doanh thu sớm, tái đầu tư cho AI & IoT.',
  'IoT triển khai theo lộ trình: 3-5 trạm pilot → đánh giá → mở rộng.',
  'AI bắt đầu với dự báo (nhu cầu cao) và phát hiện bất thường (cảnh báo), sau đến phân tích xu hướng.',
  'Có thể bắt đầu bán dữ liệu thủ công ngay (nhận yêu cầu → xuất Excel → gửi email) không cần chờ hệ thống tự động.',
  'Xây dựng thương hiệu song song với phát triển kỹ thuật.',
];
for (const r of recs) {
  if (y > 740) np();
  doc.fillColor('#0d47a1').fontSize(16).font('B');
  let rh = doc.heightOfString(`» ${r}`, { width: PW, lineGap: 8 });
  doc.text(`» ${r}`, ML, y, { lineGap: 8 });
  y += Math.max(36, rh + 10);
}

// ===== END =====
np();
doc.rect(0,0,doc.page.width,doc.page.height).fill('#0d47a1');
doc.fillColor('#fff').fontSize(38).font('B').text('Cảm ơn!', ML, 160);
doc.fontSize(20).font('R').fillColor('#bbdefb').text('EVA Team sẵn sàng đồng hành cùng Quý khách', ML, 215);
doc.text('xây dựng Trung tâm Dữ liệu Thủy văn chuyên nghiệp.', ML, 245);
doc.moveTo(ML, 290).lineTo(ML+PW, 290).strokeColor('#1e88e5').stroke();
doc.fontSize(18).fillColor('#fff').font('R').text('Liên hệ:', ML, 320);
doc.text('EVA Team', ML, 350);
doc.text('© 2026 EVA Team. Bảo mật.', ML, 660);

doc.end();

ws.on('finish',()=>{
  const size = fs.statSync(out).size;
  console.log(`OK: ${out}`);
  console.log(`Size: ${(size/1024).toFixed(1)} KB`);
});
ws.on('error',e=>{ console.error(e); process.exit(1); });
