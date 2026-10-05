# Theo dõi nhiệm vụ trong báo cáo tuần

Trang **Nhiệm vụ thường kỳ → Tiến độ nhiệm vụ** (`/dashboard/tasks/progress`) cho biết từng
việc cụ thể các phòng báo cáo đang ở tình trạng nào. Khó ở chỗ mỗi phòng ghi một kiểu:

| Kiểu phòng | Ví dụ | % nghĩa là |
|---|---|---|
| Ghi 100% mỗi tuần | Điều dưỡng, CNTT, CTXH | "xong phần việc tuần này", không phải xong hẳn |
| Ghi % tiến độ thật | Bảo hiểm Y tế, TCCB, TCKT, QLCL | tiến độ thật, 100% là xong (QLCL có % kế hoạch năm) |
| Không ghi % | KHTH, KHĐT, QTTN, Đấu thầu | phải đọc câu chữ |

## Pipeline (`lib/task-tracking/`)

1. **Dòng gốc** — đọc lại file báo cáo bệnh viện (từng dòng Excel, kèm % riêng của dòng, thời gian,
   kế hoạch tuần sau). Không dùng `week_task_progress` vì ở đó nhiều dòng đã gộp một và chỉ giữ một %.
   Tuần phòng chưa sửa bản chép tuần trước thì bỏ.
2. **Nối thành việc** (`link.ts`) — dòng thuộc việc đang mở nếu cùng tên nhiệm vụ và câu chữ giống
   (bỏ dấu, bỏ số liệu; giữ số định danh như "quý 3", "công văn 199/…" — khác số là khác việc).
3. **Luồng** (`streams.ts`) — các dòng cùng tên nhiệm vụ: AI quyết cả luồng là **một việc thường kỳ**
   (gộp mọi tuần, vd "Quản lý văn bản đi, đến") hay **nhiều việc nối tiếp** (giữ tách, vd "Giám định
   chi phí KCB" gồm biên bản quý 3, hồ sơ quý 1…). Quyết định lưu ở `task_streams`.
4. **Cách báo cáo của phòng** (`profile.ts`) — tỷ lệ dòng có %, ghi 100%, % thay đổi, % đứng yên.
5. **AI đánh giá từng việc** (`judge.ts`, glm-5.2) — loại (thường kỳ / có tiến độ / một lần), tình trạng
   (đang làm / hoàn thành / đứng yên / ngừng báo cáo), tiến độ, câu trích làm căn cứ, độ tin cậy.
   Việc ngừng báo cáo: AI xem lần báo cáo cuối và diễn tiến để quyết đã xong hay ngừng.
6. **Luật cứng** (`rules.ts`) — thường kỳ không có %; phòng ghi % thật mà lần cuối 100% là xong; %
   đứng yên 6 lần liền là đứng yên; còn báo cáo thì không thể "ngừng"; ngừng báo cáo hoặc độ tin cậy
   dưới 0,6 thì "cần xác nhận".
7. **Người xác nhận** — Phòng HC sửa trên trang; giá trị sửa nằm ở cột `override*`, AI không ghi đè.

## Chạy

- Tự động: sau mỗi lần cron nạp báo cáo bệnh viện, phòng nào có nội dung mới được cập nhật
  (`lib/ingestion/sources/hospital-ai-import.ts`).
- Tay: `npx tsx prisma/build-task-threads.ts [--dept "Phòng …"] [--force] [--no-judge]`.
