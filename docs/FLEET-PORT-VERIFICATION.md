# Kiểm chứng port fleet_cleaning.py → lib/fleet/cleaning.ts

Ngày: 2026-08-20

Logic làm sạch dữ liệu Tổ Lái Xe đã tinh chỉnh qua nhiều vòng thực tế. Port sang TypeScript
phải giữ nguyên hành vi, nếu không số liệu mới sẽ lệch số liệu cũ mà không ai phát hiện.

Phương pháp: chạy cùng bộ đầu vào qua cả hai bản, so từng kết quả.

## Kết quả

| Hàm | Số ca | Kết quả |
|---|---|---|
| `parse_clock_to_minutes` | 11 | ✅ khớp |
| `compute_driving_hours` | 6 | ✅ khớp |
| `classify_work_category` | 10 | ✅ khớp |
| `normalize_destination` | 11 | ✅ khớp |
| `fix_driver_name_from_email` | 6 | ✅ khớp |
| `infer_area_type` | 4 | ✅ khớp |
| `fix_distance_outliers` | 8 | ✅ khớp |
| **Tổng** | **56** | **✅ khớp 100%** |

## Ca biên đã kiểm

Không chỉ ca thường — các ca dễ sai nhất đều có mặt:

- `12:40 AM` → 40 phút, đúng bug đã biết của cột 'Thời gian' mà `compute_driving_hours` sinh ra để tránh
- `22:00 → 02:00` → 4.0 giờ (chuyến qua đêm, cộng 24h)
- `q5` → `Q.5`, không bị quy tắc TPHCM nuốt mất (thứ tự regex có ý nghĩa)
- `-293769` km → sửa được bằng delta odometer (giá trị rác thật, lấy từ comment trong code Python)
- Email không có trong bảng → `Không xác định`
- Xe không có timestamp → vẫn xử lý được, không crash
- Giờ lái null + quãng đường null → `UNFIXABLE`, giữ null cho người rà soát

## Cách chạy lại

Script kiểm chứng nằm trong scratchpad của phiên làm việc (không commit vì là công cụ tạm).
Cách dựng lại: xuất kết quả hai bản ra JSON với cùng đầu vào, rồi so từng phần tử.

## Còn lại

Kiểm chứng này ở mức **hàm**. Còn một bước nữa ở mức **toàn bộ dữ liệu**: chạy connector
trên spreadsheet thật, so với `fleet_data_latest.json` trên `vehicle-storage`
(11.107 chuyến, 13 xe, sync ngày 2026-05-21). Bước đó cần credentials Google service account.

---

# Port lại từ bản Streamlit mới (2026-08-20)

## Vì sao phải port lại

Bản `fleet_cleaning.py` dùng cho lần port đầu nằm ở `~/Desktop/UMC-APP/PHONGHC/umc-dashboard`
là **bản cũ**. Bản đang dùng thật ở
`~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/umc-dashboard` mới hơn nhiều:

| File | iCloud (đang dùng) | Desktop (cũ) |
|---|---|---|
| `fleet_cleaning.py` | 31KB | 19KB |
| `dash_toxe.py` | 159KB | 143KB |
| `fleet_evaluation.py` | có | không |
| `fleet_validators.py` | có | không |
| `fleet_sync_service.py` | có | không |

## Thay đổi lớn nhất: cách tính giờ lái

`compute_driving_hours` đã được nâng cấp căn bản:

| Trường hợp | Bản cũ | Bản mới |
|---|---|---|
| `end < start` | Luôn +24h | Phân biệt theo cờ AM/PM |
| Cùng AM hoặc cùng PM | — | **+12h** — gõ nhầm, không phải qua đêm |
| Khác AM/PM hoặc 24h | — | +24h — qua đêm thật |
| Kiểm tra chéo bằng km | không | có — giới hạn giờ khi km nhỏ |
| Trả về | số giờ | giờ + `confidence` + `method` |

Ví dụ `8:00 AM → 3:00 AM`: bản cũ tính **19 giờ**, bản mới tính **7 giờ**
(cùng AM nên là 3:00 PM). Nếu chuyến chỉ 10km, còn cap tiếp xuống **3 giờ**.

## Ba hàm mới đã port thêm

| Hàm | Việc |
|---|---|
| `parseClockWithAmpm` | Trả kèm cờ AM/PM để phân biệt hai loại lỗi trên |
| `parseFuelLiters` | Ô nhiên liệu tài xế nhập tự do: `"50lx-km 520121"`, `"60/20500"`, `"Không"`, `"Cb ccuu"` |
| `estimateHoursFromKm` | Ước giờ từ km khi thiếu giờ (25/45 km/h — khác 30/50 của `fixDistanceOutliers`) |

Thêm quy tắc lọc mới: **dòng không có danh tính người nhập** (thiếu cả email lẫn tên tài xế)
bị loại, vì chuyến không có chủ thì không quy trách nhiệm và không thống kê theo tài xế được.

## Đối chiếu Python ↔ TypeScript

**36/36 trường hợp khớp tuyệt đối**, gồm mọi nhánh của logic mới:

| Ca kiểm | Kết quả |
|---|---|
| `8:00 → 17:00` | 9h, `normal` |
| `22:00 → 2:00` | 4h, `overnight` |
| `8:00 AM → 3:00 AM` | 7h, `fixed_ampm` |
| `8:00 AM → 3:00 AM` + 10km | 3h, `fixed_ampm_km_capped` |
| `1:00 PM → 11:00 AM` | 22h, `overnight_suspicious` |
| `10:00 PM → 6:00 AM` + 150km | 8h, `overnight`, tin cậy **high** |
| `7:00 → 7:00` + 40km | 0.89h, `estimated_zero_diff` |
| Thiếu giờ + 60km | 1.33h, `estimated_no_time` |
| `parseFuelLiters` × 21 kiểu nhập | tất cả khớp |

## Kết quả trên dữ liệu thật

| Chỉ số | Logic cũ | Logic mới |
|---|---|---|
| Chuyến hợp lệ | 14.084 | 14.082 |
| Chuyến > 16h (nghi sai) | 23 | **9** |
| Chuyến sửa được nhầm AM/PM | 0 | **17** |
| Chuyến ước giờ từ km | 0 | **7** |
| Dòng không rõ người nhập | giữ | **loại 3** |

Phân bố phương pháp: `normal` 13.642 · `overnight` 409 · `fixed_ampm` 10 ·
`fixed_ampm_km_capped` 7 · `estimated_zero_diff` 7 · `overnight_suspicious` 4 · `overnight_long` 3

Độ tin cậy: **high** 9.153 · medium 4.918 · low 11

Tổng giờ lái: 24.142h · Nhiên liệu: 1.211 chuyến có đổ, tổng 53.092 lít

Hai cột mới trong `fleet_trips`: `durationConfidence`, `durationMethod` — để dashboard lọc
theo mức tin cậy và người vận hành truy vết cách tính.
