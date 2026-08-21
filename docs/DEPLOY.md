# Triển khai — ba service trên Railway

Ngày: 2026-08-20

## Kiến trúc

Một repo, ba service Railway độc lập, dùng chung một database Postgres.

```
                       ┌──────────────────────────┐
                       │  Postgres (Railway)      │
                       │  hc_metrics, fleet_trips │
                       │  pending_ai_imports, …   │
                       └───────────▲──────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────┴────────┐      ┌──────────┴────────┐      ┌──────────┴────────┐
│  App chính     │      │  Dashboard Tổ Xe  │      │  Dashboard HC     │
│  Next.js       │─link→│  Streamlit        │      │  Streamlit        │
│  + ingestion   │─link────────────────────────────→                   │
│  + cron        │      └───────────────────┘      └───────────────────┘
└────────────────┘
```

**App chính là Next.js.** Hai dashboard Streamlit là service phụ, chỉ để hiển thị chuyên sâu.
Toàn bộ việc lấy và làm sạch dữ liệu nằm ở ingestion layer trong app chính.

## Vì sao bỏ iframe

Streamlit gửi header chống nhúng và giữ kết nối websocket riêng cho mỗi phiên. Nhúng trong
iframe hay mất session, vỡ layout, và người dùng không dùng được nút back. Mở tab mới ổn định
hơn hẳn — trang `/dashboard/reports/dashboards` gom mọi dashboard về một chỗ, bảng số liệu
Phòng HC hiển thị trong ứng dụng, hai dashboard chuyên sâu mở tab mới.

## Bố cục repo

```
weekly-report-umc/
├── app/, lib/, components/     # Next.js — app chính
│   └── lib/ingestion/          # Ingestion layer: OneDrive, Google Sheets → Postgres
├── prisma/schema.prisma        # Schema dùng chung
├── dashboards/                 # Streamlit — hai dashboard
│   ├── app_toxe.py             # entrypoint Tổ Xe
│   ├── app_phonghc.py          # entrypoint Hành chính (dùng bản v2)
│   ├── dash_toxe.py            # mã dashboard (159KB)
│   ├── dash_phonghc_v2/        # bản Hành chính đang dùng — 13 tab nghiệp vụ
│   ├── dash_phonghc_old.py     # bản cũ, giữ tham chiếu, KHÔNG deploy
│   ├── fleet_cleaning.py       # làm sạch dữ liệu xe (bản Python gốc)
│   ├── fleet_validators.py
│   ├── fleet_evaluation.py     # đánh giá tài xế
│   ├── Dockerfile              # dùng chung cho cả hai dashboard
│   └── railway.json            # trỏ builder + dockerfilePath
├── Dockerfile                  # app chính
└── railway.json                # app chính
```

`fleet_cleaning.py` bản Python vẫn giữ vì dashboard Tổ Xe dùng nó khi đọc dữ liệu.
Bản TypeScript tương ứng (`lib/fleet/cleaning.ts`) dùng cho ingestion — hai bản đã đối chiếu
khớp 36/36 ca, xem `docs/FLEET-PORT-VERIFICATION.md`.

## Thiết lập trên Railway

### Service 1 — App chính (Next.js)

| Mục | Giá trị |
|---|---|
| Root Directory | `/` (mặc định) |
| Config file | `railway.json` |
| Builder | Dockerfile |

Biến môi trường:

```
DATABASE_URL              # Railway tự cấp khi link Postgres
DATABASE_URL_RO           # role chỉ đọc cho chatbot
NEXTAUTH_URL              # https://<app>.railway.app
NEXTAUTH_SECRET
DEEPSEEK_API_KEY
CRON_SECRET                            # bảo vệ /api/cron/sync
ONEDRIVE_DEPT_REPORT_SHARE_URL
ONEDRIVE_HOSPITAL_REPORT_SHARE_URL
GOOGLE_SERVICE_ACCOUNT_JSON            # JSON hoặc base64
DASHBOARD_TO_XE_URL                    # điền sau khi deploy service 2
DASHBOARD_PHONG_HC_OLD_URL             # điền sau khi deploy service 3
```

### Service 2 — Dashboard Tổ Xe

| Mục | Giá trị |
|---|---|
| Root Directory | `dashboards` |
| Config file | *(để trống)* — Railway đọc `dashboards/railway.json` |
| Builder | Dockerfile |
| Custom Start Command | **để trống** |

Biến môi trường:

```
STREAMLIT_SECRETS   # toàn bộ nội dung secrets.toml, dán vào một biến
DASHBOARD_APP=app_toxe.py
PORT=8080
```

### Service 3 — Dashboard Hành chính

Giống service 2, chỉ khác `DASHBOARD_APP=app_phonghc.py`.

Entrypoint này chạy `dash_phonghc_v2/` — bản lấy dữ liệu từ HC OfficeAPI và trực quan hoá
theo 13 tab (văn bản đến/đi, công việc, phòng họp, lịch họp, tổng đài, bãi xe, thư ký,
sự kiện, tổ xe…). Bản `dash_phonghc_old.py` giữ trong repo làm tham chiếu nhưng không deploy.

### Ba cạm bẫy đã gặp khi thiết lập

Ghi lại để lần sau không mất thời gian:

**1. Tên file config tuỳ biến không dùng được.** Đặt `railwayConfigFile` thành
`railway.toxe.json` khiến build fail với thông báo *"service config at 'railway.toxe.json'
not found"*, và log build chỉ có đúng một dòng nên không đoán được. Railway chỉ đọc
`railway.json` / `railway.toml` ở root directory của service.

