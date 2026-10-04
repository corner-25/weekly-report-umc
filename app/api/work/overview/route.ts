import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { CLOSED_STATUSES } from '@/lib/work/constants';
import { toWorkItemDto, workItemInclude } from '@/lib/work/server';

/** Số việc gần đây có cập nhật hiện trên bảng theo dõi. */
const RECENT_UPDATES = 20;
const RECENT_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/**
 * B3: bảng theo dõi — bao nhiêu việc đang mở, quá hạn, lâu chưa cập nhật; việc
 * nào vừa cập nhật, cập nhật gì; theo đơn vị; lần nạp dữ liệu gần nhất.
 */
export const GET = handle(async () => {
  await requireSession();
  const now = new Date();
  const since = new Date(now.getTime() - RECENT_DAYS * MS_PER_DAY);

  const [openItems, doneCount, recentUpdates, lastImport] = await Promise.all([
    prisma.workItem.findMany({ where: { status: { notIn: [...CLOSED_STATUSES] } }, include: workItemInclude }),
    prisma.workItem.count({ where: { status: 'DONE' } }),
    prisma.workUpdate.findMany({
      where: { occurredAt: { gte: since } },
      orderBy: { occurredAt: 'desc' },
      take: RECENT_UPDATES,
      include: { workItem: { select: { id: true, title: true, leadUnit: true, department: { select: { name: true } } } } },
    }),
    prisma.workImportRun.findFirst({ orderBy: { importedAt: 'desc' } }),
  ]);

  const open = openItems.map((i) => toWorkItemDto(i, now));
  const overdue = open.filter((i) => i.health.isOverdue).sort((a, b) => (a.health.daysToDue ?? 0) - (b.health.daysToDue ?? 0));
  const stale = open
    .filter((i) => i.health.isStale && !i.health.isOverdue)
    .sort((a, b) => (b.health.daysSinceActivity ?? 9999) - (a.health.daysSinceActivity ?? 9999));
  const dueSoon = open.filter((i) => i.health.isDueSoon).sort((a, b) => (a.health.daysToDue ?? 0) - (b.health.daysToDue ?? 0));

  // Theo đơn vị chủ trì: đơn vị nhiều việc quá hạn / lâu chưa cập nhật lên đầu.
  const byUnit = new Map<string, { unit: string; departmentId: string | null; open: number; overdue: number; stale: number }>();
  for (const i of open) {
    const unit = i.department?.name ?? i.leadUnit ?? 'Chưa rõ đơn vị';
    const row = byUnit.get(unit) ?? { unit, departmentId: i.department?.id ?? null, open: 0, overdue: 0, stale: 0 };
    row.open += 1;
    if (i.health.isOverdue) row.overdue += 1;
    if (i.health.isStale) row.stale += 1;
    byUnit.set(unit, row);
  }

  return NextResponse.json({
    counts: {
      open: open.length,
      directives: open.filter((i) => i.kind === 'DIRECTIVE').length,
      overdue: overdue.length,
      stale: open.filter((i) => i.health.isStale).length,
      dueSoon: dueSoon.length,
      done: doneCount,
      updatedThisWeek: new Set(recentUpdates.map((u) => u.workItemId)).size,
    },
    overdue: overdue.slice(0, 15),
    stale: stale.slice(0, 15),
    dueSoon: dueSoon.slice(0, 10),
    recentUpdates: recentUpdates.map((u) => ({
      id: u.id,
      occurredAt: u.occurredAt.toISOString(),
      author: u.author,
      content: u.content,
      progressPercent: u.progressPercent,
      source: u.source,
      item: { id: u.workItem.id, title: u.workItem.title, unit: u.workItem.department?.name ?? u.workItem.leadUnit },
    })),
    byUnit: [...byUnit.values()].sort((a, b) => b.overdue - a.overdue || b.stale - a.stale || b.open - a.open).slice(0, 15),
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
