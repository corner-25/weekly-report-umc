# Kế hoạch chuẩn hoá luồng dữ liệu tập trung

> Trạng thái: đề xuất, chờ duyệt
> Ngày: 2026-08-20

## 1. Hiện trạng

Hệ thống thực tế trải trên **hai repo**, dữ liệu đi qua GitHub như một kho trung gian.

### 1.1 Repo Python `UMC-APP/PHONGHC/umc-dashboard` — nơi sinh dữ liệu

| Script | Nguồn | Đích | Kích hoạt |
|---|---|---|---|
| `manual_fleet_sync.py` | **Google Sheets** (1 spreadsheet, mỗi sheet = 1 xe), service account | `corner-25/vehicle-storage` → `data/latest/fleet_data_latest.json` + `data/summary/summary_latest.json` | **Bấm nút thủ công** trong `dash_toxe.py` |
| `sync_and_process.py` + `api_handler.py` | **HC OfficeAPI** `officeapi.umc.edu.vn` (6 endpoint) | `corner-25/dashboard-storage` → 6 file JSON | Thủ công |
| `fleet_cleaning.py` | — | — | Thư viện làm sạch dùng chung, không tự chạy |

Cùng repo còn có các dashboard Streamlit (`dash_toxe.py`, `dash_umc.py`, `dash_phonghc_v2/`)
đọc lại chính các file JSON đó.

Lần chạy gần nhất ghi trong `fleet_sync.log`: **2026-05-21**, 11.107 chuyến từ 13 xe.
Từ đó tới nay (2026-08-20) **chưa chạy lại** — tức là dữ liệu đội xe đã cũ 3 tháng.
Đây chính là hệ quả của việc phụ thuộc thao tác thủ công.

### 1.2 Repo Next.js `weekly-report-umc` — nơi tiêu thụ dữ liệu

| Luồng | Cơ chế | Nơi lưu |
|---|---|---|
| Phòng HC | User upload Excel → `POST /api/hc-data-upload` → PUT lên `dashboard-storage` | GitHub |
| HC OfficeAPI | Bấm nút → `POST /api/sync-hc` → PUT 6 file JSON lên `dashboard-storage` | GitHub |
| Đội xe | `GET /api/fleet-data` đọc `vehicle-storage` mỗi lần render | Không lưu |
| OneDrive | *chưa tồn tại* | — |

### 1.3 Chẩn đoán

**Không luồng nào ghi vào Postgres.** GitHub đang đóng hai vai cùng lúc: kho dữ liệu (sai vai)
và cầu vượt tường lửa cho HC OfficeAPI (đúng vai, vì API chỉ gọi được từ mạng nội bộ).

Ba hệ quả:
- Mọi thứ phụ thuộc người bấm nút → dữ liệu đội xe cũ 3 tháng mà không ai biết
- Chatbot SQL (`lib/chatbot/`) không truy vấn được các số liệu này vì chúng không ở trong DB
- Trang report phải tải toàn bộ JSON về client rồi xử lý (`lib/phong-hc/data-processing.ts`,
  `lib/fleet/data-processing.ts`) — không lọc/phân trang phía server được

**Logic làm sạch dữ liệu quý giá đang nằm ở Python** (`fleet_cleaning.py`: chuẩn hoá điểm đến,
suy giờ lái từ start/end, phát hiện quãng đường bất thường, ánh xạ email → tên tài xế).
Không được vứt đi khi refactor — xem mục 4.1.

## 2. Kiến trúc đích

```
  Nguồn gốc                Connectors              Ingestion core         Postgres
  ─────────────            ─────────────           ──────────────         ──────────────
  Google Sheets (xe) ─────→ google-sheets ─┐
  OneDrive (báo cáo) ─────→ onedrive-share ─┼→ fetch → parse → validate → upsert → bảng đích
  HC OfficeAPI ──┐                          │        (Zod)    (idempotent)  + SyncSource
                 └→ GitHub (cầu) ─────────→ github-json                     + SyncRun
                                                  ↑                          + SyncLog
                                    cron hằng ngày + nút chạy tay
```

