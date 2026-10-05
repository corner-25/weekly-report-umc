-- Chatbot AI biết thêm các phân hệ mới: Quản lý công việc (chỉ đạo BGĐ), Theo dõi
-- nhiệm vụ báo cáo tuần, chăm sóc đối tác CRM (quà, hoa, ngân sách).
--
-- Các cờ quá hạn / sắp đến hạn / lâu chưa cập nhật / đúng hạn tính ĐÚNG như
-- giao diện (lib/work/status.ts, lib/work/analytics.ts):
--   - Đang thực hiện = chưa Hoàn thành, chưa Đã huỷ (tạm dừng vẫn tính).
--   - Quá hạn        = đang thực hiện và hạn chót < hôm nay (giờ Việt Nam).
--   - Sắp đến hạn    = đang thực hiện và hạn trong 0–30 ngày tới.
--   - Lâu chưa cập nhật = đang thực hiện và > 14 ngày kể từ lần cập nhật cuối
--     (chưa có cập nhật thì tính từ ngày chỉ đạo, không có nữa thì ngày tạo).
--   - Đúng hạn       = Hoàn thành, có hạn, ngày hoàn thành (giờ VN) <= hạn.
-- Ngưỡng 30/14 ngày lấy từ lib/work/constants.ts — đổi ở đó thì sửa cả view này.
-- Cột timestamp lưu giờ UTC (Prisma); cột DATE (directedAt, dueDate) lấy thẳng.
-- Chỉ dùng view — role chatbot_readonly không đọc bảng gốc.

-- ===========================================================================
-- 1. Quản lý công việc: mỗi việc một dòng
-- ===========================================================================
DROP VIEW IF EXISTS v_chatbot_work_items;
CREATE VIEW v_chatbot_work_items AS
WITH clock AS (
  SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS vn_today,
         now() AT TIME ZONE 'UTC' AS utc_now
),
base AS (
  SELECT w.*,
         w.status NOT IN ('DONE', 'CANCELLED') AS open_flag,
         coalesce(w."lastActivityAt", w."directedAt"::timestamp, w."createdAt") AS activity_at,
         coalesce(w."directedAt", w."createdAt"::date) AS assigned_on
  FROM work_items w
)
SELECT
  b.id AS record_id,
  b."externalId" AS external_id,
  b.title,
  CASE b.kind WHEN 'DIRECTIVE' THEN 'Chỉ đạo BGĐ' WHEN 'PLAN' THEN 'Theo kế hoạch' ELSE 'Khác' END AS kind_label,
  b.status::text AS status,
  CASE b.status
    WHEN 'NOT_STARTED' THEN 'Chưa thực hiện'
    WHEN 'IN_PROGRESS' THEN 'Đang xử lý'
    WHEN 'PAUSED' THEN 'Tạm dừng'
    WHEN 'DONE' THEN 'Hoàn thành'
    WHEN 'CANCELLED' THEN 'Đã huỷ'
  END AS status_label,
  coalesce(d.name, nullif(b."leadUnit", ''), 'Chưa rõ đơn vị') AS department_name,
  b."leadUnit" AS lead_unit,
  array_to_string(b."coordinatingUnits", ', ') AS coordinating_units,
  -- "A00-045 Nguyễn Hoàng Bắc (BGĐ)" -> "Nguyễn Hoàng Bắc" (như personName ở lib/work/analytics.ts)
  nullif(btrim(regexp_replace(regexp_replace(coalesce(b."directedBy", ''), '^[A-Z][0-9]{2}-[0-9]{3,}\s+', ''), '\s*\([^()]*\)\s*$', '')), '') AS directed_by,
  b.tags[1] AS directive_form,
  b."directedAt" AS directed_at,
  b.assigned_on AS assigned_date,
  extract(year FROM b.assigned_on)::int AS assigned_year,
  extract(month FROM b.assigned_on)::int AS assigned_month,
  b."dueDate" AS due_date,
  (b."completedAt" + interval '7 hours')::date AS completed_date,
  b."progressPercent" AS progress_percent,
  CASE b.priority WHEN 'LOW' THEN 'Thấp' WHEN 'NORMAL' THEN 'Bình thường' WHEN 'HIGH' THEN 'Cao' ELSE 'Khẩn' END AS priority_label,
  b.open_flag AS is_open,
  coalesce(b.open_flag AND b."dueDate" < c.vn_today, false) AS is_overdue,
  CASE WHEN b.open_flag AND b."dueDate" < c.vn_today THEN c.vn_today - b."dueDate" END AS days_overdue,
  (b."dueDate" - c.vn_today) AS days_to_due,
  coalesce(b.open_flag AND b."dueDate" >= c.vn_today AND b."dueDate" - c.vn_today <= 30, false) AS is_due_soon,
  floor(extract(epoch FROM (c.utc_now - b.activity_at)) / 86400)::int AS days_since_update,
  (b.open_flag AND floor(extract(epoch FROM (c.utc_now - b.activity_at)) / 86400) > 14) AS is_stale,
  CASE WHEN b.status = 'DONE' AND b."completedAt" IS NOT NULL AND b."dueDate" IS NOT NULL
       THEN (b."completedAt" + interval '7 hours')::date <= b."dueDate" END AS on_time,
  CASE WHEN b."completedAt" IS NOT NULL
       THEN greatest(0, (b."completedAt" + interval '7 hours')::date - b.assigned_on) END AS days_to_complete,
  (b."lastActivityAt" + interval '7 hours')::date AS last_update_date,
  u.update_count,
  u.latest_update_text,
  u.latest_update_author,
  b."aiAssessment" ->> 'level' AS ai_risk_level
