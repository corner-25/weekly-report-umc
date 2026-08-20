# Connector đội xe — Google Sheets → Postgres

Ngày: 2026-08-20

## Thay đổi so với hiện trạng

| | Trước | Sau |
|---|---|---|
| Luồng | Google Sheets → `manual_fleet_sync.py` → GitHub `vehicle-storage` → `/api/fleet-data` | Google Sheets → connector → Postgres |
| Kích hoạt | Bấm nút trong `dash_toxe.py` | Cron hằng ngày |
| Lưu trữ | File JSON trên GitHub | Bảng `fleet_trips` |
| Làm sạch | `fleet_cleaning.py` (Python) | `lib/fleet/cleaning.ts` (đã port, 56/56 ca khớp) |

GitHub bị loại khỏi luồng này vì Sheets API gọi được từ Railway. Khác với HC OfficeAPI —
cái đó bắt buộc giữ GitHub làm cầu vượt tường lửa.

## Xác thực

Service account `vehicle-dashboard@ivory-haven-463209-b8.iam.gserviceaccount.com`.

`fetchers/google-sheets.ts` tự ký JWT bằng `crypto` của Node rồi đổi lấy access token,
**không cần thư viện `googleapis`** (~15MB) chỉ để đọc vài sheet.

Biến môi trường `GOOGLE_SERVICE_ACCOUNT_JSON` nhận cả JSON thô lẫn base64 — Railway đôi khi
làm hỏng chuỗi nhiều dòng, base64 tránh được chuyện đó.

## Bảng `fleet_trips`

Nguồn không có ID ổn định nên khoá là `sourceRowHash` = SHA-256 của
`(xe, tài xế, ngày, giờ bắt đầu, giờ kết thúc, điểm đến)`. Đây cũng chính là định nghĩa
"nghi trùng" của bản Python, nên chuyến trùng ghi đè nhau thay vì nhân bản.

Ba cột đánh dấu cần người rà soát, **không chặn đồng bộ**:
- `durationSuspicious` — giờ lái > 16h, nhiều khả năng nhầm giờ bắt đầu/kết thúc
- `isDuplicate` — nghi trùng, chỉ đánh dấu không xoá (giữ hành vi của bản Python)
- `distanceFixMethod` — `NONE` | `ODO_DELTA` | `ESTIMATED_FROM_HOURS` | `UNFIXABLE`

## Kiểm chứng parser

Chạy trên dữ liệu dựng theo đúng cấu trúc Google Form thật, phủ các ca biên:

| Ca kiểm | Kết quả |
|---|---|
| Chuyến bình thường | ✅ |
| Dòng trống của Sheets (chỉ có giá trị rác `-293769`) | ✅ bị loại, không tính là lỗi |
| Chuyến qua đêm `22:00 → 02:00` | ✅ 4.0 giờ |
| Quãng đường rác `-5000` km | ✅ sửa thành 25km bằng delta odometer |
| Tên tài xế là email | ✅ tra bảng → "Văn Thảo" |
| Chuyến trùng khít | ✅ đánh dấu `isDuplicate`, không xoá |
| Giờ lái 17.5h | ✅ đánh dấu `durationSuspicious` |
| Thiếu `Ngày ghi nhận`, có `Timestamp` | ✅ fallback đúng |
| Thiếu cả hai | ✅ bị loại kèm lý do trong `SyncLog` |
| Phân loại xe theo biển số | ✅ Hành chính / Cứu thương |
| Chuẩn hoá điểm đến `quận 5`, `TPHCM`, `gò vấp` | ✅ `Q.5`, `TP. HCM`, `Gò Vấp` |

### Một lỗi múi giờ đã phát hiện và sửa

Bản đầu dùng `new Date(year, month, day)` — tạo mốc nửa đêm **giờ máy chủ**. Với
`TZ=Asia/Saigon`, ngày `5/1/2026` lưu vào Postgres (`timestamptz`) thành `2026-04-30T17:00Z`,
tức **lùi một ngày**. Mọi báo cáo theo ngày và theo tuần sẽ lệch mà rất khó nhận ra.

Đã sửa: luôn dựng bằng `Date.UTC(...)`. Kiểm chứng lại: `5/1/2026` → `2026-05-01`.

## Chạy thật end-to-end — đã kiểm chứng (2026-08-20)

### Kết nối Google Sheets

Đọc thành công **15 sheet (xe)**, 14.105 dòng thô. Parse hết 211ms.

