# Chatbot AI — vận hành và phân quyền

## Deploy

1. Chạy `npx prisma migrate deploy` bằng database owner.
2. Đảm bảo role trong `DATABASE_URL_RO` có `CONNECT` vào đúng database. Migration tự cấp `USAGE` schema và `SELECT` trên allowlist view nếu role tên `chatbot_readonly` đã tồn tại.
3. Đăng xuất/đăng nhập lại để JWT nhận `role` và `departmentId` mới.
4. Nâng quyền có chủ đích; không cấp ADMIN hàng loạt:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin-duoc-phe-duyet@example.com';
UPDATE users SET role = 'ANALYST' WHERE email = 'chuyen-vien-duoc-phe-duyet@example.com';
```

Tài khoản cũ và tài khoản tự đăng ký đều là `STAFF`. STAFF chỉ tra cứu/soạn nội dung; ADMIN và ANALYST mới được xác nhận hành động ghi. View nhân sự chi tiết không được đưa cho AI; các view personnel chỉ chứa số tổng hợp.

## Retention

Gọi `POST /api/cron/chatbot-retention` với header `x-cron-secret` hàng ngày. Mặc định xóa audit sau 90 ngày và proposal đã kết thúc sau 30 ngày. Điều chỉnh bằng `CHATBOT_AUDIT_RETENTION_DAYS` và `CHATBOT_PROPOSAL_RETENTION_DAYS`.

## Đánh giá chất lượng

`npm run chatbot:eval` chạy bộ câu hỏi nghiệp vụ qua model và kiểm tra SQL được guard chấp nhận, đồng thời chọn đúng view. Lệnh cần `DEEPSEEK_API_KEY`; không thực thi SQL và không đọc dữ liệu thật.

## Kiểm tra lỗi quyền database

Nếu chatbot báo lỗi truy vấn, kiểm tra database/username trong `DATABASE_URL_RO`, quyền `CONNECT`, `USAGE ON SCHEMA public` và `SELECT` trên đúng các view `v_chatbot_*`. Không cấp quyền đọc bảng gốc và không dùng `GRANT SELECT ON ALL TABLES`.

## Dữ liệu chatbot đọc được (bổ sung 05/10/2026)

Migration `20261005150000_chatbot_cong_viec_nhiem_vu` thêm view cho các phân hệ mới (mở cho mọi vai trò, như giao diện):

| View | Nội dung |
|---|---|
| `v_chatbot_work_items` | Quản lý công việc — mỗi việc chỉ đạo của BGĐ một dòng, kèm cờ tính sẵn `is_open`, `is_overdue`, `days_overdue`, `is_due_soon`, `is_stale`, `days_since_update`, `on_time`, tên lãnh đạo đã bỏ mã nhân viên, nội dung cập nhật gần nhất |
| `v_chatbot_work_updates` | Lịch sử cập nhật tiến độ của từng việc |
| `v_chatbot_task_threads` | Theo dõi nhiệm vụ báo cáo tuần — tình trạng hiệu lực (Phòng HC sửa tay thắng AI), loại việc, %, tuần báo cáo cuối, nội dung lần cuối |
| `v_chatbot_crm_care_tasks` | CRM chăm sóc đối tác — quà/hoa theo dịp, ngân sách, thực chi, số ảnh; không có tên khách |

Cờ quá hạn / sắp đến hạn (30 ngày) / lâu chưa cập nhật (14 ngày) / đúng hạn tính theo giờ Việt Nam, khớp `lib/work/status.ts` và `lib/work/analytics.ts`. Đổi ngưỡng ở `lib/work/constants.ts` thì sửa cả view. `v_chatbot_vip_summary` từ migration này chỉ đếm lượt CRM đã thực hiện (bỏ lịch hẹn và lượt huỷ).
