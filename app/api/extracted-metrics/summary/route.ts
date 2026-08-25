/**
 * Tóm tắt chỉ số cho màn hình quản trị.
 *
 * Trang bảng số liệu trước đây kéo toàn bộ 8.685 bản ghi về trình duyệt rồi dựng
 * lưới 2.627 hàng × 31 cột. Hầu hết ô trống: 1.701 chỉ số chỉ xuất hiện đúng
 * MỘT lần trong cả năm — AI trích từ một câu văn rồi tuần sau không còn.
 *
 * Một chỉ số xuất hiện một lần thì không theo dõi được xu hướng, nên với người
 * quản lý nó là nhiễu. Ở đây chỉ trả về chỉ số BỀN VỮNG — xuất hiện đủ nhiều
 * tuần để thấy được nó đang tăng hay giảm — kèm sẵn giá trị mới nhất, giá trị
 * trước đó và mức thay đổi.
 *
 * Tính toàn bộ bằng SQL: gom 8.685 bản ghi thành vài trăm dòng ngay tại database
 * thay vì chuyển hết qua mạng rồi gom bằng JavaScript.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Số tuần tối thiểu để một chỉ số đáng đưa lên màn hình quản trị.
 *
 * Dưới ngưỡng này thì không đủ điểm để nói xu hướng. Đo trên dữ liệu thật: ngưỡng
 * 8 giữ lại 281 chỉ số từ 2.627 tên — đúng phần có ý nghĩa theo dõi.
 */
const MIN_WEEKS_FOR_TREND = 8;

interface MetricSummaryRow {
  departmentId: string;
  departmentName: string;
  name: string;
  unit: string | null;
  weekCount: bigint;
  latestWeek: number;
  latestValue: number;
  previousValue: number | null;
  /** Số bản ghi của chỉ số này bị đánh dấu cần rà soát. */
  flaggedCount: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year')) || new Date().getFullYear();
  const departmentId = searchParams.get('departmentId');
  const minWeeks = Number(searchParams.get('minWeeks')) || MIN_WEEKS_FOR_TREND;

  const deptFilter = departmentId && departmentId !== 'all' ? departmentId : null;

  // Xếp hạng theo tuần để lấy giá trị mới nhất và liền trước trong một lượt quét.
  // Một tuần có thể trích cùng tên nhiều lần; giữ bản tin cậy cao nhất.
  const rows = await prisma.$queryRaw<MetricSummaryRow[]>`
    WITH per_week AS (
      SELECT DISTINCT ON (m."departmentId", m.name, w."weekNumber")
        m."departmentId",
        m.name,
        m.unit,
        w."weekNumber",
        m.value,
        coalesce(array_length(m."reviewFlags", 1), 0) AS flag_count
      FROM extracted_metrics m
      JOIN weeks w ON w.id = m."weekId"
      WHERE w.year = ${year}
        AND (${deptFilter}::text IS NULL OR m."departmentId" = ${deptFilter})
      ORDER BY m."departmentId", m.name, w."weekNumber", m.confidence DESC
    ),
    ranked AS (
      SELECT *,
        row_number() OVER (PARTITION BY "departmentId", name ORDER BY "weekNumber" DESC) AS rn
      FROM per_week
    )
    SELECT
      r."departmentId",
      d.name AS "departmentName",
      r.name,
      max(r.unit) AS unit,
      count(*)::bigint AS "weekCount",
      max(r."weekNumber") FILTER (WHERE r.rn = 1) AS "latestWeek",
      max(r.value) FILTER (WHERE r.rn = 1) AS "latestValue",
      max(r.value) FILTER (WHERE r.rn = 2) AS "previousValue",
      max(r.flag_count) AS "flaggedCount",
      min(r.value) AS "minValue",
      max(r.value) AS "maxValue",
      avg(r.value) AS "avgValue"
    FROM ranked r
    JOIN departments d ON d.id = r."departmentId"
    GROUP BY r."departmentId", d.name, r.name
    HAVING count(*) >= ${minWeeks}
    ORDER BY d.name, r.name
  `;

  // BigInt không tuần tự hoá được sang JSON.
  return NextResponse.json(
    rows.map((r) => ({ ...r, weekCount: Number(r.weekCount) })),
  );
}