**Phát hiện 1: có 15 xe, không phải 13.** Hai xe mới `50A-032.81`, `50A-032.80` chưa có trong
bảng phân loại của bản Python nên mặc định thành "Cứu thương" — **cần người vận hành xác nhận**
đây là xe cứu thương hay hành chính, rồi bổ sung vào `ADMIN_VEHICLES` nếu cần.

**Phát hiện 2: spreadsheet có BA biến thể header** với thứ tự cột khác nhau:

| Biến thể | Số xe | Đặc điểm |
|---|---|---|
| 1 | 2 (xe mới) | Không có "Chi tiết chuyến xe", "Doanh thu" |
| 2 | 5 (hành chính) | "Ngày ghi nhận" ở vị trí khác |
| 3 | 8 (cứu thương) | Đủ cột, có "Doanh thu" |

Parser ghép theo **tên cột** nên thứ tự không ảnh hưởng. Nhưng tên cột thật khác với
`COLUMN_MAPPING` cũ, đã sửa: `'Đổ nhiên liệu'` → `'Đổ nhiên liệu (Số lít)'`,
`'Nội thành/ngoại thành'` → `'Nội thành/Ngoại thành'`. Mỗi tên khai báo nhiều biến thể để
chịu được thay đổi nhãn Form trong tương lai.

### Đối chiếu với bản Python

| Mốc | Số chuyến |
|---|---|
| Python sync 2026-05-21 08:26 | 11.107 |
| TS hôm nay, ≤ 21/05, **15 xe** | 11.140 |
| TS hôm nay, ≤ 21/05, **13 xe Python biết** | 11.122 |

Chênh 33, **đã truy nguyên trọn vẹn**:
- **18 chuyến** của 2 xe mới mà Python chưa biết
- **15 chuyến** còn lại nằm trong **28 chuyến nhập bù**: Python sync lúc **08:26 sáng**,
  tài xế tiếp tục nhập chuyến cùng ngày lúc 15:33, 17:20, 22:28… Python không thể thấy.

Không có sai lệch nào do lỗi parser.

### Ghi vào database

| Lần | Trigger | Kết quả | Ghi | Bỏ qua | Thời gian |
|---|---|---|---|---|---|
| 1 | manual | SUCCESS | 14.084 | 27 | 13.617ms |
| 2 | cron | **SKIPPED** | 0 | 0 | 2.187ms |
| 3 | manual (force) | SUCCESS | 14.084 | 27 | 13.640ms |

Sau hai lần ghi đầy đủ, bảng vẫn đúng **14.084 bản ghi**, **0 trùng `sourceRowHash`**.
Khoảng ngày `2025-04-24 00:00:00` → `2026-08-20 00:00:00` — giờ tròn `00:00`, xác nhận
bug múi giờ đã được xử lý.

27 dòng bỏ qua = 13 dòng trống của Sheets + 1 dòng thiếu ngày ghi nhận + 13 chuyến nghi trùng.

### Cờ cần người rà soát

| Cờ | Số lượng |
|---|---|
| Giờ lái > 16h (nghi nhầm start/end) | 23 |
| Nghi trùng đã bỏ (giữ bản đầu) | 14 |
| Quãng đường sửa bằng delta odometer | 58 |
| Quãng đường suy từ giờ × vận tốc TB | 439 |
| Không sửa được quãng đường | 0 |

## Một lỗi thiết kế đã phát hiện và sửa

Bản đầu ghi **cả hai** chuyến nghi trùng với `isDuplicate=true` trên bản sau. Nhưng vì
`sourceRowHash` là khoá duy nhất, bản sau **ghi đè lên bản đầu** — làm mất bản gốc và khiến
số bản ghi trong DB (14.083) lệch số parser báo (14.097).

Bản Python dùng `keep='first'`: giữ bản đầu, chỉ đánh dấu bản sau. Đã sửa cho khớp: bỏ bản
trùng khỏi danh sách ghi, đếm riêng vào `duplicatesDropped` và ghi cảnh báo vào `SyncLog`.
Cột `isDuplicate` bị loại khỏi schema vì không còn ý nghĩa.

## Việc còn lại cho người vận hành

1. **Xác nhận loại 2 xe mới** `50A-032.81`, `50A-032.80` — hiện mặc định "Cứu thương".
2. **Rà soát 23 chuyến giờ lái > 16h** và **14 chuyến nghi trùng** (xem `sync_logs`).
