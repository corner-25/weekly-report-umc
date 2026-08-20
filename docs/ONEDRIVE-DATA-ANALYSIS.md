# Phân tích dữ liệu OneDrive

Ngày: 2026-08-20. Đã tải và phân tích trực tiếp cả hai workbook.

## Cách tải file — đã kiểm chứng

Share link "Anyone with the link" của SharePoint **tải được không cần xác thực**, nhưng
phải dùng đúng endpoint:

```
✅ https://<tenant>-my.sharepoint.com/personal/<user>/_layouts/15/download.aspx?share=<SHARE_ID>
❌ https://api.onedrive.com/v1.0/shares/u!<base64>/root/content   → 308 "User migrated"
❌ https://graph.microsoft.com/v1.0/shares/u!<base64>/root/content → 401 (cần token)
❌ <share-url>?download=1                                          → 302 sang login.microsoftonline.com
```

`<SHARE_ID>` là đoạn cuối của share link, phần sau dấu `/` cuối và trước `?e=`.
Ví dụ với `.../IQDDnTgZVRjUSLty54iRnLlMAXG64RSoBz9hVjNi0JaK9oE?e=Xwo1pw`
thì `SHARE_ID = IQDDnTgZVRjUSLty54iRnLlMAXG64RSoBz9hVjNi0JaK9oE`.

Kết quả: `dept.xlsx` 154KB, `hosp.xlsx` 1.05MB, cả hai đúng định dạng xlsx.

## Workbook 1 — Báo cáo phòng (154KB, 3 sheet)

| Sheet | Kích thước | Dùng để ingest? |
|---|---|---|
| **`Số liệu tuần (2026)`** | 2.279 dòng × 14 cột | ✅ **Đây là dữ liệu cần lấy** |
| `BC tuan` | 80 × 41 | ❌ Ma trận tuần theo cột, dạng trình bày |
| `Ke hoach 2026` | 58 × 17 | ❌ Kế hoạch năm, không phải số liệu tuần |

### Cấu trúc `Số liệu tuần (2026)`

Header dòng 1: `Tuần | Tháng | Danh mục | Nội dung | Số liệu`

**Chất lượng dữ liệu rất tốt:**
- 2.278 dòng dữ liệu, **0 dòng trùng khoá** `(Tuần, Danh mục, Nội dung)`
- **Có cột Tháng** (khác mô tả ban đầu), và tuần→tháng **nhất quán tuyệt đối**:
  tuần 1–5→T1, 6–9→T2, 10–13→T3, 14–18→T4, 19–22→T5, 23–26→T6, 27–31→T7, 32–34→T8
- 0 dòng thiếu Tuần hoặc Tháng
- Tuần 1–34, năm 2026, 12 danh mục

**Ba điểm cần parser xử lý:**

1. **545 dòng `Số liệu` rỗng** (24%) — chưa nhập, không phải lỗi.
   Xử lý: bỏ qua, **không** ghi 0 (0 và "chưa có số liệu" khác nhau về nghĩa).
2. **3 giá trị không phải số**: `'5074,1'`, `'3323,1'` (dấu phẩy thập phân kiểu VN), `'/'` (không áp dụng).
   Xử lý: `,`→`.` rồi ép số; `/` coi như rỗng.
3. **6 ô rác ở cột 12–13** — chỉ chứa khoảng trắng. Xử lý: chỉ đọc 5 cột đầu.

### Khoá nghiệp vụ

`(Danh mục, Nội dung, Năm, Tuần)`. Năm lấy từ tên sheet `Số liệu tuần (2026)`.
`Tháng` đọc thẳng từ file thay vì suy từ tuần ISO — dữ liệu đã có sẵn và nhất quán.

## Workbook 2 — Báo cáo bệnh viện (1.05MB, 33 sheet)

Mỗi sheet là một tuần, tên dạng `<tuần>.<năm>`: `01.2026` … `34.2026`.
Thiếu tuần 08; có `29.2026 ` (thừa dấu cách cuối — parser phải `.trim()`).

**Cả 33 sheet cùng một layout**, đã kiểm tra từng sheet:
- Dòng 1–5: tiêu đề
- **Dòng 6: header** `Stt | Nhiệm vụ phải làm theo kế hoạch | Kết quả thực hiện | Thời gian thực hiện | Tiến độ (%) | Kế hoạch tuần <n+1>/<năm>`
- Dòng 7+: dữ liệu, nhóm theo phòng ban (dòng phòng ban viết HOA ở cột A)
- 221–239 dòng mỗi sheet, 14 phòng ban

