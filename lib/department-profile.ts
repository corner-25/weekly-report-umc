/**
 * Hồ sơ 360 của một phòng ban: gom mọi thứ hệ thống biết về phòng — báo cáo
 * tuần đã nộp, nhiệm vụ báo cáo tuần (task threads), nhiệm vụ tuần gần nhất,
 * chỉ số chuẩn theo tuần, công việc chỉ đạo (số liệu điều hành + danh sách cần
 * chú ý), thư ký, giấy phép, MOU. Mỗi phần một truy vấn, chạy song song; phần
 * tính thuần nằm ở lib/department-profile-sections.ts và lib/department-signals.ts.
 */
import type { PrismaClient } from '@prisma/client';
import { NON_SECRETARY_TYPE } from '@/lib/birthday';
import { buildThreadSection, buildWorkSection } from '@/lib/department-profile-sections';
import { buildSubmissionStrip, weeksBetween } from '@/lib/department-signals';

/** Số tuần gần nhất hiện trên dải nộp báo cáo và đường xu hướng chỉ số. */
const WEEKS_SHOWN = 12;
/** Chỉ số hiện tối đa mỗi nhóm — phòng nhiều chỉ số thì xem đủ ở trang Bảng số liệu. */
const METRICS_PER_GROUP = 8;
const MS_PER_DAY = 86_400_000;

interface FactRow {
  metric_code: string;
  metric_path: string;
  metric_name: string;
  unit: string | null;
  year: number;
  week_number: number;
  value: number;
}