FROM base b
CROSS JOIN clock c
LEFT JOIN departments d ON d.id = b."departmentId"
LEFT JOIN LATERAL (
  SELECT count(*) OVER ()::int AS update_count,
         left(regexp_replace(x.content, '\s+', ' ', 'g'), 400) AS latest_update_text,
         x.author AS latest_update_author
  FROM work_updates x
  WHERE x."workItemId" = b.id
  ORDER BY x."occurredAt" DESC
  LIMIT 1
) u ON true;

-- Lịch sử cập nhật tiến độ: mỗi lần cập nhật một dòng.
DROP VIEW IF EXISTS v_chatbot_work_updates;
CREATE VIEW v_chatbot_work_updates AS
SELECT
  x.id AS record_id,
  x."workItemId" AS work_item_id,
  w.title AS work_title,
  coalesce(d.name, nullif(w."leadUnit", ''), 'Chưa rõ đơn vị') AS department_name,
  (x."occurredAt" + interval '7 hours')::date AS update_date,
  x.author,
  x.content,
  x."progressPercent" AS progress_percent
FROM work_updates x
JOIN work_items w ON w.id = x."workItemId"
LEFT JOIN departments d ON d.id = w."departmentId";

-- ===========================================================================
-- 2. Theo dõi nhiệm vụ báo cáo tuần: mỗi việc (thread) một dòng.
--    Giá trị hiệu lực: Phòng HC sửa tay (override*) thắng AI — như toThreadDto.
-- ===========================================================================
DROP VIEW IF EXISTS v_chatbot_task_threads;
CREATE VIEW v_chatbot_task_threads AS
WITH eff AS (
  SELECT t.*,
         coalesce(t."overrideKind", t.kind) AS eff_kind,
         coalesce(t."overrideStatus", t.status) AS eff_status
  FROM task_threads t
),
dept_latest AS (
  SELECT "departmentId", year, max("lastWeek") AS latest_week
  FROM task_threads GROUP BY 1, 2
)
SELECT
  e.id AS record_id,
  d.name AS department_name,
  e.year,
  e.title,
  e."rawName" AS task_name,
  e."parentGroup" AS parent_group,
  e.eff_kind::text AS kind,
  CASE e.eff_kind WHEN 'ROUTINE' THEN 'Thường kỳ' WHEN 'PROJECT' THEN 'Có tiến độ' WHEN 'ONE_OFF' THEN 'Việc một lần' END AS kind_label,
  e.eff_status::text AS status,
  CASE e.eff_status WHEN 'IN_PROGRESS' THEN 'Đang thực hiện' WHEN 'DONE' THEN 'Hoàn thành'
                    WHEN 'STALLED' THEN 'Đứng yên' WHEN 'STOPPED' THEN 'Ngừng báo cáo' END AS status_label,
  CASE WHEN e.eff_kind = 'ROUTINE' THEN NULL ELSE coalesce(e."overrideProgress", e.progress) END AS progress,
  e."firstWeek" AS first_week,
  e."lastWeek" AS last_week,
  CASE WHEN e.eff_status = 'DONE' THEN coalesce(e."completedWeek", e."lastWeek") END AS completed_week,
  l.latest_week AS department_latest_week,
  l.latest_week - e."lastWeek" AS weeks_since_last_report,
  n.weeks_reported,
  n.last_result_text,
  n.next_week_plan,
  e.evidence,
  (e."needsReview" AND e."overriddenAt" IS NULL) AS needs_review,
  (e."overriddenAt" IS NOT NULL) AS is_overridden,
  e."overrideNote" AS override_note
