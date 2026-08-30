# TODO CHI TIẾT — HOÀN THÀNH TOÀN BỘ KIẾN TRÚC & KIỂM THỬ ĐẾN KHI PASS

> Kèm theo: `docs/ARCHITECTURE_DECISION_PLAN.md` (ADR-01 → ADR-09)
> Quy tắc chạy: làm theo thứ tự phase. **Mỗi task có bước [TEST] — không tick done nếu test fail.**
> Nếu test fail → sửa → chạy lại test của task đó + test của các task phụ thuộc trước đó (vòng lặp đến khi pass).
> Ký hiệu: `[ ]` chưa làm · `[~]` đang làm · `[x]` done (đã pass test)

---

## PHASE 0 — Chuẩn bị & an toàn (bắt buộc trước khi đụng code)

- [ ] 0.1 Commit/push toàn bộ working tree hiện tại lên git (nhánh `main` hoặc snapshot branch `pre-adr-snapshot`).
  - [TEST] `git status` → clean; `git log -1` thấy commit snapshot.
- [ ] 0.2 Tạo nhánh làm việc `adr-implementation` từ snapshot.
  - [TEST] `git branch --show-current` → `adr-implementation`.
- [ ] 0.3 Backup DB: `mysqldump -u root -p mekong > backup_mekong_$(date +%F).sql`.
  - [TEST] File dump tồn tại, `grep -c "CREATE TABLE" backup_mekong_*.sql` ≥ số bảng hiện có.
- [ ] 0.4 Ghi lại danh sách secret cần rotate vào file riêng tư (không commit): MySQL, S3, Groq ×19, Rynan, Ecowitt.
  - [TEST] File nằm ngoài git (`git check-ignore` hoặc ngoài repo).

---

## PHASE 1 — ADR-01: Chốt AI = ai-service Python (archive Java AI)

- [ ] 1.1 Kiểm kê code AI trong backend: `grep -rn "groq\|Groq\|ai_conversation\|AIService" backend/src/main/java` → lập danh sách file/class.
- [ ] 1.2 Tạo branch `archive/java-ai`, move các class AI (GroqConfig, GroqClient, DTO AI, AIService dở dang, AIController nếu có) sang nhánh này; trên `adr-implementation` xóa chúng.
  - [TEST] `mvn -f backend/pom.xml clean compile` → BUILD SUCCESS (không còn import đứt).
- [ ] 1.3 Giữ nguyên entity/repository `ai_conversation`, `ai_session` (cần cho ADR-04) — chỉ xóa phần Groq/orchestrator.
  - [TEST] `ls backend/src/main/java/**/entity/gis/` vẫn thấy entity AI; compile pass.
- [ ] 1.4 Cập nhật `docs/AI_IMPLEMENTATION_STATUS.md`: thêm header "⚠️ SUPERSEDED by ai-service/ — archived 2026-08-30, see docs/ARCHITECTURE_DECISION_PLAN.md ADR-01".
  - [TEST] Đọc lại file, header rõ ràng; không còn mục nào mô tả việc "sẽ làm tiếp" AI trong Java.
- [ ] 1.5 Merge branch `archive/java-ai` vào remote (để không mất code).
  - [TEST] `git push origin archive/java-ai` thành công.

---

## PHASE 2 — ADR-07: Xóa credential cứng + rotate

- [ ] 2.1 `backend/src/main/resources/application.yaml`: thay `root/1111`, JWT secret, S3 key bằng `${ENV_VAR}` **không default** (trừ dev profile).
  - [TEST] `grep -n "1111\|AKIA\|secret" backend/src/main/resources/application.yaml` → chỉ còn `${...}`.
- [ ] 2.2 Tách `application-dev.yaml` (chứa giá trị dev local, vẫn không commit secret thật) và `application-prod.yaml` (100% env).
  - [TEST] Chạy backend với env đầy đủ → start OK, `/api/auth/login` hoạt động.
- [ ] 2.3 `scripts/download-s3-gis.py`: S3 key/secret → `os.environ["S3_ACCESS_KEY"]`.
  - [TEST] `python3 scripts/download-s3-gis.py --dry-run` (hoặc chạy 1 file) → không còn hardcode, script chạy được.