Thay đổi so với hiện trạng:
- **Google Sheets đọc thẳng**, không qua GitHub nữa — vì Sheets API gọi được từ bất cứ đâu.
- **GitHub chỉ còn giữ vai cầu vượt tường lửa cho HC OfficeAPI**, không còn là kho dữ liệu.
- Các dashboard Streamlit vẫn đọc GitHub như cũ trong giai đoạn chuyển tiếp, chưa phá.

Nguyên tắc:
- **Một runner duy nhất** cho mọi nguồn. Connector chỉ khai báo: cách lấy, schema, cách upsert.
- **Idempotent**: chạy lại 10 lần cho cùng kết quả. Upsert theo khoá nghiệp vụ, không xoá-nạp lại.
- **Có vết**: mọi lần chạy ghi `SyncRun`. Dữ liệu cũ 3 tháng sẽ nhìn thấy ngay trên trang quản trị.
- **Auth tách rời**: cơ chế lấy dữ liệu nằm gọn trong `fetchers/`, đổi cách xác thực không ảnh
  hưởng phần còn lại.

## 3. Schema mới

### 3.1 Bảng hạ tầng đồng bộ

```prisma
enum SyncSourceKind { ONEDRIVE_SHARE  GITHUB_JSON  HTTP_API }
enum SyncRunStatus  { RUNNING  SUCCESS  FAILED  SKIPPED }

model SyncSource {
  id           String         @id                  // slug, vd "phong-hc-weekly"
  name         String
  kind         SyncSourceKind
  config       Json                                // URL/repo/path, tuỳ kind
  cronEnabled  Boolean        @default(true)
  lastRunAt    DateTime?
  lastSuccessAt DateTime?
  lastChecksum String?                             // bỏ qua khi nguồn không đổi
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  runs         SyncRun[]
  @@map("sync_sources")
}

model SyncRun {
  id            String        @id @default(cuid())
  sourceId      String
  status        SyncRunStatus @default(RUNNING)
  trigger       String                              // "cron" | "manual" | "webhook"
  startedAt     DateTime      @default(now())
  finishedAt    DateTime?
  rowsRead      Int           @default(0)
  rowsUpserted  Int           @default(0)
  rowsSkipped   Int           @default(0)
  errorMessage  String?       @db.Text
  source        SyncSource    @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  logs          SyncLog[]
  @@index([sourceId, startedAt])
  @@map("sync_runs")
}

model SyncLog {
  id        String   @id @default(cuid())
  runId     String
  level     String                                  // "info" | "warn" | "error"
  message   String   @db.Text
  context   Json?
  createdAt DateTime @default(now())
  run       SyncRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  @@index([runId])
  @@map("sync_logs")
}
```

### 3.2 Bảng đích — số liệu báo cáo phòng

Nguồn: **báo cáo phòng** — mỗi năm 1 workbook Excel, mỗi tuần 1 sheet, dữ liệu thuần số.

Khác kế hoạch ban đầu ở hai điểm:
- **Có cột Tháng** trong dataset (kiểm chứng trên file thật), và ánh xạ tuần→tháng nhất quán
  tuyệt đối. Đọc thẳng từ file, không suy từ tuần ISO. Khoá nghiệp vụ vẫn là
  `(category, content, year, week)` — tháng không thuộc khoá vì suy được từ tuần.
- **Năm lấy từ file, không từ dòng dữ liệu.** Connector xác định năm theo thứ tự ưu tiên:
  1. cấu hình rõ ràng trong `SyncSource.config.year` (chắc chắn nhất)
  2. trích từ tên file bằng regex `(20\d{2})`
  3. trích từ tên sheet nếu sheet có ghi năm
  Nếu cả ba đều không ra, hoặc ra hai giá trị mâu thuẫn → **fail cả lần chạy**, ghi lỗi vào
  `SyncLog`. Tuyệt đối không đoán, vì đoán sai sẽ ghi đè số liệu năm khác.

