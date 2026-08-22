# Audit chỉ số định lượng

Ngày: 2026-08-22 · Phạm vi: toàn bộ 6.053 metric của 21 tuần

## Tổng quan

| Chỉ số | Giá trị |
|---|---|
| Tổng metric | 6.053 |
| Tên khác nhau | 1.829 |
| Tin cậy < 0,7 | 1 |
| Giá trị âm | 0 |
| Giá trị = 0 | 234 (hợp lệ — "0 gói thầu thông qua") |

Chất lượng tổng thể tốt. Ba vấn đề thật, xếp theo mức nghiêm trọng.

## 1. NGHIÊM TRỌNG — Đơn vị tiền tệ không đồng nhất

| Đơn vị | Số metric | Giá trị TB |
|---|---|---|
| `VND` | 420 | 26.686.858.593 |
| `đồng` | 185 | 3.378.345.681 |
| `tỷ đồng` | 9 | 1.244 |
| `triệu đồng` | 7 | 103 |

Bốn cách ghi cho cùng một đơn vị, và **hai cách sau lưu giá trị ở thang khác hẳn**:

```
"Tiếp nhận tài trợ 500 triệu đồng"        → value = 500      (thực: 500.000.000)
"tổng giá trị hơn 3.097 tỉ"               → value = 3097     (thực: 3.097.000.000.000)
"Tổng giá trị trúng thầu: 3.825.534.508.940 VND" → value = 3825534508940  ✓
```

**Hệ quả:** cộng gộp hay so sánh các metric tiền tệ cho ra số vô nghĩa. Một khoản
3.097 tỷ trông nhỏ hơn một khoản 500 triệu ghi bằng VND.

**Đã sửa:** chuẩn hoá về `VND` bằng cách nhân hệ số, xem mục "Đã xử lý".

## 2. Metric luỹ kế thiếu mốc thời gian

**301/602 metric** `CUMULATIVE` không có `asOfDate`.

```
"Luỹ kế công việc đã giải quyết từ đầu năm: 1.315"   → không biết tính đến ngày nào
"Tồn đọng lũy kế, chưa giải quyết: 4"
```

Không phải lỗi trích xuất — **văn bản gốc không nêu ngày**. Nhưng khi so sánh giữa
các tuần thì không biết mốc, dễ hiểu nhầm.

**Khắc phục:** với metric luỹ kế thiếu ngày, lấy ngày cuối tuần báo cáo làm mốc mặc
định. Đã ghi vào prompt v3 để lần sau AI tự suy.

## 3. Tên chỉ số chưa chuẩn hoá

**8 nhóm** cùng một chỉ số nhưng viết hai kiểu:

| Chỉ số | Số biến thể | Lần xuất hiện |
|---|---|---|
| Đi đào tạo nước ngoài ≥10 ngày | 2 | 42 |
| Hồ sơ bệnh án kiểm tra tiếp nhận | 2 | 21 |
| Số lượt KCB BHYT nội trú | 2 | 20 |
| Chi phí KCB BHYT thanh toán nội trú | 2 | 20 |

Ảnh hưởng: nhóm theo tên sẽ tách một chỉ số thành hai đường trên biểu đồ.

**Chưa xử lý** — cần bảng ánh xạ tên chuẩn, giống `aliases` của `MasterTask`.
Đề xuất làm ở bước sau khi biết chỉ số nào thực sự cần theo dõi lâu dài.

## 4. Trùng lặp còn sót

15 nhóm (cùng tuần + phòng + tên + giá trị). Nguyên nhân: một ô kết quả nhắc lại
cùng số liệu ở hai chỗ. Không sai dữ liệu, nhưng làm đếm lệch.

## Không phải lỗi — đã kiểm chứng

**13 metric có `%` > 100:** đều là tỷ lệ tăng trưởng hợp lệ.
```
"tăng 272% so với tuần 08"   ✓ đúng
"tăng 916% so với 08"        ✓ đúng
```

**2 metric > 1.000 tỷ:** đều đúng, là tổng giá dự toán đấu thầu cả năm.