- [ ] 2.4 `datacenter/mekong/fetch-mekong-data.mjs`: password Rynan → `process.env`.
  - [TEST] `node -e "import('./datacenter/mekong/fetch-mekong-data.mjs')"` không lỗi; chạy 1 lần fetch thử với env.
- [ ] 2.5 Tạo `.env.example` ở root + `backend/`, `ai-service/`, `datacenter/`, `frontend/` liệt kê đủ biến; thêm `.env` vào `.gitignore` từng thư mục.
  - [TEST] `git status` không hiện `.env`; `grep -rn "password.*=.*['\"][^$]" --include="*.{java,py,mjs,ts,yaml}"` sạch.
- [ ] 2.6 **Rotate** toàn bộ secret trong danh sách Phase 0.4 (MySQL root, S3, Groq, Rynan, Ecowitt) → cập nhật `.env` thực tế.
  - [TEST] Login bằng key MỚI thành công ở từng hệ (S3 list, Groq 1 request, Ecowitt fetch, Rynan fetch).
- [ ] 2.7 Quét toàn repo lần cuối: `grep -rn "1111\|AKIA\|sk-\|gsk_" --exclude-dir=node_modules --exclude-dir=target --exclude-dir=.git .`
  - [TEST] Output rỗng (hoặc chỉ match trong `.env.example` dạng placeholder).

---

## PHASE 3 — ADR-04: Session AI lưu MySQL

- [ ] 3.1 Đọc `ai-service/memory/session_store.py` hiện tại → xác định interface cần giữ (add_message, get_history, clear).
- [ ] 3.2 Viết `ai-service/memory/mysql_store.py`:
  - Bảng: `ai_session(session_id, user_id, created_at)` + `ai_conversation(id, session_id, role, content, metadata JSON, created_at)` — dùng đúng schema V006, nếu lệch thì viết migration SQL mới `V007__ai_session_align.sql` (không sửa V006).
  - Implement cùng interface với `session_store.py`; cửa sổ 10 lượt khi đọc history.
- [ ] 3.3 Thêm cấu hình: `AI_SESSION_STORE=memory|mysql` (env), `AI_MYSQL_URL/USER/PASS`; mặc định `mysql` khi `ENV=prod`, `memory` khi dev/test.
- [ ] 3.4 Wire vào `orchestrator/orchestrator.py`: chọn store theo config.
- [ ] 3.5 Thêm endpoint `GET /chat/history/{session_id}` trả danh sách message.
- [ ] 3.6 Viết test `ai-service/tests/test_mysql_store.py` (pytest, dùng DB test riêng `mekong_test`):
  - [TEST] `pytest ai-service/tests/test_mysql_store.py -v` → pass: lưu 5 message → đọc lại đúng thứ tự; window 10 lượt cắt đúng; clear xóa sạch.
- [ ] 3.7 Test tích hợp thật:
  - [TEST] Start ai-service với `AI_SESSION_STORE=mysql` → gửi 2 tin nhắn `/chat` → `SELECT COUNT(*) FROM ai_conversation` tăng đúng 4 (2 user + 2 assistant) → **restart ai-service** → gọi `/chat/history/{session_id}` vẫn trả đủ hội thoại cũ.

---

## PHASE 4 — ADR-05: Rule Validator vào pipeline

- [ ] 4.1 Đọc `ai-service/peer_review/rule_validator.py` + `orchestrator/orchestrator.py` → xác định điểm chèn (ngay sau Analyst, trước reviewer_ai).
- [ ] 4.2 Wire rule_validator vào orchestrator: FAIL bởi rule → retry Analyst (không gọi reviewer), tối đa 2 lần như hiện tại; log lý do FAIL vào SSE metadata.
- [ ] 4.3 Bổ sung rule: mọi con số trong báo cáo phải truy vết được trong evidence JSON (so khớp số xuất hiện trong `stations`/`features`/scores).
- [ ] 4.4 Viết test `ai-service/tests/test_rule_validator.py`:
  - [TEST] `pytest ai-service/tests/test_rule_validator.py -v` → pass các case: "NO_DATA nhưng trả lời có số 0/100" → FAIL; báo cáo có số lạ không có trong evidence → FAIL; báo cáo hợp lệ → PASS.