```prisma
model HcMetric {
  id         String   @id @default(cuid())
  category   String                  // "Danh mục"
  content    String                  // "Nội dung"
  year       Int
  week       Int
  month      Int?                    // suy ra từ tuần ISO, không thuộc khoá
  value      Float                   // "Số liệu"
  sheetName  String?                 // sheet gốc, phục vụ truy vết
  sourceId   String
  syncRunId  String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([category, content, year, week])
  @@index([year, week])
  @@index([category])
  @@map("hc_metrics")
}
```

### 3.2b Báo cáo bệnh viện — luồng riêng, KHÔNG tự động ghi DB

Nguồn: **báo cáo bệnh viện** — vừa chữ vừa số, mỗi tuần 1 sheet, cần AI trích xuất.

Đây **không phải** connector ingestion thường. Trích xuất bằng AI có thể sai, và sai âm thầm
sẽ làm hỏng số liệu báo cáo mà không ai biết. Vì vậy luồng này giữ bước người duyệt.

Hệ thống đã có sẵn luồng đúng chuẩn này, tái sử dụng chứ không viết mới:
- `app/api/import/ai-match/route.ts` — parse Excel + gọi DeepSeek, khớp với `MasterTask`/`MetricDefinition`
- `app/dashboard/data-sync/AiReportImportPanel.tsx` — người dùng xem và sửa kết quả khớp
- `app/api/import/ai-save/route.ts` — ghi `Week` + `WeekTaskProgress` + `WeekMetricValue`

Phần bổ sung lần này: cron **chỉ tải file về và tách sheet theo tuần**, phát hiện tuần nào
chưa có trong DB, rồi tạo bản ghi `PendingAiImport` để hiện thông báo "có N tuần chờ duyệt"
trên trang data-sync. Người dùng bấm vào là chạy đúng luồng AI đã có.

```prisma
enum PendingImportStatus { PENDING  APPROVED  REJECTED }

model PendingAiImport {
  id          String   @id @default(cuid())
  sourceId    String
  year        Int
  week        Int
  sheetName   String
  rawText     String   @db.Text        // nội dung sheet đã trích, chờ AI xử lý
  status      PendingImportStatus @default(PENDING)
  syncRunId   String?
  reviewedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([sourceId, year, week])
  @@index([status])
  @@map("pending_ai_imports")
}
```

Ranh giới rõ ràng: **cron tự động hoá việc lấy dữ liệu, không tự động hoá việc phán đoán.**

### 3.3 Bảng đích — chuyến xe

Khớp `FleetTrip` trong `lib/fleet/types.ts`. Nguồn không có ID ổn định nên dùng
`sourceRowHash` (hash của các trường định danh) làm khoá.

```prisma
model FleetTrip {
  id              String   @id @default(cuid())
  sourceRowHash   String   @unique
  vehicleId       String
  driverName      String
  vehicleType     String
  recordDate      DateTime
  startTime       String?
  endTime         String?
  durationHours   Float
  reportedHours   Float
  durationAdjustment String
  distanceKm      Float
  fuelLiters      Float
  revenueVnd      Float
  destination     String   @db.Text
  workCategory    String
  areaType        String
  tripDetails     String?  @db.Text
  syncRunId       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([recordDate])
  @@index([vehicleId, recordDate])
  @@index([driverName])
  @@map("fleet_trips")
}
```

### 3.4 Bảng đích — HC OfficeAPI

6 endpoint trả về hình dạng khác nhau. Giai đoạn 1 lưu dạng bán cấu trúc, tách bảng riêng
khi đã rõ nhu cầu truy vấn:

```prisma
model HcDocumentStat {
  id         String   @id @default(cuid())
  category   String                  // all|incoming|outgoing|task_management|...
  statDate   DateTime
  payload    Json
  syncRunId  String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([category, statDate])
  @@index([statDate])
  @@map("hc_document_stats")
}
```

