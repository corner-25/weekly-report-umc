# Audit chất lượng zAI — trích số liệu và đặt tên chỉ số

Ngày: 2026-08-24 · Phạm vi: 9.490 metric, 2.825 tên, 34 tuần

## Kết luận ngắn

**Trích số: chính xác.** Kiểm mẫu ngẫu nhiên 10 bản ghi, 10/10 khớp câu gốc —
kể cả số tiền hàng tỷ và số có số 0 đứng đầu (`09` → 9).

```
"Nhập kho ...: 5.672.432.040VND"           → 5672432040  VND    ✓
"Chi phí KCB BHYT thanh toán là 25.910.765.184 đồng" → 25910765184 VND ✓
"- Chỉ số chăm sóc: 09"                    → 9  chỉ số           ✓
```

**Đặt tên: có lỗi hệ thống.** Đây là chỗ cần sửa.

## 1. NGHIÊM TRỌNG — Tên chỉ số nhúng ngày tháng

**543/2.832 tên** chứa ngày cụ thể. Hệ quả: cùng một chỉ số theo dõi hàng tuần
bị tách thành hàng chục chỉ số khác nhau, mỗi cái xuất hiện đúng một lần.

```
Nhập kho hóa chất sát khuẩn từ ngày 01/01/2026 đến 08/01/2026   1 lần
Nhập kho hóa chất sát khuẩn từ ngày 06/02/2026 đến 12/02/2026   1 lần
Nhập kho hóa chất sát khuẩn từ ngày 06/03/2026 đến 12/03/2026   1 lần
Nhập kho hóa chất sát khuẩn từ ngày 03/04/2026 đến 09/04/2026   1 lần
...
```

Đây là MỘT chỉ số cần vẽ thành một đường qua 34 tuần. Hiện tại biểu đồ không vẽ
được gì vì mỗi điểm mang một tên riêng.

Mốc thời gian đã có sẵn ở cột `weekId` và `asOfDate` — nhắc lại trong tên là thừa
và phá vỡ khả năng nối chuỗi.

**192 tên** chứa số tuần (`"so với tuần 19"`) — cùng bản chất.

Bỏ ngày và số tuần khỏi tên thì gom được **2.832 → 2.217 tên** (giảm 615 tên ảo).

## 2. Chỉ số "Tăng/Giảm so với tuần X" — dữ liệu suy diễn được

**183 tên** dạng này:

```
Giảm chi phí quản lý so với tuần 20    14 %
Tăng tổng viện phí so với tuần 12      12 %
```

Đây không phải số liệu mới mà là **phép trừ giữa hai tuần** — hệ thống tự tính
được từ chuỗi gốc, chính xác hơn và không phụ thuộc vào việc người viết báo cáo
có nhắc tới hay không.

Lưu chúng gây ba vấn đề: phồng số lượng chỉ số, mỗi tên chỉ dùng một lần, và khi
người viết đổi mốc so sánh thì lại sinh tên mới.

## 3. Đơn vị lặp lại nội dung tên

```
Tên: "Tổ chức Hội nghị/ Hội thảo"        Đơn vị: "Hội nghị/ Hội thảo"
Tên: "Tổng số đề nghị và công văn"       Đơn vị: "đề nghị và công văn"
```

Đơn vị nên là danh từ đếm ngắn gọn (`lượt`, `hồ sơ`, `văn bản`), không phải chép
lại tên chỉ số. Ảnh hưởng nhẹ — chỉ làm giao diện rườm rà.

## 4. Trường độ tin cậy vô dụng

| confidence | số bản ghi |
|---|---|
| 1.0 | 9.511 |
| 0.9 | 3 |
| 0.5 | 1 |

AI tự chấm điểm tuyệt đối cho gần như mọi bản ghi. Trường này không phân biệt
được gì nên không dùng để lọc hay sắp xếp được.

**Hướng xử lý:** thay việc hỏi AI tự chấm bằng kiểm tra ở tầng mã — số liệu có
nằm trong khoảng hợp lý so với lịch sử của chính chỉ số đó không. Đó mới là tín
hiệu thật.

## Phân bố hiện tại

| Nhóm | Số chỉ số | Bản ghi |
|---|---|---|
| Chỉ 1 lần | 1.853 | 1.853 |
| 2-3 lần | 454 | 1.018 |
| 4-7 lần | 224 | 1.166 |
| **8+ lần (theo dõi được)** | **294** | **5.375** |

1.853 chỉ số dùng một lần là quá nhiều. Sau khi dọn tên nhúng ngày và bỏ chỉ số
biến động, con số này sẽ giảm đáng kể.

---

# Đã xử lý

| Việc | Kết quả |
|---|---|
| Prompt v4: cấm nhúng ngày vào tên | quy tắc 3 |
| Prompt v4: cấm trích số so sánh giữa kỳ | quy tắc 4 |
| Prompt v4: đơn vị là danh từ đếm ngắn | quy tắc 2 |
| Dọn ngày tháng khỏi tên chỉ số | 636 metric |
| Xoá chỉ số so sánh đã lỡ lưu | 223 metric |
| Gỡ nhiều giá trị trong cùng một tuần | 152 metric |

**Tên riêng biệt: 2.843 → 2.152.** Chỉ số theo dõi được (≥8 tuần): **294 → 317**.

## Ba lỗi bắt được khi kiểm chứng script

Mỗi bước dọn đều chạy thử và đối chiếu bản gốc trước khi ghi. Ba lần phát hiện
script sắp xoá nhầm dữ liệu thật:

**1. Chỉ số truyền thông không phải số so sánh.** Bộ lọc ban đầu bắt mọi tên bắt
đầu bằng "Tăng/Giảm", định xoá cả:
```
Tăng số lượt theo dõi trang    395 lượt   ← số lượt tăng thêm THẬT, 19 tuần
```
Đây là số đo được của tuần, không phải phép trừ suy diễn. Thu hẹp điều kiện: chỉ
xoá khi tên có "so với tuần/kỳ/tháng" VÀ đơn vị là phần trăm.

**2. Hai chỉ số cùng tên, khác đơn vị.**
```
Đi đào tạo nước ngoài (>= 10 ngày):  0 lượt   ← lượt mới trong tuần
Đi đào tạo nước ngoài (>= 10 ngày): 14 người  ← tổng người đang đi
```
Đơn vị `người` ít hơn `lượt` nhưng không phải dùng nhầm — hai chỉ số riêng. Chỉ
loại bỏ khi đơn vị lệch là `%`, dấu hiệu chắc chắn của việc lấy nhầm số từ mệnh
đề so sánh.

**3. Cùng mốc thời gian nghĩa là hai số liệu riêng.**
```
Luỹ kế công việc đã giải quyết, mốc 23/01:  80  ← mảng đề nghị/công văn
Luỹ kế công việc đã giải quyết, mốc 23/01: 103  ← mảng công việc thực hiện
```
Khác với "nhắc lại kỳ trước" (mốc khác nhau), đây là hai mảng của cùng một phòng
cùng chốt một ngày. Chỉ gộp khi mốc thời gian thực sự khác nhau.

## Còn tồn: 33 nhóm cần người xem

Không tự quyết được vì mất phần phân biệt trong tên:
```
tuần 32  Chi phí quản lý    2.000.000 · 18.583.300   (nội trú vs ngoại trú?)
tuần  5  Doanh thu         54.668.000 · 92.752.000   (bãi xe vs căng tin?)
```
Cần chạy lại trích xuất với prompt v4 để AI đặt tên phân biệt ngay từ đầu.
