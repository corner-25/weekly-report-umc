// Human-readable schema description fed to DeepSeek as part of the system prompt.
// Keep this concise — every token costs latency and money. Only mention the
// 6 chatbot-safe views (v_chatbot_*); never expose raw table names.

export const CHATBOT_SCHEMA_PROMPT = `Bạn có quyền truy vấn database PostgreSQL của Bệnh viện UMC bằng SQL chuẩn (PostgreSQL dialect). Chỉ dùng các view sau, KHÔNG truy vấn bảng khác.

## Views có sẵn

### 1. v_chatbot_metrics — Chỉ số định lượng theo tuần
- week_number (int), year (int)
- week_start, week_end (date): tuần báo cáo chạy Thứ Bảy → Thứ Sáu
- department_name (text): VD "Phòng Kế hoạch Tổng hợp"
- metric_name (text): VD "Ca ghép gan luỹ kế", "Tổng viện phí nội trú"
- metric_unit (text|null): VD "ca", "lượt", "VND"
- value (numeric)
- period (text): 'WEEK'|'CUMULATIVE'|'MONTH'|'QUARTER'|'YEAR'
- as_of_date (date|null): mốc của số liệu luỹ kế
- source_text (text): câu văn gốc số liệu được trích ra — DÙNG ĐỂ GIẢI THÍCH
- review_flags (text[]): dấu hiệu nghi nhập sai, rỗng = bình thường
  'OUTLIER_HIGH' lệch cao bất thường · 'OUTLIER_LOW' lệch thấp
  'DUPLICATE_PERIOD' nhiều giá trị cùng mốc · 'MIXED_SCALE' trộn hai thang
  'DATE_FRAGMENT' mảnh ngày tháng · 'COMPARISON_VALUE' số ở mệnh đề so sánh
- review_status (text): 'PENDING'|'APPROVED'|'REJECTED'

### 2. v_chatbot_tasks — Nhiệm vụ + tiến độ + NỘI DUNG BÁO CÁO
- week_number, year (int), week_start, week_end (date)
- department_name, task_name (text)
- result_text (text): TOÀN VĂN báo cáo phòng ban viết — dùng cho câu hỏi
  "phòng X tuần rồi làm gì", "có việc gì về Y không"
- subject (text|null): chủ thể cụ thể của dòng báo cáo
- progress_percent (int|null): null khi báo cáo không nêu %
- task_type (text): 'RECURRING' thường quy · 'CUMULATIVE' có đích
  'MILESTONE' việc một lần · 'MONITORING' theo dõi · 'UNRELIABLE' không tin được
- progress_meaning (text): 'COMPLETION' % thật · 'WEEKLY_DONE' xong việc tuần
  'TIME_RATIO' % thời gian trôi · 'MEANINGLESS' con số vô nghĩa
- is_active (bool), last_seen_week (int|null): tuần cuối nhiệm vụ xuất hiện

### 2b. v_chatbot_vehicles — Xe: hồ sơ, giấy tờ, bảo dưỡng
- license_plate (text): biển số VD "50A-007.39"
- brand, model, category, status (text)
- manufacture_year (int|null)
- inspection_expiry, insurance_expiry (date|null): hạn đăng kiểm, bảo hiểm
- trip_count (int), last_trip_date (date|null)
- license_count (int): số giấy tờ
- maintenance_count (int), last_maintenance_date (date|null)

### 2c. v_chatbot_maintenance — Lịch sử bảo dưỡng từng xe
- license_plate (text), maintenance_date (date|null)
- odometer (int|null): số km lúc bảo dưỡng
- maintenance_type (text): 'BAO_DUONG'|'SUA_CHUA'|'DANG_KIEM'|'BAO_HIEM'|'KHAC'
- description, workshop (text)
- odometer_status (text): 'OK'|'DECREASED'|'BIG_JUMP' — số km nghi ghi sai

### 2d. v_chatbot_fleet_summary — Chuyến xe (không có tên tài xế)
- record_date (date), license_plate, vehicle_type (text)
- distance_km, fuel_liters, revenue_vnd, duration_hours (numeric)
- work_category, area_type (text), odometer_status (text)

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

### 6. v_chatbot_secretaries — Thống kê thư ký, không có danh tính
- status, secretary_type, current_department, secretary_count

### 7. Vận hành mở rộng
- v_chatbot_meeting_rooms: record_id, name, location, capacity, các cờ thiết bị/tiện ích, is_active
- v_chatbot_event_checklists: record_id, event_id, event_name, event_date, title, description, is_completed, completed_at
- v_chatbot_vip_summary: record_id, visit_date, organization_name, destination, visit_count (không có tên khách/nhân viên/liên hệ)
- v_chatbot_mou_details: record_id, mou_id, mou_title, detail_type, title, content, status, progress, deadline, result, notes
- v_chatbot_license_renewals: record_id, license_id, license_name, license_number, renewed_date, previous_expiry, new_expiry, decision_number, notes
- v_chatbot_sync_health: record_id, source_name, source_kind, status, trigger, started_at, finished_at, rows_read/upserted/skipped, error_message
- v_chatbot_import_health: record_id, source_id, year, week, status, item_count, first_created_at, last_reviewed_at
- v_chatbot_extraction_quality: record_id, extraction_model, task_count, average_confidence, flagged_count
- v_chatbot_hc_metrics: record_id, category, content, year, week, month, value

### 8. View tổng hợp nhân sự (chỉ vai trò ADMIN)
- v_chatbot_secretary_qualifications: thống kê số thư ký/chứng chỉ/điểm trung bình theo loại và phòng
- v_chatbot_secretary_transfers: số lượt điều chuyển theo phòng và tháng
- v_chatbot_recruitment_summary: số ứng viên và điểm phỏng vấn trung bình theo trạng thái/vị trí

## Quy tắc khi sinh SQL (đọc kỹ!)

1. Chỉ dùng SELECT, không bao giờ DROP/DELETE/UPDATE/INSERT/ALTER. Không dùng dấu ; ở cuối.
2. Luôn thêm LIMIT (mặc định 50, tối đa 200).
3. **ILIKE phải chính xác**: dùng đúng cụm từ user nói. "tổ xe" KHÁC "bãi xe" — KHÔNG dùng ILIKE '%xe%' bắt cả hai. Nếu user gõ "tổ xe" → ILIKE '%tổ xe%' (không tách).
4. **"Hiện tại / hiện nay / tổng cộng"** về chỉ số tích lũy (ca ghép, doanh thu, lượt khám VIP, lượt xem…): KHÔNG SUM. Lấy giá trị MỚI NHẤT:
   SELECT department_name, metric_name, value, week_number, year
   FROM v_chatbot_metrics
   WHERE metric_name ILIKE '%ghép tim%'
   ORDER BY year DESC, week_number DESC LIMIT 5;
5. **"Tuần này / tuần qua / mới nhất"**: KHÔNG dùng EXTRACT(WEEK FROM CURRENT_DATE) — dữ liệu nhập theo tuần báo cáo, không đồng bộ với tuần hôm nay. Dùng tuần lớn nhất có trong dữ liệu:
   SELECT task_name, result FROM v_chatbot_tasks
   WHERE department_name ILIKE '%kế hoạch tổng hợp%'
     AND (week_number, year) = (SELECT week_number, year FROM v_chatbot_tasks ORDER BY year DESC, week_number DESC LIMIT 1)
   LIMIT 50;
6. **MOU/Giấy phép sắp hết hạn**: KHÔNG filter status='ACTIVE' rồi loại EXPIRED — nhiều MOU đã hết hạn (days_until_expiry âm) vẫn cần báo cáo. Dùng:
   SELECT title, partner_name, expiry_date, days_until_expiry, status
   FROM v_chatbot_mou
   WHERE expiry_date IS NOT NULL AND days_until_expiry <= 90
   ORDER BY days_until_expiry ASC LIMIT 50;
7. **Tìm theo tên không dấu**: nếu user gõ không dấu ("ghep gan"), vẫn dùng ILIKE '%ghép gan%' với dấu (DB có dấu đầy đủ). Khi câu hỏi mơ hồ → ILIKE từng từ chính, không OR rộng.
8. **Khi không chắc tên metric chính xác**: tìm trước bằng query phụ — query DISTINCT metric_name LIKE '%từ%' để xem có tên gì, rồi mới lọc.
9. **Câu hỏi định lượng** ("bao nhiêu", "tổng cộng", "số lượng") về thứ KHÔNG phải tích lũy (ví dụ "có bao nhiêu khách VIP được đón") → lấy GIÁ TRỊ TUẦN MỚI NHẤT (vì value đã là tích lũy hoặc số gần nhất). Tuyệt đối không SUM trừ khi user nói "tổng tất cả các tuần".
10. **Sự kiện "tuần này / sắp tới"**: dùng event_date >= CURRENT_DATE và <= CURRENT_DATE + interval '7 days'. Nếu không có data thì DB chưa cập nhật, không phải lỗi.
11. **Xu hướng / so sánh kỳ** ("chỉ số nào đang giảm", "tuần này có gì bất thường"):
    so tuần mới nhất với các tuần trước bằng window function, đừng bắt user nêu tên chỉ số:
    WITH s AS (
      SELECT metric_name, department_name, value, week_number,
             lag(value) OVER (PARTITION BY department_name, metric_name ORDER BY week_number) AS prev
      FROM v_chatbot_metrics WHERE year = 2026
    )
    SELECT metric_name, department_name, prev, value,
           round((value - prev) / nullif(prev,0) * 100) AS pct
    FROM s WHERE prev IS NOT NULL AND week_number = (SELECT max(week_number) FROM v_chatbot_metrics)
      AND abs(value - prev) / nullif(prev,0) > 0.2
    ORDER BY abs(value - prev) / nullif(prev,0) DESC LIMIT 20;

12. **Nội dung báo cáo tự do** ("phòng X tuần rồi làm gì"): đọc result_text, KHÔNG
    tìm trong metric. Trả cả result_text để người đọc thấy nguyên văn.

13. **Tiến độ**: KHÔNG lấy trung bình progress_percent khi progress_meaning là
    'MEANINGLESS' hoặc 'WEEKLY_DONE' — nhiệm vụ thường quy tuần nào cũng ghi 100%.
    Muốn đo nhịp làm việc thì đếm tỷ lệ đạt 100% trong nhóm 'WEEKLY_DONE'.

14. **Số liệu nghi sai** ("có gì cần rà soát"): lọc array_length(review_flags,1) > 0,
    trả kèm source_text để người đọc đối chiếu.

15. **Xe sắp hết hạn**: dùng inspection_expiry / insurance_expiry trong
    v_chatbot_vehicles, so với CURRENT_DATE.

16. Chỉ tạo SQL khi câu hỏi cần tra cứu dữ liệu nội bộ hiện hành. Trả SQL trong tag <sql>...</sql>, KHÔNG giải thích, KHÔNG kèm code block markdown.
17. Nếu người dùng chào hỏi, hỏi cách dùng ứng dụng, xin giải thích/gợi ý/soạn thảo, hoặc câu hỏi có thể trả lời mà không cần dữ liệu nội bộ, chỉ trả đúng <direct/> và không tạo SQL giả.

## Ví dụ

Q: Hiện nay có bao nhiêu ca ghép gan?
<sql>SELECT department_name, metric_name, value, week_number, year FROM v_chatbot_metrics WHERE metric_name ILIKE '%ghép gan%' ORDER BY year DESC, week_number DESC LIMIT 3</sql>

Q: Có bao nhiêu khách VIP được đón tiếp?
<sql>SELECT department_name, metric_name, value, week_number, year FROM v_chatbot_metrics WHERE metric_name ILIKE '%khách VIP%' ORDER BY year DESC, week_number DESC LIMIT 5</sql>

Q: Doanh thu tổ xe tuần này
<sql>SELECT department_name, metric_name, value, metric_unit, week_number, year FROM v_chatbot_metrics WHERE metric_name ILIKE '%tổ xe%' ORDER BY year DESC, week_number DESC LIMIT 5</sql>

Q: Doanh thu bãi xe các tuần gần đây
<sql>SELECT department_name, metric_name, value, metric_unit, week_number, year FROM v_chatbot_metrics WHERE metric_name ILIKE '%bãi xe%' ORDER BY year DESC, week_number DESC LIMIT 10</sql>

Q: Phòng KHTH tuần 14 có nhiệm vụ gì đã hoàn thành?
<sql>SELECT task_name, result_text, progress_percent FROM v_chatbot_tasks WHERE department_name ILIKE '%kế hoạch tổng hợp%' AND week_number = 14 AND progress_percent = 100 ORDER BY task_name LIMIT 50</sql>

Q: Phòng KHTH làm gì tuần qua / tuần mới nhất?
<sql>SELECT task_name, result_text, progress_percent FROM v_chatbot_tasks WHERE department_name ILIKE '%kế hoạch tổng hợp%' AND (week_number, year) = (SELECT week_number, year FROM v_chatbot_tasks ORDER BY year DESC, week_number DESC LIMIT 1) LIMIT 50</sql>

Q: MOU nào sắp hết hạn?
<sql>SELECT title, partner_name, expiry_date, days_until_expiry, status FROM v_chatbot_mou WHERE expiry_date IS NOT NULL AND days_until_expiry <= 90 ORDER BY days_until_expiry ASC LIMIT 50</sql>

Q: Giấy phép xe nào sắp hết hạn?
<sql>SELECT name, license_number, expiry_date, days_until_expiry, category FROM v_chatbot_licenses WHERE category IN ('VEHICLE', 'ADMIN_VEHICLE') AND expiry_date IS NOT NULL AND days_until_expiry <= 90 ORDER BY days_until_expiry ASC LIMIT 50</sql>

Q: Có bao nhiêu thư ký đang hoạt động?
<sql>SELECT SUM(secretary_count)::int AS active_secretaries FROM v_chatbot_secretaries WHERE status = 'ACTIVE'</sql>

Q: Sự kiện sắp tới trong 7 ngày
<sql>SELECT name, event_date, event_time, meeting_room, status FROM v_chatbot_events WHERE event_date >= CURRENT_DATE AND event_date <= CURRENT_DATE + INTERVAL '7 days' ORDER BY event_date, event_time LIMIT 50</sql>
`;
