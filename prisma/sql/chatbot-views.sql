-- Các view chatbot được phép truy vấn.
--
-- Chatbot sinh SQL từ câu hỏi người dùng nên chỉ cho đọc view, không cho chạm
-- bảng gốc: view lọc sẵn dữ liệu đã xoá mềm, đổi tên cột sang dạng dễ hiểu, và
-- không lộ cột nhạy cảm.
--
-- Chạy lại an toàn: xoá rồi tạo lại. Dùng DROP thay vì CREATE OR REPLACE vì
-- lệnh đó không cho đổi tên hay thứ tự cột — mà view chỉ số vừa đổi nguồn dữ
-- liệu nên cấu trúc khác hẳn bản cũ.

-- ---------------------------------------------------------------------------
-- 1. Chỉ số định lượng
--
-- Trước đây view này đọc `week_metric_values` — bảng nhập tay đã dừng ở tuần 22
-- vì từ khi pipeline AI chạy thì không ai nhập nữa. Chatbot vì thế trả lời bằng
-- dữ liệu cũ ba tháng. Nay đọc `extracted_metrics`: 9.140 số liệu, 34 tuần.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_chatbot_metrics;
CREATE VIEW v_chatbot_metrics AS
SELECT
  w."weekNumber"                          AS week_number,
  w.year,
  w."startDate"                           AS week_start,
  w."endDate"                             AS week_end,
  d.name                                  AS department_name,
  m.name                                  AS metric_name,
  m.unit                                  AS metric_unit,
  m.value,
  m.period::text                          AS period,
  m."asOfDate"                            AS as_of_date,
  m."sourceText"                          AS source_text,
  -- Dấu hiệu nghi nhập sai; rỗng nghĩa là không có vấn đề gì.
  m."reviewFlags"                         AS review_flags,
  m."reviewStatus"::text                  AS review_status
FROM extracted_metrics m
JOIN weeks w       ON w.id = m."weekId"
JOIN departments d ON d.id = m."departmentId"
WHERE d."deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Nhiệm vụ và tiến độ tuần
--
-- Thêm `result_text` (nội dung báo cáo tự do) để chatbot trả lời được câu hỏi
-- kiểu "Phòng CNTT tuần rồi làm gì?", không chỉ số liệu định lượng.
--
-- `progress_meaning` cho biết con số tiến độ có ý nghĩa hay không: nhiệm vụ
-- thường quy tuần nào cũng ghi 100% nên trung bình cộng là vô nghĩa.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_chatbot_tasks;
CREATE VIEW v_chatbot_tasks AS
SELECT
  w."weekNumber"                          AS week_number,
  w.year,
  w."startDate"                           AS week_start,
  w."endDate"                             AS week_end,
  d.name                                  AS department_name,
  t.name                                  AS task_name,
  t."progressType"::text                  AS task_type,
  t."progressMeaning"::text               AS progress_meaning,
  p.progress                              AS progress_percent,
  p."rawResultText"                       AS result_text,
  p.subject,
  t."isActive"                            AS is_active,
  t."lastSeenWeek"                        AS last_seen_week
FROM week_task_progress p
JOIN weeks w        ON w.id = p."weekId"
JOIN master_tasks t ON t.id = p."masterTaskId"
JOIN departments d  ON d.id = t."departmentId"
WHERE d."deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Phương tiện: hồ sơ, giấy tờ, bảo dưỡng
--
-- Ba nơi nối với nhau qua khoá ngoại nên một câu hỏi kiểu "xe nào sắp hết đăng
-- kiểm" trả lời được bằng một truy vấn.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_chatbot_vehicles;
CREATE VIEW v_chatbot_vehicles AS
SELECT
  v."licensePlate"                        AS license_plate,
  v.brand,
  v.model,
  v.category::text                        AS category,
  v.status::text                          AS status,
  v."manufactureYear"                     AS manufacture_year,
  v."inspectionExpiry"                    AS inspection_expiry,
  v."insuranceExpiry"                     AS insurance_expiry,
  v."ownerName"                           AS owner_name,
  (SELECT count(*) FROM fleet_trips f WHERE f."vehicleRefId" = v.id)          AS trip_count,
  (SELECT max(f."recordDate") FROM fleet_trips f WHERE f."vehicleRefId" = v.id) AS last_trip_date,
  (SELECT count(*) FROM licenses l WHERE l."vehicleId" = v.id)                AS license_count,
  (SELECT count(*) FROM vehicle_maintenance_logs mt WHERE mt."vehicleId" = v.id) AS maintenance_count,
  (SELECT max(mt.date) FROM vehicle_maintenance_logs mt WHERE mt."vehicleId" = v.id) AS last_maintenance_date
FROM vehicles v
WHERE v."deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Lịch sử bảo dưỡng từng xe
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_chatbot_maintenance;
CREATE VIEW v_chatbot_maintenance AS
SELECT
  v."licensePlate"                        AS license_plate,
  mt.date                                 AS maintenance_date,
  mt.odometer,
  mt.category                             AS maintenance_type,
  mt.description,
  mt.workshop,
  mt."costAmount"                         AS cost_amount,
  mt."odometerStatus"                     AS odometer_status
FROM vehicle_maintenance_logs mt
JOIN vehicles v ON v.id = mt."vehicleId"
WHERE v."deletedAt" IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Chuyến xe
--
-- Không lộ tên tài xế ở mức chi tiết từng chuyến để tránh biến chatbot thành
-- công cụ theo dõi cá nhân; ai cần thì xem dashboard Tổ Xe.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_chatbot_fleet_summary;
CREATE VIEW v_chatbot_fleet_summary AS
SELECT
  f."recordDate"                          AS record_date,
  f."vehicleId"                           AS license_plate,
  f."vehicleType"                         AS vehicle_type,
  f."distanceKm"                          AS distance_km,
  f."fuelLiters"                          AS fuel_liters,
  f."revenueVnd"                          AS revenue_vnd,
  f."durationHours"                       AS duration_hours,
  f."workCategory"                        AS work_category,
  f."areaType"                            AS area_type,
  f."odometerStatus"                      AS odometer_status
FROM fleet_trips f;
