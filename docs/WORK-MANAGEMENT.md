# Quản lý công việc — theo dõi chỉ đạo của BGĐ

Phân hệ `/dashboard/work` theo dõi các công việc chỉ đạo của Ban Giám đốc và việc
theo kế hoạch. Nguồn chính là phân hệ **Quản lý công việc** của ứng dụng nội bộ.

## Quy trình

| Bước | Ai làm | Ở đâu |
|---|---|---|
| B1. Lấy dữ liệu | Script cào chạy trong mạng UMC → đẩy file JSON lên | `POST /api/work/import` |
| B1'. Mở việc theo kế hoạch | Phòng HC | nút "Mở việc theo kế hoạch" |
| B2. Ghi tính chất, lưu ý; AI gợi ý các bước, đánh giá tiến độ | Phòng HC | trang chi tiết công việc |
| B3. Theo dõi: quá hạn, lâu chưa cập nhật, vừa cập nhật gì | Phòng HC | `/dashboard/work` |
| B3'. Email nhắc thư ký của đơn vị chủ trì | Quản trị viên bấm gửi | nút "Nhắc việc qua email" |

## Vì sao phải cào và đẩy lên

Ứng dụng nội bộ không có API, và chỉ truy cập được từ mạng bệnh viện. Hệ thống
(Railway) không với vào trong được, nên chiều dữ liệu phải là **từ trong ra**:

```
[Máy trong mạng UMC]                         [Railway]
 script cào (chạy tay)  ──► file JSON ──►  POST /api/work/import  ──► Postgres
                               │            (header x-import-token)
                               └─► hoặc tải file lên trang Theo dõi công việc
```

Máy chạy script không cần mật khẩu database, chỉ cần **mã nạp dữ liệu**
(`WORK_IMPORT_TOKEN`, đặt ở biến môi trường service `web` trên Railway).

## Định dạng file (hợp đồng dữ liệu)

Mẫu đầy đủ: [`prisma/eval/work-import.sample.json`](../prisma/eval/work-import.sample.json).
Kiểm tra bằng zod ở [`lib/work/schemas.ts`](../lib/work/schemas.ts).

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `externalId` | ✔ | Mã công việc bên ứng dụng nội bộ — khoá để nạp lại không tạo trùng |
| `title` | ✔ | |
| `url` | | Link mở công việc trên ứng dụng nội bộ |
| `kind` | | `DIRECTIVE` (mặc định), `PLAN`, `OTHER` |
| `description`, `directedBy` | | Nội dung chỉ đạo, người chỉ đạo |
| `directedAt`, `dueDate` | | `dd/mm/yyyy` hoặc `yyyy-mm-dd` |
| `leadUnit`, `coordinatingUnits`, `assignees` | | Đơn vị chủ trì tự khớp với phòng ban trong hệ thống |
| `status` | | Ghi nguyên văn ("Đang thực hiện", "Hoàn thành"…); hệ thống tự quy đổi và giữ bản gốc |
| `progressPercent` | | 0–100 |
| `lastUpdatedAt` | | Lần sửa gần nhất nếu trang có hiện |
| `updates[]` | | `{ at, author, content, progressPercent }` — lịch sử cập nhật; `at` thiếu múi giờ hiểu là giờ Việt Nam |

Quy tắc khi nạp:

- Chạy lại bao nhiêu lần cũng được. Việc khớp theo `externalId`, cập nhật khớp theo hash (thời điểm + người + nội dung).
- Phần Phòng HC tự ghi (ưu tiên, nhãn, tính chất, lưu ý, đơn vị đã gán tay, gợi ý AI) **không bao giờ** bị file cào ghi đè.
- Dòng lỗi bị bỏ qua và liệt kê lại trong kết quả, các dòng khác vẫn nạp.

## Chạy

```bash
# Sau khi cào xong, trên máy trong mạng UMC:
WORK_IMPORT_TOKEN=... npx tsx prisma/push-work-file.ts ket-qua-cao.json
```

Hoặc mở **Theo dõi công việc → Tải file cào (.json)**.

## Thiết kế script cào (làm ở bước sau)

Hướng đề xuất, chốt khi xem được giao diện phân hệ Quản lý công việc:

1. Playwright (Chrome có sẵn trên máy) đăng nhập bằng tài khoản Phòng HC, lưu phiên đăng nhập để lần sau không phải gõ lại.
2. Mở danh sách công việc, lọc "chỉ đạo của BGĐ" (và việc theo kế hoạch), lật hết các trang để lấy mã việc.
3. Mở từng việc lấy chi tiết và lịch sử cập nhật. Chỉ mở lại việc đã đổi kể từ lần cào trước (theo ngày sửa trên danh sách) để chạy nhanh.
4. Ghi ra file JSON đúng hợp đồng trên, rồi gọi `push-work-file.ts`.

Nếu trang danh sách có nút "Xuất Excel", dùng file đó thay cho việc lật trang sẽ nhanh và ít vỡ hơn.

## Nhắc việc

- Người nhận: thư ký **đang làm việc**, **có email**, thuộc đơn vị chủ trì.
- Việc được nhắc: quá hạn, đến hạn trong 7 ngày, hoặc quá 14 ngày không cập nhật (`lib/work/constants.ts`).
- Mỗi thư ký nhận một email gom việc của đơn vị mình; việc đã nhắc trong 7 ngày không nhắc lại.
- Gửi thật cần biến SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) trên service `web`. Chưa có thì chỉ xem trước.