- [ ] 4.5 Test E2E pipeline:
  - [TEST] Gửi `/chat` câu hỏi về độ mặn tại 1 tọa độ có dữ liệu → SSE nhận đủ `step → metadata → chunk → end`, metadata có `review: PASS`, câu trả lời có số khớp evidence.
  - [TEST] Gửi câu hỏi vùng không có dữ liệu → câu trả lời KHÔNG bịa số (hoặc bị chặn với cảnh báo).

---

## PHASE 5 — ADR-03: JWT cho ai-service

- [ ] 5.1 Thêm `PyJWT` vào `ai-service/requirements.txt`; cài: `pip install -r ai-service/requirements.txt`.
- [ ] 5.2 Viết middleware `verify_jwt` (secret từ env `JWT_SECRET` — cùng nguồn backend; chấp nhận `Authorization: Bearer`), exempt `/health`.
- [ ] 5.3 Siết CORS: whitelist đúng origin frontend (đọc từ env `FRONTEND_ORIGIN`), bỏ allow-all.
- [ ] 5.4 Frontend `features/ai/`: đính kèm token từ `lib/auth.ts` vào header mọi call `/chat`, `/chat/history`.
- [ ] 5.5 Test:
  - [TEST] `curl -X POST :8090/chat` không token → **401**; token giả → 401; token thật từ login backend → 200 + stream.
  - [TEST] Token hết hạn (đổi exp) → 401.
  - [TEST] Trình duyệt: chat từ UI hoạt động bình thường (kiểm tra tab Network có header Authorization).

---

## PHASE 6 — ADR-06: Flyway + tắt ddl-auto update

- [ ] 6.1 Thêm `flyway-core` + `flyway-mysql` vào `backend/pom.xml` (version khớp Spring Boot BOM).
- [ ] 6.2 Cấu hình `spring.flyway.baseline-on-migrate=true`, `baseline-version=6` (V001–V006 đã chạy tay); Flyway chỉ chạy migration **mới** (V007+).
- [ ] 6.3 Đổi profile: `prod` → `ddl-auto: validate`, `show-sql: false`; `dev` giữ `update` nếu muốn.
- [ ] 6.4 Test trên DB sạch:
  - [TEST] Tạo DB `mekong_flyway_test` rỗng → chạy backend trỏ vào đó → Flyway tạo đủ schema, `flyway_schema_history` có baseline + các V mới, app start OK.
- [ ] 6.5 Test trên DB thật (đã backup Phase 0.3):
  - [TEST] Start backend → không lỗi validate; dữ liệu cũ nguyên vẹn (`SELECT COUNT(*)` so với trước trên 3 bảng chính: `layers`, `s3_objects`, `stations`).
- [ ] 6.6 Viết migration mẫu `V007__*.sql` (nếu Phase 3 cần) và xác nhận quy ước "chỉ thêm file mới, không sửa file cũ" được ghi vào README/docs.

---

## PHASE 7 — ADR-09: Catalog + ETL Mekong

- [ ] 7.1 Bật ETL Mekong: `datacenter/config/schedule.json` đổi `_mekong` → `mekong`; chạy tay 1 lần:
  - [TEST] `node datacenter/mekong/fetch-mekong-data.mjs` → log thành công, `SELECT MAX(created_at) FROM <bảng mekong>` = thời gian vừa chạy.
- [ ] 7.2 Bật cron: chạy `node datacenter/cron-wrapper.mjs` (hoặc pm2/systemd) → chờ đúng khung giờ lịch:
  - [TEST] `logs/mekong-cron.log` có bản ghi chạy mới; DB có dòng mới.
- [ ] 7.3 Sửa `data_catalog.yaml`: cập nhật `flood.latest_year` theo năm thực tế mới nhất của file raster flood trong S3 (kiểm tra bằng `scripts/list_s3.py` hoặc backend `/api/s3/list`).
  - [TEST] Gọi `/chat` hỏi về ngập lụt → Planner chọn dataset flood với năm đúng.
- [ ] 7.4 Tham số hóa hardcode vector Trà Vinh/Cang Long trong `waterway` (env hoặc config).
  - [TEST] Đổi giá trị config → tool GIS đọc đúng file khác.
