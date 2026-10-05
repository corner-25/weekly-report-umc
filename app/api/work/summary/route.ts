import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { compressedJson } from '@/lib/http/compressed-json';
import { computeWorkAnalytics, type AnalyticsItem, type UnitStats } from '@/lib/work/analytics';
import type { DashboardWorkSummary } from '@/components/dashboard/types';

/** Số đơn vị cần chú ý hiện trên trang Tổng quan. */
const TOP_UNITS = 5;

/** Đơn vị nhiều việc quá hạn trước, rồi nhiều việc đang thực hiện; bỏ đơn vị không còn việc. */
const byAttention = (a: UnitStats, b: UnitStats) => b.overdue - a.overdue || b.open - a.open || b.stale - a.stale;

/**
 * Tóm tắt Quản lý công việc cho trang Tổng quan: chỉ số chính và vài đơn vị
 * cần chú ý. Nhẹ hơn /api/work/analytics — chỉ chọn cột cần tính, không dựng
 * danh sách việc hay cập nhật gần đây. Toàn bộ việc, không lọc năm/đơn vị.
 */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const [rows, lastImport] = await Promise.all([
    prisma.workItem.findMany({
      select: {
        id: true,
        status: true,
        departmentId: true,
        department: { select: { name: true } },
        leadUnit: true,
        directedBy: true,
        directedAt: true,
        createdAt: true,
        dueDate: true,
        completedAt: true,
        lastActivityAt: true,
        progressPercent: true,
        tags: true,
      },
    }),
    prisma.workImportRun.findFirst({ orderBy: { importedAt: 'desc' }, select: { importedAt: true } }),
  ]);

  const items: AnalyticsItem[] = rows.map(({ department, ...rest }) => ({ ...rest, departmentName: department?.name ?? null }));
  const { kpi, units } = computeWorkAnalytics(items);
  const withOpen = units.filter((u) => u.open > 0);

  const body: DashboardWorkSummary = {
    kpi: {
      total: kpi.total,
      open: kpi.open,
      done: kpi.done,
      overdue: kpi.overdue,
      dueSoon: kpi.dueSoon,
      stale: kpi.stale,
      completionRate: kpi.completionRate,
      onTimeRate: kpi.onTimeRate,
    },
    units: [...withOpen]
      .sort(byAttention)
      .slice(0, TOP_UNITS)
      .map((u) => ({ key: u.key, departmentId: u.departmentId, unit: u.unit, open: u.open, overdue: u.overdue, stale: u.stale })),
    unitsWithOpen: withOpen.length,
    lastImportAt: lastImport?.importedAt.toISOString() ?? null,
  };
  return compressedJson(request, body);
});
