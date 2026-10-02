-- Tầng dữ liệu cho AI (semantic layer) của chatbot.
--
-- VÌ SAO
-- Dữ liệu gốc được thiết kế cho nhập liệu, không cho hỏi đáp. Đo trên câu hỏi
-- thật ngày 01/10/2026, chatbot có dữ liệu nhưng trả lời sai vì:
--   - Số liệu Phòng HC là bảng DỌC (mỗi dòng một chỉ tiêu, tên dài như
--     "Nhỡ do không bắt máy (Nhánh 3-PKQT)"): model phải tự ghép tên, hay chọn
--     nhầm — hỏi "vé" mà trả doanh thu.
--   - Chuyến xe là dữ liệu TỪNG CHUYẾN: model lấy 50 dòng đầu rồi tự cộng —
--     "nhiên liệu tháng 9" chỉ cộng tuần đầu tháng.
--   - Chỉ số báo cáo tuần: 2.544 tên, trong đó 1.496 tên chỉ xuất hiện đúng
--     1 tuần (con số rời trích từ văn bản). Model không phân biệt được chuỗi
--     chính ("Ca ghép gan luỹ kế", 34 tuần) với con số nhắc thoáng qua.
--
-- CÁCH LÀM
-- Chỉ thêm VIEW, không sửa bảng: dashboard và luồng nhập liệu vẫn dùng bảng gốc
-- như cũ. Mỗi view theo một chủ đề, mỗi kỳ một dòng, cột tên rõ nghĩa — model
-- chỉ việc lọc và SUM. Muốn gỡ chỉ cần DROP VIEW.
--
-- Số tuần ở các view Phòng HC theo đánh số trong file Phòng HC. Từ tuần
-- 34/2026 số này lệch 1 so với báo cáo tuần bệnh viện (báo cáo tuần ghi trùng
-- một con số cho tuần 34 và 35), nên các view đều kèm cột month.

-- ===========================================================================
-- A. SỐ LIỆU PHÒNG HÀNH CHÍNH — xoay bảng dọc hc_metrics thành bảng ngang
-- ===========================================================================

-- A1. Bãi giữ xe
CREATE OR REPLACE VIEW v_chatbot_parking_weekly AS
SELECT
  year, week, max(month) AS month,
  max(value) FILTER (WHERE content ILIKE 'doanh thu%')            AS revenue_vnd,
  max(value) FILTER (WHERE content ILIKE '%lượt vé ngày%')        AS daily_tickets,
  max(value) FILTER (WHERE content ILIKE '%lượt vé tháng%')       AS monthly_tickets,
  max(value) FILTER (WHERE content ILIKE 'công suất%')            AS avg_daily_vehicles,
  max(value) FILTER (WHERE content ILIKE '%khiếu nại%')           AS complaints
FROM hc_metrics
WHERE category = 'Bãi giữ xe'
GROUP BY year, week;

-- A2. Tổ xe (số liệu tổng hợp Phòng HC báo cáo mỗi tuần)
CREATE OR REPLACE VIEW v_chatbot_fleet_report_weekly AS
SELECT
  year, week, max(month) AS month,
  max(value) FILTER (WHERE content ILIKE 'số chuyến%')            AS trips,
  max(value) FILTER (WHERE content ILIKE 'tổng km%')              AS total_km,
  max(value) FILTER (WHERE content ILIKE '%km%hành chính%')       AS admin_km,
  max(value) FILTER (WHERE content ILIKE '%km%cứu thương%')       AS ambulance_km,
  max(value) FILTER (WHERE content ILIKE '%nhiên liệu%')          AS fuel_liters,
  max(value) FILTER (WHERE content ILIKE 'doanh thu%')            AS revenue_vnd,
  max(value) FILTER (WHERE content ILIKE 'chi phí bảo dưỡng%')    AS maintenance_cost_vnd,
  max(value) FILTER (WHERE content ILIKE 'tỷ lệ hài lòng%')       AS satisfaction_rate,
  max(value) FILTER (WHERE content ILIKE '%phiếu khảo sát%')      AS survey_count
FROM hc_metrics
WHERE category = 'Tổ xe'
GROUP BY year, week;