- [ ] 7.5 Ghi chú rõ nguồn từng dataset trong catalog (salinity/ph = S3 raster; do/turbidity = MySQL point).
  - [TEST] Hỏi `/chat` "độ mặn tại X" → dùng raster S3; "DO tại trạm Y" → dùng MySQL. (Kiểm qua SSE metadata `required_data` + tool được gọi.)

---

## PHASE 8 — ADR-02: Bỏ MySQL/S3 trực tiếp khỏi frontend

- [ ] 8.1 Kiểm kê: `grep -rn "mysql\|aws-sdk\|S3Client" frontend/src frontend/package.json` → danh sách route dùng trực tiếp (`api/mysql/route.ts`, `api/ecowitt/*`, `api/mekong-monthly/*`, `api/s3-list`, `api/data/[filename]`, `lib/db.ts`).
- [ ] 8.2 Với từng route: xác định endpoint Spring tương ứng; thiếu thì bổ sung backend (controller + service + test).
  - [TEST] `mvn -f backend/pom.xml test` pass với test mới; `curl` endpoint mới trả đúng dữ liệu cũ.
- [ ] 8.3 Chuyển từng route Next thành proxy thuần (hoặc xóa nếu frontend gọi thẳng backend được).
  - [TEST] Với từng trang UI liên quan (dashboard data tab, ecowitt chart, s3-list): mở trang → dữ liệu hiển thị đúng như trước (so sánh screenshot/số liệu).
- [ ] 8.4 Xóa `lib/db.ts`, gỡ `mysql2` + `@aws-sdk/client-s3` khỏi `frontend/package.json`; `npm install` lại.
  - [TEST] `grep -rn "mysql2\|aws-sdk" frontend/src frontend/package.json` → rỗng; `npm run build` thành công.
- [ ] 8.5 Dọn `frontend/.env*`: không còn credential DB/S3.
  - [TEST] `cat frontend/.env*` chỉ còn URL công khai (API_URL, TITILER flag).

---

## PHASE 9 — ADR-08: docker-compose production

- [ ] 9.1 `backend/Dockerfile`: multi-stage (Maven build → eclipse-temurin:17-jre), expose 8084.
  - [TEST] `docker build -t mekong-backend ./backend` thành công; `docker run` + `curl :8084/api/auth/login` OK.
- [ ] 9.2 `frontend/Dockerfile`: Next standalone output, expose 3004.
  - [TEST] Build + chạy → trang chủ load được.
- [ ] 9.3 `ai-service/Dockerfile`: python:3.11-slim + GDAL/rasterio deps (apt install gdal-bin libgdal-dev), expose 8090.
  - [TEST] Build + chạy → `/health` 200; 1 request `/chat` test với mock.
- [ ] 9.4 `docker-compose.yml`: services backend/frontend/ai-service/titiler/mysql, healthcheck, volume MySQL, env từ `.env`, network nội bộ.
  - [TEST] `docker compose up -d` trên máy sạch (hoặc sau `docker compose down -v`) → tất cả container healthy trong 2 phút.
- [ ] 9.5 Cập nhật `DEPLOY.md` + `manage.sh` ghi chú: compose là đường deploy chính, manage.sh chỉ cho dev.
  - [TEST] Làm theo DEPLOY.md mới từ đầu trên máy sạch → hệ thống chạy.

---

## PHASE 10 — KIỂM THỬ TỔNG (E2E) — chạy lại đến khi 100% pass

> Chạy toàn bộ checklist dưới đây **theo thứ tự**. Bất kỳ mục FAIL → sửa → **chạy lại từ đầu Phase 10** (không tick lệch).

### 10A. Hạ tầng
- [ ] T1 `docker compose up -d` → 5/5 container healthy.
- [ ] T2 MySQL volume bền: `docker compose down && docker compose up -d` → dữ liệu còn.
- [ ] T3 Không secret trong git: `git grep -n "1111\|AKIA\|gsk_"` → rỗng.

### 10B. Backend
- [ ] T4 `mvn -f backend/pom.xml test` → BUILD SUCCESS, 0 failure.
- [ ] T5 Login `POST /api/auth/login` (user thường + admin) → JWT hợp lệ.
- [ ] T6 Phân quyền: user thường gọi `POST /api/s3/upload` → 403; admin → 200.
- [ ] T7 Upload 1 file GeoTIFF → xuất hiện trong S3 + bảng `s3_objects`; `/api/s3/render?key=...` trả ảnh tile.
- [ ] T8 Flyway: `SELECT * FROM flyway_schema_history` → baseline + V007+ áp dụng đúng.

