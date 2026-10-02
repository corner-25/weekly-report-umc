-- Danh mục chỉ số chuẩn (cây cha/con theo phòng) + tên gọi khác + view số liệu hợp nhất.
-- Chỉ thêm bảng/view, không sửa bảng cũ.

-- CreateTable
CREATE TABLE "metric_nodes" (
    "code" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "parentCode" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unit" TEXT,
    "aggregation" TEXT,
    "hcCategory" TEXT,
    "hcContent" TEXT,
    "origin" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_nodes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "metric_aliases" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "aliasName" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "nodeCode" TEXT,
    "status" TEXT NOT NULL,
    "candidates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decidedBy" TEXT NOT NULL,
    "model" TEXT,
    "weeksSeen" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_nodes_departmentId_idx" ON "metric_nodes"("departmentId");

-- CreateIndex
CREATE INDEX "metric_nodes_parentCode_idx" ON "metric_nodes"("parentCode");

-- CreateIndex
CREATE INDEX "metric_aliases_nodeCode_idx" ON "metric_aliases"("nodeCode");

-- CreateIndex
CREATE UNIQUE INDEX "metric_aliases_departmentId_aliasName_unit_key" ON "metric_aliases"("departmentId", "aliasName", "unit");

-- AddForeignKey
ALTER TABLE "metric_nodes" ADD CONSTRAINT "metric_nodes_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "metric_nodes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_aliases" ADD CONSTRAINT "metric_aliases_nodeCode_fkey" FOREIGN KEY ("nodeCode") REFERENCES "metric_nodes"("code") ON DELETE SET NULL ON UPDATE CASCADE;


-- ===========================================================================
-- Cây chỉ số kèm đường dẫn đầy đủ — để chatbot TÌM chỉ số theo tên/nhóm.
-- ===========================================================================
CREATE OR REPLACE VIEW v_chatbot_metric_tree AS
WITH RECURSIVE tree AS (
  SELECT n.code, n.name::text AS path, 0 AS depth
  FROM metric_nodes n WHERE n."parentCode" IS NULL
  UNION ALL
  SELECT c.code,
         CASE WHEN t.depth = 0 THEN c.name ELSE t.path || ' > ' || c.name END,
         t.depth + 1
  FROM metric_nodes c JOIN tree t ON c."parentCode" = t.code
)
SELECT d.name AS department_name, n.code AS metric_code, n."parentCode" AS parent_code,
       t.path AS metric_path, n.name AS metric_name, n.kind, n.unit, n.aggregation,
       t.depth, n.origin
FROM metric_nodes n
JOIN tree t ON t.code = n.code
JOIN departments d ON d.id = n."departmentId"
WHERE n."isActive";

-- ===========================================================================
-- Số liệu hợp nhất: mỗi chỉ số, mỗi tuần ĐÚNG MỘT con số.
--
-- Ưu tiên nguồn đọc thẳng (file số liệu Excel của phòng — hc_metrics); chỉ khi
-- tuần đó Excel không có mới lấy số AI trích từ báo cáo tuần. Cột source cho
-- biết số lấy từ đâu. Tên AI được quy về chỉ số chuẩn qua metric_aliases:
--   MAPPED → chỉ số đã gắn
--   VALUE  → tên dùng chung ("Doanh thu"), nhận chỉ số nào trong candidates
--            có giá trị Excel cùng tuần bằng đúng số này
-- ===========================================================================
CREATE OR REPLACE VIEW v_chatbot_metric_facts AS
WITH excel AS (
  SELECT n.code, h.year, h.week, h.month, h.value
  FROM metric_nodes n
  JOIN hc_metrics h ON h.category = n."hcCategory" AND h.content = n."hcContent"
  WHERE n."isActive"
),
report_raw AS (
  SELECT w.year, w."weekNumber" AS week, e.value, a."nodeCode", a.status, a.candidates, a."weeksSeen"
  FROM extracted_metrics e
  JOIN weeks w ON w.id = e."weekId"
  JOIN metric_aliases a
    ON a."departmentId" = e."departmentId" AND a."aliasName" = e.name AND a.unit = coalesce(e.unit, '')
  WHERE a.status IN ('MAPPED', 'VALUE') AND e.period = 'WEEK'
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
  -- Nhiều cách viết cùng tuần: lấy cách viết phổ biến nhất.
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

DO $$ DECLARE view_name text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    FOREACH view_name IN ARRAY ARRAY['v_chatbot_metric_tree', 'v_chatbot_metric_facts'] LOOP
      EXECUTE format('GRANT SELECT ON %I TO chatbot_readonly', view_name);
    END LOOP;
  END IF;
END $$;
