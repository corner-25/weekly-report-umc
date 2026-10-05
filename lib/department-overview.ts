/**
 * Bảng tổng quan mọi phòng ban: mỗi phòng một dòng tín hiệu — công việc chỉ đạo
 * (đang thực hiện / quá hạn / sắp đến hạn / lâu chưa cập nhật / hoàn thành),
 * nộp báo cáo tuần, nhiệm vụ báo cáo tuần, độ mới số liệu, nhân sự, giấy phép.
 * Hai đợt truy vấn song song: đợt hai cần danh sách tuần của đợt một.
 */
import type { PrismaClient } from '@prisma/client';
import { NON_SECRETARY_TYPE } from '@/lib/birthday';
import {
  buildSubmissionStrip, EMPTY_WORK, summarizeThreads, summarizeWorkByDepartment, weeksBetween,
  type ThreadSignals, type WorkSignals,
} from '@/lib/department-signals';

/** Số tuần gần nhất xét chuyện nộp báo cáo. */
export const OVERVIEW_WEEKS = 8;
/** Giấy phép hết hạn trong ngần này ngày tới (hoặc đã hết hạn) thì nhắc. */
export const LICENSE_WARN_DAYS = 60;
const MS_PER_DAY = 86_400_000;

export interface DepartmentOverviewRow {
  id: string;
  name: string;
  description: string | null;
  counts: { masterTasks: number; metricDefinitions: number; secretaries: number; mous: number; licenses: number; accounts: number };
  work: WorkSignals;
  report: {
    /** Cũ → mới; true là tuần đó phòng có trong báo cáo chung. */
    strip: Array<{ year: number; week: number; submitted: boolean }>;
    submittedWeeks: number;
    latestSubmitted: boolean;
  };
  threads: ThreadSignals;
  metrics: {
    /** Số chỉ số chuẩn có dữ liệu. */
    tracked: number;
    /** Mốc "năm*100 + tuần" của số liệu mới nhất. */
    latestKey: number | null;
    /** Số tuần số liệu mới nhất chậm so với tuần báo cáo mới nhất. */
    weeksBehind: number | null;
    /** Số liệu AI trích ra đang chờ rà soát và có cờ cảnh báo. */
    flagged: number;
  };
  /** Giấy phép đã hết hạn hoặc hết hạn trong LICENSE_WARN_DAYS ngày. */
  licensesExpiring: number;
}

export interface DepartmentOverview {
  generatedAt: string;
  latestWeek: { year: number; week: number } | null;
  weeksShown: number;
  departments: DepartmentOverviewRow[];
}

interface MetricFreshRow { department_name: string; tracked: bigint; latest: number | null }
interface ProgressWeekRow { departmentId: string; weekId: string; tasks: bigint }

