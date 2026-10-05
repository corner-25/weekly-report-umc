import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { compressedJson } from '@/lib/http/compressed-json';
import { assignedAt, computeWorkAnalytics, type AnalyticsItem } from '@/lib/work/analytics';
import { toWorkItemDto, workItemInclude } from '@/lib/work/server';

const LIST_SIZE = 12;
const RECENT_UPDATES = 15;
const YEAR = /^\d{4}$/;

/**
 * Bảng điều hành công việc: tổng quan, theo tháng, theo đơn vị, tuổi việc tồn,
 * theo lãnh đạo/phân loại, và các danh sách cần xử lý.
 * Lọc: ?nam=2025 (việc giao trong năm), ?phong=<departmentId>.
 */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const params = new URL(request.url).searchParams;
  const year = YEAR.test(params.get('nam') ?? '') ? Number(params.get('nam')) : null;
  const departmentId = params.get('phong') || null;
  const now = new Date();

  const [all, lastImport] = await Promise.all([
    prisma.workItem.findMany({ include: workItemInclude }),
    prisma.workImportRun.findFirst({ orderBy: { importedAt: 'desc' } }),
  ]);

  const years = [...new Set(all.map((i) => assignedAt(i).getUTCFullYear()))].sort((a, b) => b - a);
  const inYear = year ? all.filter((i) => assignedAt(i).getUTCFullYear() === year) : all;
  const departments = [
    ...inYear
      .reduce((map, i) => (i.department ? map.set(i.department.id, { ...i.department, count: (map.get(i.department.id)?.count ?? 0) + 1 }) : map), new Map<string, { id: string; name: string; count: number }>())
      .values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const scoped = departmentId ? inYear.filter((i) => i.departmentId === departmentId) : inYear;

  const analyticsItems: AnalyticsItem[] = scoped.map((i) => ({
    id: i.id,
    status: i.status,
    departmentId: i.departmentId,
    departmentName: i.department?.name ?? null,
    leadUnit: i.leadUnit,
    directedBy: i.directedBy,
    directedAt: i.directedAt,
    createdAt: i.createdAt,
    dueDate: i.dueDate,
    completedAt: i.completedAt,
    lastActivityAt: i.lastActivityAt,
    progressPercent: i.progressPercent,
    tags: i.tags,
  }));
  const currentMonth = new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 7);
  const analytics = computeWorkAnalytics(analyticsItems, {
    now,
    ...(year && { fromMonth: `${year}-01`, toMonth: `${year}-12` < currentMonth ? `${year}-12` : currentMonth }),
  });

  const open = scoped.map((i) => toWorkItemDto(i, now)).filter((i) => !i.health.isClosed);
  const byDue = (a: { health: { daysToDue: number | null } }, b: { health: { daysToDue: number | null } }) => (a.health.daysToDue ?? 0) - (b.health.daysToDue ?? 0);
  const recentUpdates = await prisma.workUpdate.findMany({
    where: { workItemId: { in: scoped.map((i) => i.id) } },
    orderBy: { occurredAt: 'desc' },
    take: RECENT_UPDATES,
    include: { workItem: { select: { id: true, title: true, leadUnit: true, department: { select: { name: true } } } } },
  });

  return compressedJson(request, {
    filters: { year, departmentId, years, departments },
    ...analytics,
    lists: {
      overdue: open.filter((i) => i.health.isOverdue).sort(byDue).slice(0, LIST_SIZE),
      dueSoon: open.filter((i) => i.health.isDueSoon).sort(byDue).slice(0, LIST_SIZE),
      stale: open
        .filter((i) => i.health.isStale && !i.health.isOverdue)
        .sort((a, b) => (b.health.daysSinceActivity ?? Infinity) - (a.health.daysSinceActivity ?? Infinity) || (a.directedAt ?? '').localeCompare(b.directedAt ?? ''))
        .slice(0, LIST_SIZE),
    },
    recentUpdates: recentUpdates.map((u) => ({
      id: u.id,
      occurredAt: u.occurredAt.toISOString(),
      author: u.author,
      content: u.content,
      progressPercent: u.progressPercent,
      item: { id: u.workItem.id, title: u.workItem.title, unit: u.workItem.department?.name ?? u.workItem.leadUnit },
    })),
    lastImport: lastImport && {
      importedAt: lastImport.importedAt.toISOString(),
      scrapedAt: lastImport.scrapedAt?.toISOString() ?? null,
      itemsSeen: lastImport.itemsSeen,
      itemsCreated: lastImport.itemsCreated,
      itemsChanged: lastImport.itemsChanged,
      updatesAdded: lastImport.updatesAdded,
      problemCount: Array.isArray(lastImport.problems) ? lastImport.problems.length : 0,
    },
  });
});