-- A3. Tổng đài — toàn viện
CREATE OR REPLACE VIEW v_chatbot_switchboard_weekly AS
SELECT
  year, week, max(month) AS month,
  max(value) FILTER (WHERE content ILIKE 'tổng số cuộc gọi đến%')               AS total_calls,
  max(value) FILTER (WHERE content ILIKE 'tổng số cuộc gọi nhỡ do không bắt%')  AS missed_no_answer,
  max(value) FILTER (WHERE content ILIKE 'tổng số cuộc gọi nhỡ do từ chối%')    AS missed_rejected,
  max(value) FILTER (WHERE content ILIKE 'hot%line%')                           AS hotline_calls
FROM hc_metrics
WHERE category = 'Tổng đài'
GROUP BY year, week;

-- A4. Tổng đài — theo từng nhánh (0 Tổng đài viên, 1 Cấp cứu, 2 Tư vấn thuốc, 3 PKQT, 4 Vấn đề khác)
CREATE OR REPLACE VIEW v_chatbot_switchboard_branch_weekly AS
SELECT
  year, week, max(month) AS month,
  substring(content FROM 'Nhánh\s*(\d)')::int                                    AS branch_no,
  CASE substring(content FROM 'Nhánh\s*(\d)')
    WHEN '0' THEN 'Tổng đài viên' WHEN '1' THEN 'Cấp cứu' WHEN '2' THEN 'Tư vấn thuốc'
    WHEN '3' THEN 'PKQT' WHEN '4' THEN 'Vấn đề khác' END                         AS branch_name,
  max(value) FILTER (WHERE content ILIKE 'số cuộc gọi đến%')                     AS calls,
  max(value) FILTER (WHERE content ILIKE 'nhỡ do không bắt máy%')                AS missed_no_answer,
  max(value) FILTER (WHERE content ILIKE 'nhỡ do từ chối%')                      AS missed_rejected
FROM hc_metrics
WHERE category = 'Tổng đài' AND content ~ 'Nhánh\s*\d'
GROUP BY year, week, substring(content FROM 'Nhánh\s*(\d)');

-- A5. Văn bản đến và văn bản phát hành
CREATE OR REPLACE VIEW v_chatbot_documents_weekly AS
SELECT
  year, week, max(month) AS month,
  max(value) FILTER (WHERE category = 'Văn bản đến' AND content ILIKE 'tổng số%')       AS incoming_total,
  max(value) FILTER (WHERE category = 'Văn bản đến' AND content ILIKE '%đúng hạn%')     AS incoming_on_time,
  max(value) FILTER (WHERE category = 'Văn bản đến' AND content ILIKE '%trễ hạn%')      AS incoming_late,
  max(value) FILTER (WHERE category = 'Văn bản phát hành' AND content ILIKE 'văn bản đi%') AS outgoing_letters,
  max(value) FILTER (WHERE category = 'Văn bản phát hành' AND content ILIKE 'quyết định%') AS decisions,
  max(value) FILTER (WHERE category = 'Văn bản phát hành' AND content ILIKE 'quy định%')   AS regulations,
  max(value) FILTER (WHERE category = 'Văn bản phát hành' AND content ILIKE 'quy chế%')    AS statutes,
  max(value) FILTER (WHERE category = 'Văn bản phát hành' AND content ILIKE 'quy trình%')  AS procedures,
  max(value) FILTER (WHERE category = 'Văn bản phát hành' AND content ILIKE 'hướng dẫn%')  AS guidelines,
  max(value) FILTER (WHERE category = 'Văn bản phát hành' AND content ILIKE 'hợp đồng%')   AS contracts
FROM hc_metrics
WHERE category IN ('Văn bản đến', 'Văn bản phát hành')
GROUP BY year, week;