export async function buildDepartmentOverview(db: PrismaClient, now: Date = new Date()): Promise<DepartmentOverview> {
  const licenseHorizon = new Date(now.getTime() + LICENSE_WARN_DAYS * MS_PER_DAY);
  const [departments, weeks, workItems, metricRows, flagged, licenses, accounts] = await Promise.all([
    db.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, description: true,
        _count: {
          select: {
            // Cùng cách đếm với hồ sơ phòng: nhiệm vụ thường kỳ đang dùng.
            masterTasks: { where: { isActive: true } },
            metricDefinitions: true,
            secretaries: { where: { deletedAt: null, status: 'ACTIVE', secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } } } },
            mous: { where: { deletedAt: null } },
            licenses: { where: { deletedAt: null } },
          },
        },
      },
    }),
    db.week.findMany({ orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }], take: OVERVIEW_WEEKS, select: { id: true, year: true, weekNumber: true } }),
    db.workItem.findMany({
      where: { departmentId: { not: null } },
      select: { departmentId: true, status: true, dueDate: true, completedAt: true, lastActivityAt: true, directedAt: true, createdAt: true },
    }),
    db.$queryRaw<MetricFreshRow[]>`
      SELECT department_name, count(DISTINCT metric_code) AS tracked, max(year * 100 + week_number) AS latest
      FROM v_chatbot_metric_facts GROUP BY department_name`,
    db.extractedMetric.groupBy({ by: ['departmentId'], where: { reviewStatus: 'PENDING', NOT: { reviewFlags: { isEmpty: true } } }, _count: true }),
    db.license.groupBy({ by: ['departmentId'], where: { deletedAt: null, expiryDate: { lte: licenseHorizon } }, _count: true }),
    db.user.groupBy({ by: ['departmentId'], where: { departmentId: { not: null } }, _count: true }),
  ]);

  const latest = weeks[0] ?? null;
  const weekIds = weeks.map((w) => w.id);
  const [snapshots, progressWeeks, threads] = await Promise.all([
    db.hospitalImportSnapshot.findMany({
      where: { OR: weeks.length ? weeks.map((w) => ({ year: w.year, week: w.weekNumber })) : [{ year: -1, week: -1 }] },
      select: { departmentId: true, year: true, week: true, taskCount: true },
    }),
    weekIds.length
      ? db.$queryRaw<ProgressWeekRow[]>`
          SELECT m."departmentId", p."weekId", count(*) AS tasks
          FROM week_task_progress p JOIN master_tasks m ON m.id = p."masterTaskId"
          WHERE p."weekId" = ANY(${weekIds}) GROUP BY 1, 2`
      : Promise.resolve([] as ProgressWeekRow[]),
    latest
      ? db.taskThread.findMany({
          where: { year: latest.year, entries: { some: {} } },
          select: { departmentId: true, kind: true, status: true, overrideKind: true, overrideStatus: true, needsReview: true, overriddenAt: true, lastWeek: true },
        })
      : Promise.resolve([]),
  ]);

  const workByDept = summarizeWorkByDepartment(workItems, now);
  const threadsByDept = groupRows(threads, (t) => t.departmentId);
  const snapshotsByDept = groupRows(snapshots, (s) => s.departmentId);
  const progressByDept = groupRows(progressWeeks, (p) => p.departmentId);
  const metricsByName = new Map(metricRows.map((m) => [m.department_name, m]));
  const flaggedBy = countMap(flagged);
  const licensesBy = countMap(licenses);
  const accountsBy = countMap(accounts);
  const latestKey = latest ? latest.year * 100 + latest.weekNumber : null;

  const rows: DepartmentOverviewRow[] = departments.map((d) => {
    const strip = buildSubmissionStrip(
      weeks,
      new Map((snapshotsByDept.get(d.id) ?? []).map((s) => [`${s.year}-${s.week}`, s.taskCount])),
      new Map((progressByDept.get(d.id) ?? []).map((p) => [p.weekId, Number(p.tasks)])),
    );
    const metric = metricsByName.get(d.name);
    const metricKey = metric?.latest != null ? Number(metric.latest) : null;
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      counts: { ...d._count, accounts: accountsBy.get(d.id) ?? 0 },
      work: workByDept.get(d.id) ?? EMPTY_WORK,
      report: {
        strip: strip.map(({ year, week, submitted }) => ({ year, week, submitted })),
        submittedWeeks: strip.filter((s) => s.submitted).length,
        latestSubmitted: strip.length > 0 && strip[strip.length - 1].submitted,
      },
      threads: summarizeThreads(threadsByDept.get(d.id) ?? []),
      metrics: {
        tracked: Number(metric?.tracked ?? 0),
        latestKey: metricKey,
        weeksBehind: weeksBetween(metricKey, latestKey),
        flagged: flaggedBy.get(d.id) ?? 0,
      },
      licensesExpiring: licensesBy.get(d.id) ?? 0,
    };
  });

  return {
    generatedAt: now.toISOString(),
    latestWeek: latest && { year: latest.year, week: latest.weekNumber },
    weeksShown: weeks.length,
    departments: rows,
  };
}

function groupRows<T>(rows: readonly T[], keyOf: (row: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

function countMap(rows: ReadonlyArray<{ departmentId: string | null; _count: number }>): Map<string, number> {
  return new Map(rows.filter((r) => r.departmentId).map((r) => [r.departmentId as string, r._count]));
}