### Khớp thẳng với schema đã có

Layout này **ánh xạ 1-1 với `WeekTaskProgress`** trong schema hiện tại:

| Cột Excel | Trường DB |
|---|---|
| Nhiệm vụ phải làm theo kế hoạch | `MasterTask.name` |
| Kết quả thực hiện | `WeekTaskProgress.result` |
| Thời gian thực hiện | `WeekTaskProgress.timePeriod` |
| Tiến độ (%) | `WeekTaskProgress.progress` |
| Kế hoạch tuần sau | `WeekTaskProgress.nextWeekPlan` |
| Dòng phòng ban HOA | `Department.name` |

14 phòng ban: KHTH, Điều dưỡng, KH&ĐT, QLCL, Hành chính, TCCB, CNTT, CTXH,
Quản trị toà nhà, TCKT, BHYT, Vật tư thiết bị, TT Truyền thông, ĐV Quản lý đấu thầu.

**Hệ quả quan trọng:** vì cấu trúc rõ ràng như vậy, phần lớn nội dung **không cần AI**.
Parser đọc trực tiếp được. AI chỉ cần cho việc khớp tên nhiệm vụ tự do với `MasterTask`
đã có trong DB — đúng việc `/api/import/ai-match` đang làm.

Vẫn giữ bước người duyệt qua `PendingAiImport` + `AiReportImportPanel`: 33 tuần × 14 phòng
là lượng lớn, ghi thẳng mà sai thì hỏng nhiều.

## Đối chiếu parser TypeScript với dữ liệu thật

Chạy `parseDeptReport()` trên chính file tải từ share link, so với số đo độc lập bằng Python/openpyxl:

| Hạng mục | Python đo | Parser TS | Khớp |
|---|---|---|---|
| Tổng dòng có nội dung | 2.278 | — | — |
| Ô Số liệu là số | 1.730 | (nằm trong 1.732) | ✅ |
| Chuỗi ép được sang số | 2 (`'5074,1'`, `'3323,1'`) | (nằm trong 1.732) | ✅ |
| **Dòng hợp lệ** | **1.732** | **1.732** | ✅ |
| Ô trống | 545 | 545 | ✅ |
| Giá trị `'/'` | 1 | 1 | ✅ |
| Dòng bị loại | 0 | 0 | ✅ |
| **Cộng lại** | **1.730+545+3 = 2.278** | ✅ không mất dòng nào |

Khoá `(Danh mục, Nội dung, Năm, Tuần)`: **1.732/1.732 duy nhất**, không trùng.

### Hai điểm nhìn qua tưởng lệch, thật ra đúng

**Tuần cao nhất là 33, không phải 34.** Tuần 34 có 67 dòng trong file nhưng *toàn bộ ô Số liệu
đều trống* — chưa ai nhập. Parser bỏ qua là đúng: ghi 0 vào đó sẽ tạo ra số liệu giả, và biểu đồ
sẽ hiển thị tuần 34 tụt về 0 thay vì "chưa có dữ liệu".

**1.732 > 1.730.** Chênh 2 là hai giá trị dấu phẩy thập phân kiểu VN được ép số thành công
(`'5074,1'` → `5074.1`). Đây là hành vi mong muốn.

## Chạy thật end-to-end — đã kiểm chứng

Chạy toàn bộ luồng `OneDrive → fetch → parse → upsert → Postgres` trên database thật:

| Lần chạy | Trigger | Kết quả | Ghi | Bỏ qua | Thời gian |
|---|---|---|---|---|---|
| 1 | manual | SUCCESS | 1.732 | 546 | 1.653ms |
| 2 | cron | **SKIPPED** | 0 | 0 | 408ms |
| 3 | manual (force) | SUCCESS | 1.732 | 546 | 1.417ms |

Ba tính chất quan trọng đều đạt:

- **Idempotent**: sau hai lần ghi đầy đủ, bảng vẫn đúng **1.732 dòng**, không nhân đôi.
  Truy vấn kiểm tra trùng khoá `(category, content, year, week)` trả về rỗng.
- **Bỏ qua khi nguồn không đổi**: lần 2 nhận cùng checksum → SKIPPED, không đụng database.
  Chỉ mất 408ms so với 1.653ms.
- **Có vết**: `sync_runs` ghi đủ 3 lần chạy, `sync_logs` ghi từng bước bằng tiếng Việt.

Dữ liệu trong DB khớp file nguồn: 12 danh mục, tuần 1–33, giá trị `'5074,1'` → `5074.1`.

---

