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
hơn hẳn — trang `/dashboard/reports/phong-hc` giờ là trang thẻ liên kết.

## Bố cục repo

```
weekly-report-umc/
├── app/, lib/, components/     # Next.js — app chính
│   └── lib/ingestion/          # Ingestion layer: OneDrive, Google Sheets → Postgres
├── prisma/schema.prisma        # Schema dùng chung
├── dashboards/                 # Streamlit — hai dashboard
│   ├── app_toxe.py             # entrypoint Tổ Xe
│   ├── app_phonghc.py          # entrypoint Hành chính
│   ├── dash_toxe.py            # mã dashboard (159KB)
│   ├── dash_phonghc_old.py     # mã dashboard (141KB)
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

## Lịch chạy đồng bộ

Tạo thêm một **Cron Service** trên Railway trỏ vào app chính:

```bash
curl -fsS -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://<app>.railway.app/api/cron/sync"
```

Lịch đề xuất: `0 23 * * *` (06:00 giờ VN — Railway dùng UTC).

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

## Việc chưa làm

- Hai dashboard vẫn đọc dữ liệu từ GitHub (`vehicle-storage`, `dashboard-storage`).
  Sau khi ingestion chạy ổn định, chuyển chúng sang đọc thẳng Postgres.
- Chưa có đăng nhập cho dashboard Streamlit — hiện ai có URL đều xem được.
  Cân nhắc bật xác thực ở tầng Railway hoặc thêm mật khẩu trong Streamlit.