-- A6. Hoạt động hành chính khác: sự kiện, đoàn khách, VIP, lễ tân, họp trực tuyến, tin ĐHTN
CREATE OR REPLACE VIEW v_chatbot_admin_activity_weekly AS
SELECT
  year, week, max(month) AS month,
  max(value) FILTER (WHERE category = 'Sự kiện' AND content ILIKE 'tổng số%')                 AS events_total,
  max(value) FILTER (WHERE category = 'Sự kiện' AND content ILIKE '%chủ trì%')                AS events_hosted,
  max(value) FILTER (WHERE category = 'Sự kiện' AND content ILIKE '%phối hợp%')               AS events_supported,
  max(value) FILTER (WHERE category = 'Tiếp khách trong nước' AND content ILIKE 'tổng số%')   AS domestic_delegations,
  max(value) FILTER (WHERE category = 'Tiếp khách trong nước' AND content ILIKE 'làm việc%')  AS delegations_working,
  max(value) FILTER (WHERE category = 'Tiếp khách trong nước' AND content ILIKE 'tham quan%') AS delegations_study_visit,
  max(value) FILTER (WHERE category = 'Đón tiếp khách VIP')                                    AS vip_visits,
  max(value) FILTER (WHERE category = 'Lễ tân')                                                AS reception_conference_support,
  max(value) FILTER (WHERE category = 'Tổ chức cuộc họp trực tuyến')                           AS online_meetings,
  max(value) FILTER (WHERE category = 'Trang điều hành tác nghiệp')                            AS dhtn_posts
FROM hc_metrics
WHERE category IN ('Sự kiện', 'Tiếp khách trong nước', 'Đón tiếp khách VIP', 'Lễ tân',
                   'Tổ chức cuộc họp trực tuyến', 'Trang điều hành tác nghiệp')
GROUP BY year, week;

-- A7. Hệ thống thư ký bệnh viện
CREATE OR REPLACE VIEW v_chatbot_secretary_weekly AS
SELECT
  year, week, max(month) AS month,
  max(value) FILTER (WHERE content ILIKE 'tổng số thư ký%')                     AS total_secretaries,
  max(value) FILTER (WHERE content ILIKE '%thư ký hành chính%')                 AS admin_secretaries,
  max(value) FILTER (WHERE content ILIKE '%thư ký chuyên môn%')                 AS professional_secretaries,
  max(value) FILTER (WHERE content ILIKE '%được sơ tuyển%')                     AS prescreened,
  max(value) FILTER (WHERE content ILIKE '%được tuyển dụng%')                   AS recruited,
  max(value) FILTER (WHERE content ILIKE '%nhận việc%')                         AS onboarded,
  max(value) FILTER (WHERE content ILIKE '%nghỉ việc%')                         AS resigned,
  max(value) FILTER (WHERE content ILIKE '%được điều động%')                    AS transferred,
  max(value) FILTER (WHERE content ILIKE 'số buổi tập huấn%')                   AS training_sessions,
  max(value) FILTER (WHERE content ILIKE '%tham gia tập huấn%')                 AS training_participants,
  max(value) FILTER (WHERE content ILIKE 'số buổi tham quan%')                  AS study_visits,
  max(value) FILTER (WHERE content ILIKE '%tham gia tham quan%')                AS study_visit_participants,
  max(value) FILTER (WHERE content ILIKE 'số buổi sinh hoạt%')                  AS meetings,
  max(value) FILTER (WHERE content ILIKE '%tham gia sinh hoạt%')                AS meeting_participants
FROM hc_metrics
WHERE category = 'Hệ thống thư ký Bệnh viện'
GROUP BY year, week;

-- ===========================================================================
-- B. CHUYẾN XE — gom theo ngày × xe (nguồn: Dashboard Tổ Xe)
--
-- km chỉ cộng quãng đường đáng tin: bỏ chuyến UNFIXABLE và chuyến có km ước
-- từ giờ lái khi giờ lái quá 16 giờ (nhập sai — từng sinh chuyến 2.401 km).
-- Không có tên tài xế (giữ chính sách của v_chatbot_fleet_summary).
-- ===========================================================================
CREATE OR REPLACE VIEW v_chatbot_fleet_daily AS
SELECT
  f."recordDate"::date                                                   AS trip_date,
  EXTRACT(YEAR FROM f."recordDate")::int                                 AS year,
  EXTRACT(MONTH FROM f."recordDate")::int                                AS month,
  f."vehicleId"                                                          AS license_plate,
  f."vehicleType"                                                        AS vehicle_type,
  count(*)::int                                                          AS trips,
  round(coalesce(sum(f."distanceKm") FILTER (WHERE trusted.ok), 0)::numeric, 1) AS km,
  count(*) FILTER (WHERE NOT trusted.ok)::int                            AS trips_km_excluded,
  round(coalesce(sum(f."fuelLiters"), 0)::numeric, 1)                    AS fuel_liters,
  count(*) FILTER (WHERE f."fuelLiters" > 0)::int                        AS refuels,
  coalesce(sum(f."revenueVnd"), 0)::numeric                              AS revenue_vnd,
  round(coalesce(sum(f."durationHours") FILTER (WHERE f."durationHours" <= 16), 0)::numeric, 1) AS hours