**Ràng buộc mạng quan trọng:** `officeapi.umc.edu.vn` chỉ gọi được từ trong mạng nội bộ.
Đây là lý do thật sự khiến luồng hiện tại phải đi vòng qua GitHub — GitHub đang đóng vai
**cầu vượt tường lửa**, không phải kho dữ liệu.

Nguyên tắc: Postgres nhận được kết nối từ ngoài, API thì không. Nên chiều đi phải là *từ trong ra*.
Ba phương án, xếp theo mức ưu tiên:

| PA | Điều kiện | Cách làm | Đánh giá |
|---|---|---|---|
| **1** | App + Postgres cùng mạng nội bộ với API | Cron gọi API → ghi thẳng Postgres | Sạch nhất, bỏ hẳn GitHub |
| **2** | Có máy nội bộ chạy 24/7, Postgres ở Railway | Worker nhỏ trên máy đó: gọi API → kết nối Postgres → ghi thẳng | Bỏ được GitHub, cần một máy luôn bật |
| **3** | Không có máy nội bộ nào chạy thường xuyên | Giữ GitHub làm cầu: script nội bộ đẩy JSON lên repo, cron đọc repo → Postgres | Giữ nguyên hiện trạng, thêm bước vào DB |

**Quyết định (2026-08-20):** Postgres ở **Railway**, **không có máy nội bộ chạy 24/7**
→ **chốt PA 3**. GitHub giữ vai cầu vượt tường lửa cho HC OfficeAPI, không bỏ được.

Hệ quả: `sync_and_process.py` trong repo Python vẫn phải chạy từ trong mạng UMC để đẩy JSON
lên `dashboard-storage`. Vẫn còn một khâu thủ công ở đây — nếu sau này có máy nội bộ, đặt
`sync_and_process.py` chạy theo lịch (cron/Task Scheduler) là khép kín được vòng.

Connector `sources/hc-officeapi.ts` đọc từ GitHub. Phần đọc nguồn tách ở `fetchers/` nên
chuyển sang PA 1 hoặc 2 sau này chỉ cần đổi fetcher.

## 4. Cấu trúc mã nguồn

```
lib/ingestion/
├── types.ts               # Connector, SyncContext, SyncResult
├── runner.ts              # runSource(): tạo SyncRun, gọi connector, ghi log, chốt trạng thái
├── registry.ts            # map slug → connector (chỗ duy nhất đăng ký nguồn mới)
├── checksum.ts            # sha256 nội dung nguồn để bỏ qua khi không đổi
├── fetchers/
│   ├── google-sheets.ts   # service account → đọc mọi sheet của spreadsheet
│   ├── onedrive-share.ts  # share link → Graph public URL → ArrayBuffer  ← điểm đổi auth
│   ├── github-json.ts     # đọc file JSON từ repo (gộp code trùng của 2 route hiện tại)
│   └── http-api.ts        # HC OfficeAPI: lấy token + gọi endpoint
├── parsers/
│   ├── workbook-year.ts   # xác định năm của workbook (config → tên file → tên sheet)
│   ├── week-sheet.ts      # tách workbook thành các sheet theo tuần
│   ├── dept-report.ts     # báo cáo phòng: sheet số → HcMetric rows (Zod)
│   ├── hospital-report.ts # báo cáo bệnh viện: sheet chữ+số → rawText cho luồng AI
│   └── fleet-rows.ts      # chuyển hàng Google Sheets → FleetTrip (dùng lib/fleet/cleaning)
└── sources/
    ├── fleet-google-sheets.ts       # → FleetTrip
    ├── dept-report-onedrive.ts      # → HcMetric
    ├── hospital-report-onedrive.ts  # → PendingAiImport (chờ người duyệt)
    └── hc-officeapi.ts              # → HcDocumentStat
```

Hợp đồng connector:

