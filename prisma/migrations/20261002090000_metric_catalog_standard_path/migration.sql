-- Đánh dấu tên chỉ số thô nào đã gộp vào danh mục chuẩn.
--
-- Trước đây kho gợi ý của chatbot bỏ TOÀN BỘ tên thô của phòng đã chuẩn hoá.
-- Với phòng báo cáo chủ yếu bằng văn xuôi (Công tác Xã hội: 17% lượt dữ liệu
-- gắn được vào cây) như vậy là mất phần lớn con số chatbot đang tìm được.
-- Nay chỉ bỏ tên đã gắn (standard_metric_path khác NULL); con số rời vẫn giữ.
--
-- CREATE OR REPLACE chỉ thêm cột vào CUỐI view — được phép, không phá cột cũ.
CREATE OR REPLACE VIEW v_chatbot_metric_catalog AS
WITH ranked AS (
  SELECT d.name AS department_name,
         m.name AS metric_name,
         m.unit,
         m.period::text AS period,
         w.year,
         w."weekNumber" AS week_number,
         m.value,
         row_number() OVER (PARTITION BY d.name, m.name ORDER BY w.year DESC, w."weekNumber" DESC, m.value DESC) AS rn
  FROM extracted_metrics m
  JOIN weeks w ON w.id = m."weekId"
  JOIN departments d ON d.id = m."departmentId"
  WHERE d."deletedAt" IS NULL
),
standard AS (
  -- Một tên có thể có nhiều đơn vị; chỉ cần một cách viết đã gắn là đủ.
  SELECT DISTINCT ON (d.name, a."aliasName") d.name AS department_name, a."aliasName" AS metric_name, t.metric_path
  FROM metric_aliases a
  JOIN departments d ON d.id = a."departmentId"
  JOIN v_chatbot_metric_tree t ON t.metric_code = a."nodeCode"
  WHERE a.status = 'MAPPED'
  ORDER BY d.name, a."aliasName", a."weeksSeen" DESC
)
SELECT r.department_name,
       r.metric_name,
       max(r.unit) AS metric_unit,
       max(r.period) FILTER (WHERE r.rn = 1) AS period,
       count(DISTINCT ROW(r.year, r.week_number))::integer AS weeks_with_data,
       count(DISTINCT ROW(r.year, r.week_number)) >= 3 AS is_series,
       min(r.year * 100 + r.week_number) AS first_year_week,
       max(r.year * 100 + r.week_number) AS last_year_week,
       max(r.value) FILTER (WHERE r.rn = 1) AS latest_value,
       max(s.metric_path) AS standard_metric_path
FROM ranked r
LEFT JOIN standard s ON s.department_name = r.department_name AND s.metric_name = r.metric_name
GROUP BY r.department_name, r.metric_name;