**262 metric thiếu đơn vị:** phần lớn là số đếm không có đơn vị tự nhiên
("Định mức lao động: 4300"). Chấp nhận được.

**234 metric = 0:** hợp lệ, ví dụ "0 gói thầu Hội đồng thông qua tuần này".

## Đã xử lý

| Việc | Kết quả |
|---|---|
| Xoá metric mô tả quy mô văn bản | 46 |
| Chuẩn hoá đơn vị tiền tệ về VND | xem mục 1 |
| Prompt v3: cấm trích số mô tả quy mô | đã cập nhật |
| Prompt v3: luỹ kế thiếu ngày → lấy cuối tuần | đã cập nhật |

---

# Audit tiến độ nhiệm vụ

Phạm vi: 1.728 bản ghi tiến độ của 21 tuần.

## Không có lỗi kỹ thuật

| Kiểm tra | Kết quả |
|---|---|
| Tiến độ âm | 0 |
| Tiến độ > 100% | 0 |
| Tiến độ thiếu | 852 — **hợp lệ**, xem dưới |

**852 bản ghi thiếu tiến độ:** 829 cái do **văn bản gốc không nêu %** — phòng ban
chỉ viết mô tả công việc. 23 cái còn lại có `%` trong nội dung nhưng là số liệu
nghiệp vụ ("tỷ lệ sử dụng Quyết định 1599"), không phải tiến độ nhiệm vụ. AI đã
đúng khi để trống thay vì bịa số.

## Phân bố theo loại nhiệm vụ

| Loại | Ý nghĩa | Số bản ghi | TB | Tỷ lệ ghi 100% |
|---|---|---|---|---|
| RECURRING | WEEKLY_DONE | 1.244 | 87,8 | 37,2% |
| MILESTONE | MEANINGLESS | 247 | 91,3 | 21,1% |
| MONITORING | MEANINGLESS | 147 | 98,2 | **63,9%** |
| UNRELIABLE | MEANINGLESS | 87 | 85,5 | 19,5% |
| UNRELIABLE | TIME_RATIO | 3 | 33,0 | 0% |

## Xác nhận vấn đề "tuần nào cũng 100%"

Đây chính là vấn đề bạn nêu từ đầu. Đã đo được cụ thể:

**10 nhiệm vụ ghi 100% suốt cả 21/21 tuần**, không sót tuần nào:

```
Vận hành hệ thống UMC Office              RECURRING    21/21 tuần
Hỗ trợ người dùng và xử lý sự cố CNTT     MONITORING   21/21 tuần
Quản lý thanh toán BHYT                   MONITORING   21/21 tuần
Đào tạo                                   RECURRING    21/21 tuần
...
```

Xem nội dung thực tế của các dòng MONITORING ghi 100%:

```
"Ngoại trú: Số lượt KCB BHYT là 4.427 lượt (giảm 25% so với tuần trước)"  → 100%
"Cử nhân sự tham gia Hội thi Thầy thuốc giỏi chuyên môn"                  → 100%
```

Con số 100% ở đây **không mang nghĩa hoàn thành**. Nhiệm vụ theo dõi thì không
bao giờ "xong" — lượt KCB giảm 25% mà vẫn ghi 100%. Người nhập chỉ đang xác nhận
"tuần này có làm".

**Pipeline đã xử lý đúng:** cả 147 bản ghi MONITORING đều được gán
`progressMeaning = MEANINGLESS`. Dữ liệu không sai — nhãn đã nói rõ con số này
vô nghĩa.

**Việc còn lại:** dashboard phải **tôn trọng nhãn đó**. Không được đưa metric
`MEANINGLESS` vào bất kỳ phép tính trung bình "tỷ lệ hoàn thành" nào, nếu không
sẽ báo cáo lên Ban Giám đốc một con số ảo. Với nhiệm vụ theo dõi, chỉ nên hiển
thị số liệu nghiệp vụ (lượt KCB, số sự cố) — không hiển thị %.