```ts
export interface Connector<TRaw = unknown, TRow = unknown> {
  readonly id: string;
  readonly name: string;
  readonly kind: SyncSourceKind;
  fetch(ctx: SyncContext): Promise<FetchResult<TRaw>>;
  parse(raw: TRaw, ctx: SyncContext): Promise<TRow[]>;
  upsert(rows: TRow[], ctx: SyncContext): Promise<UpsertResult>;
}
```

Runner lo phần chung: ghi `SyncRun`, so `checksum`, bắt lỗi, ghi `SyncLog`, cập nhật
`lastSuccessAt`. Connector không tự xử lý những việc đó.

### 4.1 Chuyển logic làm sạch từ Python sang TypeScript

`fleet_cleaning.py` (19KB) chứa logic nghiệp vụ đã được tinh chỉnh qua nhiều commit, phải
port sang chứ không viết lại từ đầu:

| Hàm Python | Việc | Đích TypeScript |
|---|---|---|
| `compute_driving_hours` | Suy giờ lái từ start/end, xử lý chuyến qua đêm | `lib/fleet/cleaning.ts` |
| `fix_distance_outliers` | Phát hiện và sửa quãng đường bất thường | nt |
| `normalize_destination` | Chuẩn hoá tên quận/điểm đến | nt |
| `classify_work_category` | Phân loại công tác | nt |
| `fix_driver_name_from_email` | Ánh xạ email → tên tài xế | nt |
| `infer_area_type` | Suy nội thành/ngoại thành | nt |
| `remove_vn_accents`, `parse_duration_to_hours` | Tiện ích | nt |

Bảng ánh xạ email → tài xế (24 mục) và danh sách phân loại xe hiện **lặp lại ở 3 nơi**:
`manual_fleet_sync.py`, `dash_toxe.py`, và `lib/fleet/types.ts`. Đưa về một chỗ duy nhất
trong TypeScript, coi đó là nguồn chân lý.

**Cách kiểm chứng port đúng:** chạy connector mới trên cùng spreadsheet, so kết quả với
`fleet_data_latest.json` hiện có trên `vehicle-storage` (11.107 chuyến, 13 xe). Lệch dòng nào
phải giải thích được lý do trước khi chốt.

### 4.2 Số phận repo Python

Không xoá. Sau refactor:
- `manual_fleet_sync.py` → **ngưng dùng**, connector `fleet-google-sheets` thay thế
- `sync_and_process.py` + `api_handler.py` → **giữ**, vì HC OfficeAPI cần chạy trong mạng nội bộ
  (xem mục 3.4). Chuyển từ chạy tay sang chạy theo lịch.
- Dashboard Streamlit → **giữ nguyên**, chưa đụng tới trong lần refactor này

## 5. Lịch chạy

- `POST /api/cron/sync` — bảo vệ bằng header `x-cron-secret` khớp `CRON_SECRET`.
  Chạy tuần tự mọi nguồn có `cronEnabled = true`. Trả về tóm tắt từng nguồn.
- `POST /api/cron/sync?source=<slug>` — chạy một nguồn.
- Railway Cron Service gọi endpoint này mỗi ngày (đề xuất 06:00 giờ VN).
  Repo đã có `railway.json` và `.railway/config.json`, thêm cron service vào đó.
- Route đặt `maxDuration = 300` và chạy tuần tự để tránh vượt giới hạn bộ nhớ.

## 6. Trang quản trị

`/dashboard/data-sync` viết lại thành bảng điều khiển:
- Danh sách nguồn: tên, loại, lần chạy cuối, trạng thái, số dòng, bật/tắt cron
- Nút "Chạy ngay" cho từng nguồn
- Lịch sử 20 lần chạy gần nhất + chi tiết lỗi
- Panel upload Excel thủ công **giữ lại** làm phương án dự phòng, nhưng ghi thẳng vào
  `HcMetric` thay vì đẩy lên GitHub

`AiReportImportPanel` giữ nguyên, không thuộc phạm vi lần này.

## 7. Chuyển trang report sang đọc DB

