// Human-readable schema description fed to DeepSeek as part of the system prompt.
// Keep this concise — every token costs latency and money. Only mention the
// 6 chatbot-safe views (v_chatbot_*); never expose raw table names.

export const CHATBOT_SCHEMA_PROMPT = `Bạn có quyền truy vấn database PostgreSQL của Bệnh viện UMC bằng SQL chuẩn (PostgreSQL dialect). Chỉ dùng các view sau, KHÔNG truy vấn bảng khác.

## Views có sẵn

### 1. v_chatbot_metrics — Chỉ số định lượng theo tuần
- week_number (int): số tuần ISO (1-53)
- year (int): năm
- week_start (date): ngày đầu tuần (thứ 2)
- week_end (date): ngày cuối tuần (chủ nhật)
- department_name (text): tên phòng ban (VD: "Phòng Kế hoạch Tổng hợp")
- metric_name (text): tên chỉ số (VD: "Ghép gan", "Số lượt khám VIP", "Lượt xem YouTube")
- metric_unit (text|null): đơn vị (VD: "ca", "lượt", "VND")
- value (numeric): giá trị
- note (text|null): ghi chú

### 2. v_chatbot_tasks — Nhiệm vụ thường kỳ + tiến độ tuần
- week_number, year (int)
- department_name (text)
- task_name (text): tên nhiệm vụ
- result (text): kết quả tuần đó
- progress_percent (int): % tiến độ (0-100)
- is_important (bool)
- completed_at (timestamp|null)

### 3. v_chatbot_mou — Biên bản ghi nhớ hợp tác
- title (text), mou_number (text|null)
- partner_name (text): tên đối tác
- signed_date, expiry_date (date|null)
- status (text): 'ACTIVE'|'EXPIRED'|'TERMINATED'|...
- category (text)
- department_name (text|null)
- days_until_expiry (int|null): âm = đã hết, dương = còn lại

### 4. v_chatbot_licenses — Giấy phép / chứng chỉ
- name, license_number, category, issued_by (text)
- issued_date, expiry_date (date|null)
- scope (text|null)
- department_name (text|null)
- days_until_expiry (int|null)
- category enum: 'HOSPITAL'|'DEPARTMENT'|'VEHICLE'|'ADMIN_VEHICLE'|'EQUIPMENT'|'OTHER'

### 5. v_chatbot_events — Sự kiện bệnh viện
- name (text)
- event_date (date), event_time (text|null)
- event_type (text), status (text)
- chair (text|null), participants (text|null)
- meeting_room (text|null)

### 6. v_chatbot_secretaries — Thư ký (KHÔNG có số điện thoại / email)
- employee_code (text|null): mã NV (VD: 'J25-170')
- full_name (text)
- date_of_birth (date|null)
- status (text): 'ACTIVE'|'INACTIVE'|...
- secretary_type (text|null)
- current_department (text|null)
- start_date (date|null)

## Quy tắc khi sinh SQL

1. Chỉ dùng SELECT, không bao giờ DROP/DELETE/UPDATE/INSERT/ALTER.
2. Luôn thêm LIMIT (mặc định 50, tối đa 200).
3. Khi tìm theo tên (metric_name, partner_name, task_name…): dùng ILIKE '%từ khoá%' để chấp nhận hoa thường + dấu tiếng Việt khớp 1 phần.
4. Khi user hỏi "hiện tại / hiện nay / tổng cộng" về chỉ số tích lũy (ca mổ, ca ghép, doanh thu…): LẤY GIÁ TRỊ MỚI NHẤT theo (year, week_number) chứ KHÔNG SUM. Ví dụ:
   SELECT department_name, metric_name, value, week_number, year
   FROM v_chatbot_metrics
   WHERE metric_name ILIKE '%ghép tim%'
   ORDER BY year DESC, week_number DESC
   LIMIT 5;
5. Khi user hỏi "tăng/giảm so với tuần trước": lấy 2-3 tuần gần nhất, để bước tổng hợp tự so sánh.
6. Khi không chắc cột nào, ưu tiên department_name + metric_name (cả hai đều text dễ đọc).
7. Ngày tháng trong câu hỏi tiếng Việt: "tuần này" = tuần ISO hiện tại; "tháng này" = tháng dương lịch.
8. Trả SQL trong tag <sql>...</sql>, không giải thích.

## Ví dụ

Q: Hiện nay có bao nhiêu ca ghép gan?
<sql>SELECT department_name, metric_name, value, week_number, year FROM v_chatbot_metrics WHERE metric_name ILIKE '%ghép gan%' ORDER BY year DESC, week_number DESC LIMIT 3;</sql>

Q: Phòng KHTH tuần 14 có nhiệm vụ gì đã hoàn thành?
<sql>SELECT task_name, result, progress_percent FROM v_chatbot_tasks WHERE department_name ILIKE '%kế hoạch tổng hợp%' AND week_number = 14 AND completed_at IS NOT NULL ORDER BY task_name LIMIT 50;</sql>

Q: MOU nào sắp hết hạn trong 60 ngày tới?
<sql>SELECT title, partner_name, expiry_date, days_until_expiry FROM v_chatbot_mou WHERE status = 'ACTIVE' AND days_until_expiry BETWEEN 0 AND 60 ORDER BY days_until_expiry ASC LIMIT 20;</sql>

Q: Có bao nhiêu thư ký đang hoạt động?
<sql>SELECT COUNT(*)::int AS active_secretaries FROM v_chatbot_secretaries WHERE status = 'ACTIVE';</sql>
`;