**2. `rootDirectory` không đổi Dockerfile mặc định.** Đặt `rootDirectory=dashboards` chỉ
giới hạn build context; Railway vẫn dùng `Dockerfile` ở root repo, nên nó build Next.js
(`node:20-alpine`, `COPY prisma`, `npm run build`) rồi fail ở bước cache. Phải khai báo
`dockerfilePath` trong `dashboards/railway.json`.

**3. Custom Start Command làm container chết im lặng.** Đặt `startCommand` trên service sẽ
ghi đè `CMD` của Dockerfile, nhưng Railway bọc chuỗi đó theo cách khác shell — container
khởi động rồi tắt, runtime log chỉ có *"Starting Container"* và HTTP trả 502. Để trống
Custom Start Command, dùng `CMD` trong Dockerfile là chạy được ngay.

### Nối lại

Sau khi hai dashboard chạy, copy URL của chúng vào biến `DASHBOARD_TO_XE_URL` và
`DASHBOARD_PHONG_HC_OLD_URL` của service 1, rồi redeploy service 1.

## Service 4 — Cron đồng bộ

| Mục | Giá trị |
|---|---|
| Root Directory | `cron` |
| Cron Schedule | `0 0 * * *` (07:00 giờ VN — Railway dùng UTC) |
| Restart Policy | NEVER (chạy xong là thoát) |

Biến môi trường:

```
CRON_SECRET     # giống service web
SYNC_URL=https://umc.up.railway.app/api/cron/sync
```

Container chỉ chứa `curl` và `sync.sh`. Script thoát khác 0 khi HTTP lỗi **hoặc** khi
API trả `success:false` — nhờ vậy nguồn dữ liệu hỏng sẽ hiện thành deployment FAILED
thay vì âm thầm trôi qua.

Endpoint chạy tuần tự mọi nguồn đang bật `cronEnabled`, bỏ qua nguồn không đổi nhờ checksum,
và ghi kết quả vào `sync_runs` / `sync_logs`.

Chạy một nguồn: thêm `?source=<slug>`. Chạy lại kể cả khi nguồn không đổi: thêm `&force=1`.

## Chạy trên máy cá nhân

```bash
# App chính
npm install
npx prisma generate
npx prisma db push
npm run dev                    # http://localhost:3000

# Dashboard (mỗi cái một terminal)
pip install -r dashboards/requirements.txt
streamlit run dashboards/app_toxe.py --server.port 8501
streamlit run dashboards/app_phonghc.py --server.port 8502
```

Rồi đặt trong `.env`:

```
DASHBOARD_TO_XE_URL="http://localhost:8501"
DASHBOARD_PHONG_HC_OLD_URL="http://localhost:8502"
```

Dashboard cần `dashboards/.streamlit/secrets.toml` (file này đã gitignore — copy từ repo
Streamlit cũ sang).

## Hiệu năng ingestion

Bản đầu dùng `upsert` từng dòng: 14.000 chuyến mất **271s**, sát giới hạn
`maxDuration = 300s` của route. Đổi sang lọc trước rồi `createMany` đưa xuống **2s**.

Lý do lọc trước được: dữ liệu nguồn là bản ghi lịch sử, tài xế không sửa chuyến đã
nhập — chuyến cùng `sourceRowHash` chắc chắn giống hệt bản đã lưu.

## Quy tắc ghi dữ liệu: chỉ thêm mới

Không nguồn nào ghi đè dữ liệu đã lưu.

| Nguồn | Khoá nhận biết | Khi nguồn đổi giá trị |
|---|---|---|
| Đội xe | `sourceRowHash` (xe + tài xế + ngày + giờ + điểm đến) | Không xảy ra — chuyến đã nhập không sửa |
| Báo cáo phòng | `(danh mục, nội dung, năm, tuần)` | **Giữ số cũ**, ghi cảnh báo vào `SyncLog` |
| Báo cáo bệnh viện | `(nguồn, năm, tuần)` | Chỉ làm mới bản `PENDING`; bản đã duyệt giữ nguyên |

Lý do giữ số cũ ở báo cáo phòng: số liệu đã nạp coi như đã chốt. Nếu ai đó sửa nhầm file
Excel nguồn, hệ thống không âm thầm sửa theo. Muốn áp dụng số mới thì sửa trực tiếp trong
hệ thống — và cảnh báo trong `SyncLog` cho biết chính xác dòng nào lệch.

## Trang quản trị đồng bộ

`/dashboard/data-sync`:

- **Thẻ từng nguồn** — trạng thái, lần chạy cuối, nút *Chạy ngay* / *Buộc chạy lại*,
  công tắc bật/tắt lịch tự động. Cảnh báo vàng khi quá 36 giờ chưa đồng bộ thành công.
- **Lịch sử 20 lần chạy** — bấm *Chi tiết* để xem toàn bộ `SyncLog` của lần đó.
- **Tuần chờ duyệt** — báo cáo bệnh viện đang ở trạng thái `PENDING`.
- **Nhập liệu thủ công** — panel upload Excel giữ làm dự phòng, nay ghi thẳng vào
  `hc_metrics` (trước đây đẩy JSON lên GitHub) và cũng theo quy tắc chỉ-thêm-mới.

## Việc chưa làm

- **HC OfficeAPI** chưa có connector (`cronEnabled = false`). API chỉ gọi được từ mạng
  nội bộ nên phải giữ GitHub làm cầu; xem `docs/INGESTION-REFACTOR.md` mục 3.4.
- **Dashboard Streamlit không có đăng nhập riêng** — theo yêu cầu, vì người dùng đã đăng
  nhập ở app chính trước khi bấm sang. Lưu ý: ai biết URL vẫn mở trực tiếp được.