| Trang | Hiện tại | Sau |
|---|---|---|
| `reports/phong-hc` | fetch `/api/phong-hc-data` → GitHub JSON | `/api/hc-metrics` query `HcMetric`, lọc theo năm/tuần ở server |
| `reports/phong-hc-native` | như trên | như trên |
| `dashboard/vehicles` | fetch `/api/fleet-data` → GitHub JSON | `/api/fleet-trips` query `FleetTrip`, lọc theo khoảng ngày ở server |

`lib/phong-hc/data-processing.ts` và `lib/fleet/data-processing.ts` giữ lại phần tính toán
(pivot, tổng hợp, chuẩn nhiên liệu) — chỉ đổi nguồn đầu vào từ JSON sang kết quả query.

Hai route cũ `/api/phong-hc-data` và `/api/fleet-data` giữ lại một thời gian, đánh dấu
deprecated, xoá sau khi trang mới chạy ổn.

## 8. Thứ tự thực hiện

**Giai đoạn 1 — Hạ tầng** ✅ *xong*
1. `SyncSource`, `SyncRun`, `SyncLog`, `PendingAiImport` + migration
2. `lib/ingestion/types.ts`, `runner.ts`, `registry.ts`, `checksum.ts`
3. `/api/cron/sync` + `CRON_SECRET`
4. Seed các bản ghi `SyncSource`

**Giai đoạn 2 — Đội xe từ Google Sheets** *(đang làm)*
5. ✅ Port `fleet_cleaning.py` → `lib/fleet/cleaning.ts` + `cleaning-rules.ts` (mục 4.1)
   — kiểm chứng 56/56 ca khớp Python, xem `docs/FLEET-PORT-VERIFICATION.md`
6. Bảng `FleetTrip`
7. `fetchers/google-sheets.ts` + `parsers/fleet-rows.ts` + `sources/fleet-google-sheets.ts`
8. **Kiểm chứng mức dữ liệu**: so với `fleet_data_latest.json` (11.107 chuyến, 13 xe) — cần credentials
9. Chốt với bạn

**Giai đoạn 3 — Báo cáo phòng** ✅ *xong — 1.732 dòng vào `hc_metrics`, idempotent đã kiểm chứng*
10. Bảng `HcMetric` — khoá `(Danh mục, Nội dung, Năm, Tuần)`
11. `fetchers/onedrive-share.ts` + `parsers/dept-report.ts`
    — chỉ đọc sheet `Số liệu tuần (<năm>)`, bỏ 2 sheet trình bày
    — xử lý: 545 ô rỗng (bỏ qua, không ghi 0), dấu phẩy thập phân VN, ký tự `/`
12. `sources/dept-report-onedrive.ts`, đối chiếu 2.278 dòng với file gốc

**Giai đoạn 4 — Báo cáo bệnh viện** ✅ *xong — 33 tuần / 7.389 nhiệm vụ vào `pending_ai_imports`*
13. `parsers/hospital-report.ts` — 33 sheet cùng layout, header ở dòng 6, tuần từ tên sheet
    (nhớ `.trim()`: có sheet tên `'29.2026 '`)
14. `sources/hospital-report-onedrive.ts` → `PendingAiImport`
15. Nối vào `AiReportImportPanel`: hiện danh sách tuần chờ duyệt

    Lưu ý: cấu trúc rõ ràng nên parser đọc thẳng được phần lớn nội dung.
    AI chỉ cần cho việc khớp tên nhiệm vụ với `MasterTask` — xem `docs/ONEDRIVE-DATA-ANALYSIS.md`.

**Giai đoạn 5 — HC OfficeAPI**
15. `sources/hc-officeapi.ts` + bảng `HcDocumentStat`, theo phương án mạng đã chọn (mục 3.4)

**Giai đoạn 6 — Giao diện**
16. Viết lại `/dashboard/data-sync` thành bảng điều khiển
17. Chuyển `reports/phong-hc*`, `dashboard/vehicles` sang đọc DB
18. Đánh dấu deprecated `/api/fleet-data`, `/api/phong-hc-data`