FROM fleet_trips f
CROSS JOIN LATERAL (
  SELECT f."distanceKm" IS NOT NULL
     AND coalesce(f."distanceFixMethod"::text, 'NONE') <> 'UNFIXABLE'
     AND NOT (coalesce(f."distanceFixMethod"::text, 'NONE') = 'ESTIMATED_FROM_HOURS'
              AND coalesce(f."durationHours", 0) > 16) AS ok
) trusted
GROUP BY f."recordDate"::date, EXTRACT(YEAR FROM f."recordDate"), EXTRACT(MONTH FROM f."recordDate"),
         f."vehicleId", f."vehicleType";

-- ===========================================================================
-- C. CHỈ SỐ BÁO CÁO TUẦN — danh mục để AI chọn đúng chỉ số
--
-- Mỗi (phòng, tên chỉ số) một dòng: có bao nhiêu tuần dữ liệu, tuần đầu/cuối,
-- giá trị mới nhất. is_series = có từ 3 tuần trở lên = chuỗi theo dõi thật;
-- còn lại là con số rời trích từ văn bản báo cáo.
-- ===========================================================================
CREATE OR REPLACE VIEW v_chatbot_metric_catalog AS
WITH ranked AS (
  SELECT
    d.name AS department_name, m.name AS metric_name, m.unit, m.period::text AS period,
    w.year, w."weekNumber" AS week_number, m.value,
    row_number() OVER (PARTITION BY d.name, m.name ORDER BY w.year DESC, w."weekNumber" DESC, m.value DESC) AS rn
  FROM extracted_metrics m
  JOIN weeks w       ON w.id = m."weekId"
  JOIN departments d ON d.id = m."departmentId"
  WHERE d."deletedAt" IS NULL
)
SELECT
  department_name,
  metric_name,
  max(unit)                                                   AS metric_unit,
  max(period) FILTER (WHERE rn = 1)                           AS period,
  count(DISTINCT (year, week_number))::int                    AS weeks_with_data,
  (count(DISTINCT (year, week_number)) >= 3)                  AS is_series,
  min(year * 100 + week_number)                               AS first_year_week,
  max(year * 100 + week_number)                               AS last_year_week,
  max(value) FILTER (WHERE rn = 1)                            AS latest_value
FROM ranked
GROUP BY department_name, metric_name;

-- ===========================================================================
-- D. LỊCH TUẦN BÁO CÁO — để hiểu "tuần này", "tuần trước"
-- ===========================================================================
CREATE OR REPLACE VIEW v_chatbot_weeks AS
SELECT
  "weekNumber"                                                         AS week_number,
  year,
  "startDate"::date                                                    AS week_start,
  "endDate"::date                                                      AS week_end,
  ("year", "weekNumber") = (SELECT year, "weekNumber" FROM weeks ORDER BY year DESC, "weekNumber" DESC LIMIT 1) AS is_latest
FROM weeks;

-- ===========================================================================
-- Quyền đọc cho user chatbot (bỏ qua nếu môi trường không có role này).
-- ===========================================================================
DO $$ DECLARE view_name text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    FOREACH view_name IN ARRAY ARRAY[
      'v_chatbot_parking_weekly', 'v_chatbot_fleet_report_weekly',
      'v_chatbot_switchboard_weekly', 'v_chatbot_switchboard_branch_weekly',
      'v_chatbot_documents_weekly', 'v_chatbot_admin_activity_weekly',
      'v_chatbot_secretary_weekly', 'v_chatbot_fleet_daily',
      'v_chatbot_metric_catalog', 'v_chatbot_weeks'
    ] LOOP
      EXECUTE format('GRANT SELECT ON %I TO chatbot_readonly', view_name);
    END LOOP;
  END IF;
END $$;