export async function buildDepartmentProfile(db: PrismaClient, departmentId: string, now: Date = new Date()) {
  const [department, weeks] = await Promise.all([
    db.department.findUnique({ where: { id: departmentId } }),
    db.week.findMany({
      orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
      take: WEEKS_SHOWN,
      select: { id: true, year: true, weekNumber: true, startDate: true, endDate: true },
    }),
  ]);
  if (!department || department.deletedAt) return null;
  const latestWeek = weeks[0] ?? null;
  const weekKeys = weeks.map((w) => ({ year: w.year, week: w.weekNumber }));

  const [snapshots, tasksPerWeek, latestTasks, masterTaskCount, facts, flagged, workItems, threads, secretaries, licenses, mous, accounts] = await Promise.all([
    db.hospitalImportSnapshot.findMany({
      where: { departmentId, OR: weekKeys.length ? weekKeys : [{ year: -1, week: -1 }] },
      select: { year: true, week: true, taskCount: true, importedAt: true },
    }),
    // Tuần trước khi có dấu vân tay từng phòng: coi là đã nộp nếu có nhiệm vụ của phòng.
    db.weekTaskProgress.groupBy({
      by: ['weekId'],
      where: { weekId: { in: weeks.map((w) => w.id) }, masterTask: { departmentId } },
      _count: true,
    }),
    latestWeek
      ? db.weekTaskProgress.findMany({
          where: { weekId: latestWeek.id, masterTask: { departmentId } },
          orderBy: [{ isImportant: 'desc' }, { orderNumber: 'asc' }],
          select: { id: true, result: true, progress: true, isImportant: true, nextWeekPlan: true, masterTask: { select: { id: true, name: true } } },
          take: 60,
        })
      : Promise.resolve([]),
    db.masterTask.count({ where: { departmentId, isActive: true } }),
    db.$queryRaw<FactRow[]>`
      SELECT f.metric_code, f.metric_path, f.metric_name, f.unit, f.year, f.week_number, f.value
      FROM v_chatbot_metric_facts f
      WHERE f.department_name = ${department.name}
        AND (f.year * 100 + f.week_number) >= ${weeks.length ? weeks[weeks.length - 1].year * 100 + weeks[weeks.length - 1].weekNumber : 0}
      ORDER BY f.metric_path, f.year, f.week_number`,
    db.extractedMetric.count({ where: { departmentId, reviewStatus: 'PENDING', NOT: { reviewFlags: { isEmpty: true } } } }),
    // Mọi công việc của phòng (vài trăm dòng là nhiều) — cần đủ để tính tỷ lệ hoàn thành, đúng hạn.
    db.workItem.findMany({
      where: { departmentId },
      select: {
        id: true, title: true, status: true, kind: true, priority: true, dueDate: true, directedAt: true, directedBy: true,
        lastActivityAt: true, createdAt: true, completedAt: true, progressPercent: true, leadUnit: true, tags: true, departmentId: true,
      },
    }),
    latestWeek
      ? db.taskThread.findMany({
          where: { departmentId, year: latestWeek.year, entries: { some: {} } },
          select: {
            id: true, title: true, kind: true, status: true, overrideKind: true, overrideStatus: true, progress: true, overrideProgress: true,
            firstWeek: true, lastWeek: true, completedWeek: true, needsReview: true, overriddenAt: true,
          },
        })
      : Promise.resolve([]),
    db.secretary.findMany({
      where: { currentDepartmentId: departmentId, deletedAt: null, status: 'ACTIVE', secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } } },
      select: { id: true, fullName: true, email: true, phone: true, dateOfBirth: true, secretaryType: { select: { name: true, color: true } } },
      orderBy: { fullName: 'asc' },
    }),
    db.license.findMany({
      where: { departmentId, deletedAt: null },
      select: { id: true, name: true, expiryDate: true, category: true },
      orderBy: { expiryDate: { sort: 'asc', nulls: 'last' } },
      take: 20,
    }),
    db.mOU.findMany({
      where: { departmentId, deletedAt: null },
      select: { id: true, title: true, partnerName: true, status: true, expiryDate: true },
      orderBy: { expiryDate: { sort: 'asc', nulls: 'last' } },
      take: 20,
    }),
    db.user.count({ where: { departmentId } }),
  ]);

  // Dải nộp báo cáo: tuần nào phòng có trong file báo cáo chung.
  const submissions = buildSubmissionStrip(
    weeks,
    new Map(snapshots.map((s) => [`${s.year}-${s.week}`, s.taskCount])),
    new Map(tasksPerWeek.map((t) => [t.weekId, t._count])),
  );

  // Chỉ số: gom theo nhóm (đoạn đầu đường dẫn), mỗi chỉ số giữ chuỗi theo tuần.
  const byMetric = new Map<string, { path: string; name: string; unit: string | null; series: Array<{ year: number; week: number; value: number }> }>();
  for (const f of facts) {
    const entry = byMetric.get(f.metric_code) ?? { path: f.metric_path, name: f.metric_name, unit: f.unit, series: [] };
    entry.series.push({ year: f.year, week: f.week_number, value: Number(f.value) });
    byMetric.set(f.metric_code, entry);
  }
  const groups = new Map<string, Array<ReturnType<typeof metricSummary>>>();
  for (const m of byMetric.values()) {
    const group = m.path.split(' > ')[0];
    const list = groups.get(group) ?? [];
    list.push(metricSummary(m));
    groups.set(group, list);
  }
  const metricGroups = [...groups.entries()]
    .map(([group, metrics]) => ({
      group,
      total: metrics.length,
      // Chỉ số có nhiều tuần dữ liệu là chuỗi theo dõi thật, lên trước.
      metrics: metrics.sort((a, b) => b.series.length - a.series.length).slice(0, METRICS_PER_GROUP),
    }))
    .sort((a, b) => b.total - a.total);

  const work = buildWorkSection(workItems.map((w) => ({ ...w, departmentName: department.name })), now);
  const latestKey = latestWeek ? latestWeek.year * 100 + latestWeek.weekNumber : null;
  const metricKeys = [...byMetric.values()].map((m) => { const l = m.series[m.series.length - 1]; return l.year * 100 + l.week; });
  const metricsLatestKey = metricKeys.length ? Math.max(...metricKeys) : null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return {
    department: { id: department.id, name: department.name, description: department.description },
    latestWeek: latestWeek && {
      year: latestWeek.year, week: latestWeek.weekNumber,
      startDate: latestWeek.startDate.toISOString().slice(0, 10), endDate: latestWeek.endDate.toISOString().slice(0, 10),
    },
    counts: {
      masterTasks: masterTaskCount,
      weeksSubmitted: submissions.filter((s) => s.submitted).length,
      weeksShown: submissions.length,
      metrics: byMetric.size,
      flaggedMetrics: flagged,
      metricsLatestKey,
      metricsWeeksBehind: weeksBetween(metricsLatestKey, latestKey),
      openWork: work.kpi.open,
      overdueWork: work.kpi.overdue,
      staleWork: work.kpi.stale,
      secretaries: secretaries.length,
      accounts,
    },
    submissions,
    latestTasks: latestTasks.map((t) => ({
      id: t.id, name: t.masterTask.name, masterTaskId: t.masterTask.id, result: t.result,
      progress: t.progress, isImportant: t.isImportant, nextWeekPlan: t.nextWeekPlan,
    })),
    metricGroups,
    work,
    threads: buildThreadSection(threads, latestWeek?.year ?? null),
    secretaries: secretaries.map((s) => ({
      id: s.id, fullName: s.fullName, email: s.email, phone: s.phone,
      type: s.secretaryType?.name ?? null, color: s.secretaryType?.color ?? null,
      birthday: s.dateOfBirth ? `${String(s.dateOfBirth.getUTCDate()).padStart(2, '0')}/${String(s.dateOfBirth.getUTCMonth() + 1).padStart(2, '0')}` : null,
    })),
    licenses: licenses.map((l) => ({
      id: l.id, name: l.name, category: l.category,
      expiryDate: l.expiryDate?.toISOString().slice(0, 10) ?? null,
      daysLeft: l.expiryDate ? Math.floor((l.expiryDate.getTime() - today) / MS_PER_DAY) : null,
    })),
    mous: mous.map((m) => ({
      id: m.id, title: m.title, partnerName: m.partnerName, status: m.status,
      expiryDate: m.expiryDate?.toISOString().slice(0, 10) ?? null,
    })),
  };
}

function metricSummary(m: { path: string; name: string; unit: string | null; series: Array<{ year: number; week: number; value: number }> }) {
  const last = m.series[m.series.length - 1];
  const prev = m.series.length > 1 ? m.series[m.series.length - 2] : null;
  return {
    path: m.path,
    name: m.name,
    unit: m.unit,
    latest: last,
    previous: prev,
    series: m.series,
  };
}

export type DepartmentProfile = NonNullable<Awaited<ReturnType<typeof buildDepartmentProfile>>>;