**Giai đoạn 7 — Lịch chạy**
19. Cấu hình Railway Cron, theo dõi vài ngày

## 9. Rủi ro cần biết

**Share link OneDrive: dùng được.** (đã kiểm chứng 2026-08-20)

Lần thử đầu tôi kết luận sai là bị chặn — do dùng nhầm endpoint. Endpoint đúng:

```
✅ https://<tenant>-my.sharepoint.com/personal/<user>/_layouts/15/download.aspx?share=<SHARE_ID>
```

Tải được cả hai file, không cần token. Chi tiết và các endpoint sai đã thử: `docs/ONEDRIVE-DATA-ANALYSIS.md`.

Rủi ro còn lại: link công khai với bất kỳ ai có URL. Giảm thiểu: để link ở chế độ chỉ-xem,
lưu link trong biến môi trường (không commit), đổi link nếu nghi lộ. Nếu sau này muốn siết,
chuyển sang Power Automate chỉ cần sửa `fetchers/onedrive-share.ts`.

**Xác định năm sai.** Mỗi năm một workbook, năm suy từ tên file. Nếu file bị đổi tên hoặc
đặt tên không theo quy ước, connector sẽ **fail có chủ đích** thay vì đoán — vì đoán sai
nghĩa là ghi đè số liệu năm khác. Cách chắc chắn nhất: khai báo `year` trong `SyncSource.config`.

**AI trích xuất sai ở báo cáo bệnh viện.** Đã xử lý bằng thiết kế: AI không ghi thẳng DB,
mọi kết quả phải qua người duyệt tại `AiReportImportPanel`.

**Google service account.** Credentials hiện nằm trong `.streamlit/secrets.toml` của repo Python
(đã gitignore đúng, chưa từng vào lịch sử git — đã kiểm tra). Khi chuyển sang Next.js phải đưa
vào biến môi trường Railway, **không commit**. Service account cần được chia sẻ quyền đọc
spreadsheet; nếu ai đó gỡ quyền, connector sẽ fail rõ ràng thay vì âm thầm trả rỗng.

**Port logic làm sạch có thể sai lệch.** Đây là rủi ro lớn nhất của Giai đoạn 2 — `fleet_cleaning.py`
đã tinh chỉnh qua nhiều commit. Giảm thiểu bằng bước kiểm chứng bắt buộc ở mục 8 (so 11.107 chuyến).

**Dữ liệu tồn đọng.** Lần sync cuối là 2026-05-21, tức khoảng 3 tháng chưa cập nhật.
Lần chạy đầu tiên của connector mới sẽ nạp một lượng lớn dữ liệu — cần theo dõi thời gian chạy
và giới hạn bộ nhớ, có thể phải chia lô.

**Trùng khoá.** Nếu file nguồn có hai dòng cùng (danh mục, nội dung, năm, tháng, tuần) với
giá trị khác nhau, dedupe hiện tại lấy dòng sau. Giữ nguyên hành vi đó, nhưng ghi cảnh báo
vào `SyncLog` để bạn biết mà sửa file nguồn.

## 10. Biến môi trường mới

```
CRON_SECRET="..."                        # bảo vệ /api/cron/sync
ONEDRIVE_DEPT_REPORT_SHARE_URL="https://..."      # share link workbook báo cáo phòng
ONEDRIVE_HOSPITAL_REPORT_SHARE_URL="https://..."  # share link workbook báo cáo bệnh viện

# Google Sheets (đội xe) — chuyển từ .streamlit/secrets.toml của repo Python sang
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'  # cả JSON, một dòng
FLEET_SPREADSHEET_ID="1sYzuvnv-lzQcv-IZjT672LTpfUrqdWCesx4pW8mIuqM"
```

Các biến `GITHUB_TOKEN_PHC`, `GITHUB_TOKEN_FLEET`, `HC_API_*` giữ nguyên.