### 10C. Frontend
- [ ] T9 `npm run build` (frontend) → thành công, 0 error TS/ESLint chặn.
- [ ] T10 Trang chủ + catalog + tin tức load; bản đồ hiển thị layer COG qua TiTiler (mở DevTools thấy request XYZ 200).
- [ ] T11 Fallback: tắt TiTiler (`NEXT_PUBLIC_USE_TITILER=false`) → bản đồ vẫn render qua backend `/api/s3/render`.
- [ ] T12 Dashboard ADMIN: tabs users/storage/data/gis/news hoạt động; user thường vào dashboard → bị chặn.
- [ ] T13 Không còn request nào từ frontend chạm MySQL/S3 trực tiếp (soi Network tab + grep code).

### 10D. AI service
- [ ] T14 `pytest ai-service/tests -v` → toàn bộ pass.
- [ ] T15 Không token → 401; token hợp lệ → stream SSE đầy đủ (step/metadata/chunk/end).
- [ ] T16 Restart ai-service giữa hội thoại → history còn (ADR-04).
- [ ] T17 Câu hỏi độ mặn (S3 raster) / DO (MySQL) / thời tiết (Ecowitt) → metadata cho thấy đúng tool, đúng nguồn.
- [ ] T18 Câu hỏi vùng NO_DATA → không bịa số; nếu reviewer FAIL 2 lần → thông báo cảnh báo rõ ràng.
- [ ] T19 Groq rate-limit: gửi 25 request liên tiếp → key rotation hoạt động, không chết vì 429 (retry thành công).

### 10E. ETL & dữ liệu
- [ ] T20 Ecowitt cron chạy đúng lịch 15 phút → dòng mới trong bảng `ecowitt`.
- [ ] T21 Mekong cron chạy đúng lịch → dòng mới trong bảng sensor.
- [ ] T22 COG watcher: upload 1 GeoTIFF mới → trong ~5 phút có bản `_cog.tif` tương ứng.

### 10F. Nghiệm thu tổng (Definition of Done trong ADR plan)
- [ ] T23 Đối chiếu 7 mục "Tiêu chí nghiệm thu tổng" ở `docs/ARCHITECTURE_DECISION_PLAN.md` §11 → từng mục ✅.
- [ ] T24 Merge `adr-implementation` → `main`; tag `v1.0-adr-complete`; cập nhật README kiến trúc mới.

---

## Vòng lặp xử lý khi FAIL (áp dụng cho mọi phase)

1. Xác định task FAIL → đọc log/test output đầy đủ.
2. Sửa đúng nguyên nhân (không vá bề mặt).
3. Chạy lại **test của task đó** → pass.
4. Chạy lại **test của các task phụ thuộc trước** trong cùng phase + Phase 10 liên quan → pass.
5. Chỉ khi cả chuỗi pass mới tick `[x]` và chuyển task tiếp theo.

## Ước lượng khối lượng

| Phase | Nội dung | Task | Ước lượng |
|---|---|---|---|
| 0 | Chuẩn bị | 4 | 0.5 ngày |
| 1 | ADR-01 archive Java AI | 5 | 0.5 ngày |
| 2 | ADR-07 secrets + rotate | 7 | 1 ngày |
| 3 | ADR-04 session MySQL | 7 | 1–1.5 ngày |
| 4 | ADR-05 rule validator | 5 | 0.5–1 ngày |
| 5 | ADR-03 JWT ai-service | 5 | 0.5–1 ngày |
| 6 | ADR-06 Flyway | 6 | 1 ngày |
| 7 | ADR-09 catalog + ETL | 5 | 1 ngày |
| 8 | ADR-02 frontend data access | 5 | 1.5–2 ngày |
| 9 | ADR-08 docker-compose | 5 | 1.5–2 ngày |
| 10 | E2E tổng | 24 | 1–2 ngày |
| | **Tổng** | **78** | **~10–13 ngày làm việc** |