FROM eff e
JOIN departments d ON d.id = e."departmentId"
JOIN dept_latest l ON l."departmentId" = e."departmentId" AND l.year = e.year
LEFT JOIN LATERAL (
  SELECT count(*) OVER ()::int AS weeks_reported,
         left(regexp_replace(x."resultText", '\s+', ' ', 'g'), 400) AS last_result_text,
         x."nextWeekPlan" AS next_week_plan
  FROM task_thread_entries x
  WHERE x."threadId" = e.id
  ORDER BY x.week DESC, x."sourceRow" DESC
  LIMIT 1
) n ON true;

-- ===========================================================================
-- 3. CRM — chăm sóc đối tác (quà, hoa, ngân sách). Không có tên khách:
--    chỉ đơn vị và chức danh hiện tại, như v_chatbot_vip_summary.
-- ===========================================================================
DROP VIEW IF EXISTS v_chatbot_crm_care_tasks;
CREATE VIEW v_chatbot_crm_care_tasks AS
SELECT
  t.id AS record_id,
  t."occasionDate" AS occasion_date,
  t."occasionDate" - (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS days_until_occasion,
  CASE t."occasionKind" WHEN 'BIRTHDAY' THEN 'Sinh nhật' WHEN 'APPOINTMENT' THEN 'Ngày nhận chức'
                        WHEN 'FOUNDING' THEN 'Ngày thành lập' WHEN 'ANNIVERSARY' THEN 'Ngày kỷ niệm' ELSE 'Khác' END AS occasion_label,
  coalesce(o.name, po.name, 'Không rõ đơn vị') AS organization_name,
  p.title AS contact_position,
  CASE t."giftType" WHEN 'FLOWERS' THEN 'Hoa' WHEN 'GIFT' THEN 'Quà' WHEN 'CARD' THEN 'Thiệp'
                    WHEN 'VISIT' THEN 'Đến thăm' ELSE 'Khác' END AS gift_type_label,
  t.description,
  t.budget AS budget_vnd,
  t."actualCost" AS actual_cost_vnd,
  t.status::text AS status,
  CASE t.status WHEN 'TODO' THEN 'Chưa đặt' WHEN 'ORDERED' THEN 'Đã đặt'
                WHEN 'DELIVERED' THEN 'Đã trao' WHEN 'CANCELLED' THEN 'Đã huỷ' END AS status_label,
  (t."deliveredAt" + interval '7 hours')::date AS delivered_date,
  t."assigneeName" AS assignee_name,
  (SELECT count(*)::int FROM crm_photos ph WHERE ph."careTaskId" = t.id) AS photo_count
FROM crm_care_tasks t
LEFT JOIN crm_organizations o ON o.id = t."organizationId"
LEFT JOIN LATERAL (
  SELECT cp.title, cp."organizationId"
  FROM crm_positions cp
  WHERE cp."contactId" = t."contactId"
  ORDER BY cp."isCurrent" DESC, cp."fromDate" DESC NULLS LAST
  LIMIT 1
) p ON true
LEFT JOIN crm_organizations po ON po.id = p."organizationId";

-- Lượt tiếp đón VIP / dẫn đoàn: từ khi CRM có lịch hẹn (PLANNED) và huỷ
-- (CANCELLED), chỉ đếm lượt ĐÃ THỰC HIỆN. Cột giữ nguyên như view cũ.
CREATE OR REPLACE VIEW v_chatbot_vip_summary AS
SELECT min(i.id) AS record_id,
       i."occurredAt"::date AS visit_date,
       COALESCE(o.name, 'Không rõ đơn vị') AS organization_name,
       i.destination,
       count(*)::integer AS visit_count
FROM crm_interactions i
LEFT JOIN crm_organizations o ON o.id = i."organizationId"
WHERE i.type IN ('VIP_ESCORT', 'DELEGATION')
  AND i.status = 'DONE'
GROUP BY i."occurredAt"::date, COALESCE(o.name, 'Không rõ đơn vị'), i.destination;

-- ===========================================================================
-- Quyền đọc cho user chatbot (bỏ qua nếu môi trường không có role này).
-- ===========================================================================
DO $$ DECLARE view_name text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    FOREACH view_name IN ARRAY ARRAY[
      'v_chatbot_work_items', 'v_chatbot_work_updates',
      'v_chatbot_task_threads', 'v_chatbot_crm_care_tasks',
      'v_chatbot_vip_summary'
    ] LOOP
      EXECUTE format('GRANT SELECT ON %I TO chatbot_readonly', view_name);
    END LOOP;
  END IF;
END $$;
