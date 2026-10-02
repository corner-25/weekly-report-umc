-- Trích số liệu theo danh mục: AI chọn thẳng mã chỉ số chuẩn thay vì tự đặt tên.
ALTER TABLE "extracted_metrics" ADD COLUMN "metricCode" TEXT;
CREATE INDEX "extracted_metrics_metricCode_idx" ON "extracted_metrics"("metricCode");

-- Số liệu hợp nhất: ưu tiên mã AI chọn lúc trích, sau đó mới tra bảng tên gọi.
CREATE OR REPLACE VIEW v_chatbot_metric_facts AS
WITH excel AS (
  SELECT n.code, h.year, h.week, h.month, h.value
  FROM metric_nodes n
  JOIN hc_metrics h ON h.category = n."hcCategory" AND h.content = n."hcContent"
  WHERE n."isActive"
),
report_raw AS (
  SELECT w.year, w."weekNumber" AS week, e.value,
         coalesce(n.code, a."nodeCode") AS "nodeCode",
         CASE WHEN n.code IS NOT NULL THEN 'MAPPED' ELSE a.status END AS status,
         coalesce(a.candidates, ARRAY[]::text[]) AS candidates,
         CASE WHEN n.code IS NOT NULL THEN 1000000 ELSE coalesce(a."weeksSeen", 0) END AS "weeksSeen"
  FROM extracted_metrics e
  JOIN weeks w ON w.id = e."weekId"
  LEFT JOIN metric_nodes n ON n.code = e."metricCode" AND n."departmentId" = e."departmentId" AND n."isActive"
  LEFT JOIN metric_aliases a
    ON a."departmentId" = e."departmentId" AND a."aliasName" = e.name AND a.unit = coalesce(e.unit, '')
  WHERE e.period = 'WEEK'
    AND (n.code IS NOT NULL OR a.status IN ('MAPPED', 'VALUE'))
),
report_resolved AS (
  SELECT "nodeCode" AS code, year, week, value, "weeksSeen" FROM report_raw WHERE status = 'MAPPED'
  UNION ALL
  SELECT c.code, r.year, r.week, r.value, r."weeksSeen"
  FROM report_raw r
  CROSS JOIN LATERAL unnest(r.candidates) AS c(code)
  JOIN excel x ON x.code = c.code AND x.year = r.year AND x.week = r.week AND x.value = r.value
  WHERE r.status = 'VALUE'
),
report AS (
  -- Nhiều số cho cùng chỉ số-tuần: ưu tiên số AI gắn mã, rồi cách viết phổ biến nhất.
  SELECT DISTINCT ON (code, year, week) code, year, week, value
  FROM report_resolved
  ORDER BY code, year, week, "weeksSeen" DESC, value DESC
),
facts AS (
  SELECT code, year, week, month, value, 'EXCEL'::text AS source FROM excel
  UNION ALL
  SELECT r.code, r.year, r.week, NULL::int, r.value, 'REPORT'::text
  FROM report r
  WHERE NOT EXISTS (SELECT 1 FROM excel x WHERE x.code = r.code AND x.year = r.year AND x.week = r.week)
)
SELECT t.department_name, f.code AS metric_code, t.metric_path, t.metric_name,
       p.name AS parent_name, t.unit, t.aggregation,
       f.year, f.week AS week_number,
       coalesce(f.month, extract(month FROM w."endDate")::int) AS month,
       w."startDate" AS week_start, w."endDate" AS week_end,
       f.value, f.source
FROM facts f
JOIN v_chatbot_metric_tree t ON t.metric_code = f.code
JOIN metric_nodes n ON n.code = f.code
LEFT JOIN metric_nodes p ON p.code = n."parentCode"
LEFT JOIN weeks w ON w.year = f.year AND w."weekNumber" = f.week;