# Báo cáo bệnh viện — phân tích chi tiết & kết quả

## Cấu trúc (kiểm chứng toàn bộ 33 sheet)

- Tên sheet `<tuần>.<năm>`: `01.2026`…`34.2026`. **Thiếu tuần 08**; sheet `29.2026 ` thừa dấu cách.
- **Cả 33 sheet cùng layout**: header ở dòng 6, dữ liệu từ dòng 7.
- Cột: `Stt | Nhiệm vụ | Kết quả thực hiện | Thời gian | Tiến độ (%) | Kế hoạch tuần n+1`
- Dòng phòng ban: cột A viết HOA toàn bộ, ≥6 ký tự — quy tắc này nhận đúng 14/14 phòng
  trên mọi sheet, không nhầm với `Stt` hay số thứ tự.
- **14 phòng ban** mỗi sheet, trừ sheet `16.2026` chỉ có 13 (thiếu Phòng Vật tư Thiết bị —
  thực tế trong file, không phải lỗi parser).
- ~200–242 nhiệm vụ mỗi tuần, **tổng 7.389 nhiệm vụ**.

## Cột "Tiến độ (%)" — bốn định dạng lẫn lộn

| Dạng trong file | Số lượng | Ví dụ | Chuẩn hoá thành |
|---|---|---|---|
| Số nguyên | 2.693 | `1` | `100` (Excel lưu % dạng phân số) |
| Số thực | 1.212 | `0.996` | `99.6` |
| Chuỗi có `%` | ~105 | `'100%'`, `'99,7%'`, `'40%%'` | `100`, `99.7`, `40` |
| Chuỗi mô tả | 2 | `'Đang xử lý'` | `null` |

`parseProgress()` xử lý cả bốn, kể cả `'40%%'` (lỗi gõ hai dấu %) và dấu phẩy thập phân VN.

## Đối chiếu parser TypeScript

| Hạng mục | Python đo | Parser TS | Khớp |
|---|---|---|---|
| Sheet đọc được | 33 | 33 | ✅ |
| **Tổng nhiệm vụ** | **7.389** | **7.389** | ✅ |
| Sheet 17 | 217 | 217 | ✅ |
| Phòng ban/sheet | 14 (sheet 16: 13) | 14 (sheet 16: 13) | ✅ |

## Khớp phòng ban với database

Excel viết HOA đầy đủ, DB lưu tên rút gọn — cần ba tầng khớp:

| Cách khớp | Số phòng | Ví dụ |
|---|---|---|
| `NORMALIZED` (bỏ dấu) | 6 | `PHÒNG HÀNH CHÍNH` → `Phòng Hành chính` |
| `ALIAS` (bảng tay) | 2 | `PHÒNG QUẢN LÝ CHẤT LƯỢNG BỆNH VIỆN` → `Phòng QLCL BV` |
| `NONE` (chưa có trong DB) | 6 | `PHÒNG CÔNG NGHỆ THÔNG TIN`, `TRUNG TÂM TRUYỀN THÔNG`… |

**8/14 khớp tự động.** 6 phòng còn lại thực sự chưa tồn tại trong `departments` — connector
ghi cảnh báo kèm danh sách tên vào `SyncLog` thay vì tự tạo, vì tạo Department là quyết định
nghiệp vụ của người dùng.

## Chạy thật end-to-end

| Lần | Trigger | Kết quả | Tuần xếp hàng | Thời gian |
|---|---|---|---|---|
| 1 | manual | SUCCESS | 33 | 3.257ms |
| 2 | cron | **SKIPPED** | 0 | — |
| 3 | manual (force) | SUCCESS | 33 | — |

Sau hai lần ghi đầy đủ vẫn đúng **33 bản ghi** `pending_ai_imports`, không nhân đôi.
`rawText` mỗi tuần ~60–68KB, giữ nguyên cấu trúc `## <PHÒNG BAN>` → danh sách nhiệm vụ
để prompt AI có ngữ cảnh khớp `MasterTask` theo đúng phòng.

## Ranh giới an toàn đã cài

- **Không ghi thẳng** vào `Week`/`WeekTaskProgress`. Chỉ tạo `PendingAiImport` trạng thái `PENDING`.
- **Tuần đã có báo cáo chính thức** (`Week` tồn tại) → bỏ qua, không xếp hàng lại, tránh
  người dùng lỡ duyệt đè lên dữ liệu đã chốt.
- **Bản ghi đã `APPROVED`/`REJECTED`** → chỉ cập nhật `rawText`, giữ nguyên trạng thái,
  không xoá quyết định của người dùng.
