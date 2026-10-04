/**
 * Dữ liệu trang "Số liệu theo dõi": chỉ số CHUẨN (cây chỉ số từng phòng) theo
 * tuần, gom theo phòng → nhóm → chỉ số, kèm sẵn so sánh tuần trước.
 *
 * Lấy từ v_chatbot_metric_facts — mỗi chỉ số-tuần đúng một số, số Excel của
 * phòng được ưu tiên hơn số AI trích từ báo cáo. Trước đây trang dựa trên tên AI
 * tự đặt nên một chỉ số tách thành nhiều dòng và số đọc nhầm vẫn hiện ra.
 */
import type { PrismaClient } from '@prisma/client';

/** Thay đổi trên ngưỡng này so với tuần trước mới coi là đáng chú ý. */
export const NOTABLE_CHANGE_PERCENT = 15;
/** Số tuần gần nhất dùng cho đường xu hướng và trung bình. */
const RECENT_WEEKS = 12;

interface FactRow {
  department_name: string;
  metric_code: string;
  metric_path: string;
  metric_name: string;
  unit: string | null;
  aggregation: string | null;
  week_number: number;
  value: number;
  source: string;
}

export interface BoardPoint {
  week: number;
  value: number;
  source: 'EXCEL' | 'REPORT';
}

export interface BoardMetric {
  code: string;
  name: string;
  /** Đường dẫn trong nhóm, bỏ tên nhóm (vd "Tổng số văn bản đến"). */
  subPath: string;
  unit: string | null;
  aggregation: string | null;
  series: BoardPoint[];
  latest: BoardPoint;
  previous: BoardPoint | null;
  /** % so với lần báo cáo trước; null khi không so được. */
  changePercent: number | null;
  recentAverage: number;
  /** Số tuần trong năm có bản AI trích bị gắn cờ cần rà soát. */
  flaggedWeeks: number;
}

export interface BoardDepartment {
  id: string | null;
  name: string;
  metricCount: number;
  rising: number;
  falling: number;
  flagged: number;
  latestWeek: number;
  groups: Array<{ name: string; metrics: BoardMetric[] }>;
}

export async function buildMetricBoard(db: PrismaClient, year: number) {
  const [facts, departments, flags] = await Promise.all([
    db.$queryRaw<FactRow[]>`
      SELECT department_name, metric_code, metric_path, metric_name, unit, aggregation,
             week_number, value::float8 AS value, source
      FROM v_chatbot_metric_facts
      WHERE year = ${year}
      ORDER BY department_name, metric_path, week_number`,
    db.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    db.$queryRaw<Array<{ code: string; weeks: bigint }>>`
      SELECT e."metricCode" AS code, count(DISTINCT e."weekId") AS weeks
      FROM extracted_metrics e
      JOIN weeks w ON w.id = e."weekId"
      WHERE w.year = ${year} AND e."metricCode" IS NOT NULL AND cardinality(e."reviewFlags") > 0
      GROUP BY 1`,
  ]);

  const deptId = new Map(departments.map((d) => [d.name, d.id]));
  const flaggedByCode = new Map(flags.map((f) => [f.code, Number(f.weeks)]));

  // phòng → mã chỉ số → các điểm theo tuần
  const byDept = new Map<string, Map<string, { row: FactRow; points: BoardPoint[] }>>();
  for (const f of facts) {
    const metrics = byDept.get(f.department_name) ?? new Map();
    const entry = metrics.get(f.metric_code) ?? { row: f, points: [] };
    entry.points.push({ week: f.week_number, value: Number(f.value), source: f.source === 'EXCEL' ? 'EXCEL' : 'REPORT' });
    metrics.set(f.metric_code, entry);
    byDept.set(f.department_name, metrics);
  }

  const result: BoardDepartment[] = [];
  for (const [name, metrics] of byDept) {
    const groups = new Map<string, BoardMetric[]>();
    let latestWeek = 0;
    for (const { row, points } of metrics.values()) {
      const latest = points[points.length - 1];
      const previous = points.length > 1 ? points[points.length - 2] : null;
      latestWeek = Math.max(latestWeek, latest.week);
      const recent = points.slice(-RECENT_WEEKS);
      const [group, ...rest] = row.metric_path.split(' > ');
      const metric: BoardMetric = {
        code: row.metric_code,
        name: row.metric_name,
        subPath: rest.join(' › ') || row.metric_name,
        unit: row.unit,
        aggregation: row.aggregation,
        series: points,
        latest,
        previous,
        changePercent: previous && previous.value !== 0 ? ((latest.value - previous.value) / Math.abs(previous.value)) * 100 : null,
        recentAverage: recent.reduce((s, p) => s + p.value, 0) / recent.length,
        flaggedWeeks: flaggedByCode.get(row.metric_code) ?? 0,
      };
      groups.set(group, [...(groups.get(group) ?? []), metric]);
    }
    const all = [...groups.values()].flat();
    // Chỉ tính tăng/giảm cho chỉ số còn báo cáo ở tuần mới nhất của phòng.
    const current = all.filter((m) => m.latest.week === latestWeek);
    result.push({
      id: deptId.get(name) ?? null,
      name,
      metricCount: all.length,
      rising: current.filter((m) => (m.changePercent ?? 0) >= NOTABLE_CHANGE_PERCENT).length,
      falling: current.filter((m) => (m.changePercent ?? 0) <= -NOTABLE_CHANGE_PERCENT).length,
      flagged: all.filter((m) => m.flaggedWeeks > 0).length,
      latestWeek,
      groups: [...groups.entries()].map(([groupName, list]) => ({ name: groupName, metrics: list })),
    });
  }
  result.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  return { year, departments: result };
}

export type MetricBoard = Awaited<ReturnType<typeof buildMetricBoard>>;
